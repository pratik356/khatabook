import type { KhataData } from "../types"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID // optional
const FILE_NAME = 'khata_data.json'

async function getAccessToken() {
  // Exchange refresh token for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: GOOGLE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token
}

function buildMultipartBody(metadata: any, content: string, mimeType: string): { body: string, contentType: string } {
  const boundary = 'foo_bar_baz';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

async function getOrCreateFileId(accessToken: string): Promise<string | null> {
  let query = `name='${FILE_NAME}' and trashed=false`;
  if (GOOGLE_DRIVE_FOLDER_ID) query += ` and '${GOOGLE_DRIVE_FOLDER_ID}' in parents`;
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!searchRes.ok) {
    const errText = await searchRes.text();
    console.error('Google Drive search error:', searchRes.status, errText);
    throw new Error('Google Drive search error: ' + errText);
  }
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }
  // Create the file if not found (empty data)
  const metadata = {
    name: FILE_NAME,
    mimeType: 'application/json',
    ...(GOOGLE_DRIVE_FOLDER_ID ? { parents: [GOOGLE_DRIVE_FOLDER_ID] } : {}),
  };
  const content = JSON.stringify({ customers: [], transactions: [], lastUpdated: new Date().toISOString() });
  const { body, contentType } = buildMultipartBody(metadata, content, 'application/json');
  const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body,
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error('Google Drive file creation error:', createRes.status, errText);
    throw new Error('Google Drive file creation error: ' + errText);
  }
  const createData = await createRes.json();
  return createData.id;
}

function getTodayCsvFileName() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `khata_summary_${yyyy}-${mm}-${dd}.csv`;
}

function generateDailyCsv(transactions: any[], customers: any[]): string {
  // Simple CSV: Date, Customer Name, Type, Amount
  const header = 'Date,Customer,Type,Amount\n';
  const rows = transactions
    .filter(t => {
      const tDate = new Date(t.date);
      const today = new Date();
      return tDate.getFullYear() === today.getFullYear() &&
        tDate.getMonth() === today.getMonth() &&
        tDate.getDate() === today.getDate();
    })
    .map(t => {
      const customer = customers.find((c: any) => c.id === t.customerId);
      const name = customer ? customer.name : '';
      return `${t.date},${name},${t.type},${t.amount}`;
    });
  return header + rows.join('\n');
}

async function uploadDailyCsv(accessToken: string, data: KhataData) {
  const fileName = getTodayCsvFileName();
  const csv = generateDailyCsv(data.transactions, data.customers);
  // Search for today's CSV file
  let query = `name='${fileName}' and trashed=false`;
  if (GOOGLE_DRIVE_FOLDER_ID) query += ` and '${GOOGLE_DRIVE_FOLDER_ID}' in parents`;
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  let fileId = null;
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      fileId = searchData.files[0].id;
    }
  }
  const metadata = {
    name: fileName,
    mimeType: 'text/csv',
    ...(GOOGLE_DRIVE_FOLDER_ID ? { parents: [GOOGLE_DRIVE_FOLDER_ID] } : {}),
  };
  if (fileId) {
    // Update existing file
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/csv',
      },
      body: csv,
    });
  } else {
    // Create new file (multipart)
    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/csv\r\n\r\n' +
      csv +
      closeDelimiter;
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
  }
}

class GoogleDriveService {
  async saveData(data: KhataData): Promise<boolean> {
    let jsonSuccess = false;
    let csvSuccess = false;
    try {
      const accessToken = await getAccessToken();
      // 1. JSON upload
      try {
        const fileId = await getOrCreateFileId(accessToken);
        if (!fileId) throw new Error('No fileId for khata_data.json');
        const updateRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }),
        });
        if (!updateRes.ok) {
          const errText = await updateRes.text();
          console.error('Failed to upload JSON to Google Drive:', updateRes.status, errText);
          throw new Error('Failed to upload JSON to Google Drive: ' + errText);
        }
        jsonSuccess = true;
        console.log('khata_data.json uploaded/updated successfully.');
      } catch (jsonErr) {
        console.error('Error uploading khata_data.json:', jsonErr);
      }
      // 2. CSV upload (always attempt, even if JSON fails)
      try {
        await uploadDailyCsv(accessToken, data);
        csvSuccess = true;
        console.log('Daily summary CSV uploaded/updated successfully.');
      } catch (csvErr) {
        console.error('Error uploading daily summary CSV:', csvErr);
      }
      return jsonSuccess && csvSuccess;
    } catch (error) {
      console.error('Failed to save data to Google Drive (general error):', error);
      return false;
    }
  }

  async loadData(): Promise<KhataData | null> {
    try {
      const accessToken = await getAccessToken();
      const fileId = await getOrCreateFileId(accessToken);
      if (!fileId) return null;
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!fileRes.ok) {
        const errText = await fileRes.text();
        console.error('Failed to download data from Google Drive:', fileRes.status, errText);
        throw new Error('Failed to download data from Google Drive: ' + errText);
      }
      const data = await fileRes.json();
      return data;
    } catch (error) {
      console.error('Failed to load data from Google Drive:', error);
      return null;
    }
  }
}

export const googleDriveService = new GoogleDriveService()
