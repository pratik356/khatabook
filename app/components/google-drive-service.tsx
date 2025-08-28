"use client";

import type { KhataData, Customer, Transaction } from "../../components/types";

// --- GoogleDriveService base class ---
class GoogleDriveService {
  private readonly SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";
  private CLIENT_ID: string = "";
  private accessToken: string = "";
  private tokenClient: any = null;
  private authenticatePromise: Promise<boolean> | null = null;
  private tokenExpiry: number | null = null; // Unix timestamp in ms
  private readonly FILE_NAME = "khata_data.json";
  private readonly FOLDER_NAME = "KhataApp";
  private folderId: string | null = null;
  // Change the main JSON backup file name to 'KB_MAIN_DATA.json'
  private readonly MAIN_JSON_FILE_NAME = 'KB_MAIN_DATA.json';

  constructor() {
    if (typeof window !== "undefined") {
      // Initialize CLIENT_ID immediately if possible
      this.CLIENT_ID = (document.querySelector('meta[name="google-client-id"]') as HTMLMetaElement)?.content || "";
      
      // Fallback to environment variable if meta tag is empty
      if (!this.CLIENT_ID && typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
        this.CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      }
      
      // Restore token from localStorage if available
      const storage = typeof window !== "undefined" ? localStorage : null;
      if (storage) {
        const token = storage.getItem("khata_google_drive_token");
        const expiry = storage.getItem("khata_google_drive_token_expiry");
        if (token) this.accessToken = token;
        if (expiry) this.tokenExpiry = parseInt(expiry, 10);
      }
    }
  }

  // Ensure Google Identity Services script is loaded
  private async ensureGoogleScriptLoaded(): Promise<void> {
    if (typeof window === "undefined") throw new Error("Not in browser");
    const win = window as any;
    if (win.google && win.google.accounts && win.google.accounts.oauth2) return;
    // Check if script is already present
    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Google Identity Services script"));
        document.head.appendChild(script);
      });
    } else {
      // Wait for script to finish loading if it is present but not loaded yet
      await new Promise<void>((resolve) => {
        const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]') as HTMLScriptElement | null;
        if (script && (script as any).readyState && (script as any).readyState !== "complete") {
          script.addEventListener("load", () => resolve());
        } else {
          resolve();
        }
      });
    }
    // Wait until window.google is available
    while (!(win.google && win.google.accounts && win.google.accounts.oauth2)) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  private ensureClientIdLoaded(): void {
    if (!this.CLIENT_ID) {
      // Try to get CLIENT_ID from meta tag first
      const metaTagContent = (document.querySelector('meta[name="google-client-id"]') as HTMLMetaElement)?.content || "";
      this.CLIENT_ID = metaTagContent;
      
      // Fallback to environment variable if meta tag is empty
      if (!this.CLIENT_ID && typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
        this.CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      }
      
      // Debug logging
      console.log('[GoogleDriveService] CLIENT_ID debug:', {
        metaTagContent,
        envVar: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID : 'process not available',
        finalClientId: this.CLIENT_ID ? 'SET' : 'NOT SET'
      });
      
      if (!this.CLIENT_ID) {
        throw new Error("Google Client ID not configured. Please check your environment variables and ensure NEXT_PUBLIC_GOOGLE_CLIENT_ID is set in your .env.local file.");
      }
    }
  }

  async loadGoogleLibraries(): Promise<void> {
    if (typeof window === "undefined") throw new Error("Not in browser");
    
    // Ensure CLIENT_ID is loaded before proceeding
    this.ensureClientIdLoaded();
    
    await this.ensureGoogleScriptLoaded();
    const win = window as any;
    if (!this.tokenClient && win.google && win.google.accounts && win.google.accounts.oauth2) {
      this.tokenClient = win.google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: () => {},
      });
    }
  }

  async authenticate(): Promise<boolean> {
    console.log('[GoogleDriveService] Starting authentication');
    if (this.authenticatePromise) return this.authenticatePromise;
    this.authenticatePromise = new Promise(async (resolve) => {
      try {
        await this.loadGoogleLibraries();
        console.log('[GoogleDriveService] Google libraries loaded');
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        if (code) {
          console.log('[GoogleDriveService] Found code in URL:', code);
          try {
            const response = await fetch("/api/google-auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            });
            if (!response.ok) {
              const errorText = await response.text();
              console.error('[GoogleDriveService] Backend error:', errorText);
              // Clean up the URL even on error to prevent retry
              window.history.replaceState({}, document.title, window.location.pathname);
              resolve(false);
              return;
            }
            const data = await response.json();
            if (data.access_token) {
              console.log('[GoogleDriveService] Received access_token from backend');
              this.setAccessToken(data.access_token, data.expires_in);
              // Clean up the URL (remove ?code=...)
              window.history.replaceState({}, document.title, window.location.pathname);
              resolve(true);
              // Don't reload - let the app handle the state change
              return;
            }
            console.log('[GoogleDriveService] No access_token in backend response');
            // Clean up the URL even on error to prevent retry
            window.history.replaceState({}, document.title, window.location.pathname);
            resolve(false);
            return;
          } catch (err: any) {
            console.error('[GoogleDriveService] Error exchanging code for token:', err);
            // Clean up the URL even on error to prevent retry
            window.history.replaceState({}, document.title, window.location.pathname);
            resolve(false);
            return;
          }
        }
        
        // Check if we already have a valid token
        if (this.accessToken && !this.isTokenExpired()) {
          console.log('[GoogleDriveService] Already have valid token, skipping OAuth flow');
          resolve(true);
          return;
        }
        
        // Always use redirect flow for authentication
        console.log('[GoogleDriveService] Starting redirect flow for authentication');
        this.fallbackToRedirectFlow(resolve);
      } catch (err) {
        console.error('[GoogleDriveService] General authentication error:', err);
        resolve(false);
      } finally {
        this.authenticatePromise = null;
      }
    });
    return this.authenticatePromise;
  }

  private fallbackToRedirectFlow(resolve: (value: boolean) => void) {
    // Build the Google OAuth URL manually for redirect flow
    const clientId = this.CLIENT_ID;
    // Use the same redirect URI as the backend - for ngrok deployment
    // Try to get from environment variable first, fallback to current origin
    const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || window.location.origin + '/';
    const scope = encodeURIComponent(this.SCOPES);
    
    // Debug: Log the redirect URI being used
    console.log('[GoogleDriveService] Redirect URI being used:', redirectUri);
    console.log('[GoogleDriveService] Full OAuth URL:', `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`);
    
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent`;
    // Redirect the browser (no popup)
    window.location.href = url;
    // The function will not resolve immediately, but after redirect and return
  }

  // Check if token is expired (with 1 min buffer)
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    return Date.now() > this.tokenExpiry - 60 * 1000;
  }

  // Validate token by making a test API call
  private async validateToken(): Promise<boolean> {
    if (!this.accessToken) return false;
    
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ Token is valid');
        return true;
      } else {
        console.log('❌ Token is invalid:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Token validation error:', error);
      return false;
    }
  }

  // Try to refresh token using Google OAuth2 silent flow
  async refreshTokenIfNeeded(): Promise<boolean> {
    if (!this.accessToken || this.isTokenExpired()) {
      console.log('🔄 Token expired or missing, attempting refresh...');
      
      // Clear invalid token
      this.accessToken = "";
      this.tokenExpiry = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem("khata_google_drive_token");
        localStorage.removeItem("khata_auth");
      }
      
      // Try to re-authenticate
      return await this.authenticate();
    }
    
    // Validate token even if not expired
    const isValid = await this.validateToken();
    if (!isValid) {
      console.log('🔄 Token validation failed, attempting refresh...');
      
      // Clear invalid token
      this.accessToken = "";
      this.tokenExpiry = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem("khata_google_drive_token");
        localStorage.removeItem("khata_auth");
      }
      
      // Try to re-authenticate
      return await this.authenticate();
    }
    
    return true;
  }

  private setAccessToken(token: string, expiresIn?: number) {
    this.accessToken = token;
    if (expiresIn) {
      this.tokenExpiry = Date.now() + expiresIn * 1000;
    } else {
      this.tokenExpiry = Date.now() + 60 * 60 * 1000; // default 1 hour
    }
    const storage = typeof window !== "undefined" ? localStorage : null;
    if (storage) {
      storage.setItem("khata_google_drive_token", this.accessToken);
      storage.setItem("khata_auth", "true");
      storage.setItem("khata_google_drive_token_expiry", String(this.tokenExpiry));
    }
    const win = window as any;
    if (win.gapi && win.gapi.client) {
      win.gapi.client.setToken({ access_token: this.accessToken });
    }
  }

  // Get or create the app folder in Google Drive
  private async getOrCreateFolderId(): Promise<string> {
    if (this.folderId) return this.folderId;
    const accessToken = this.accessToken;
    if (!accessToken) {
      console.log('❌ No access token available for Google Drive operations');
      throw new Error('No access token available - user not authenticated');
    }
    
    try {
      const query = `name='${this.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Google Drive API error:', errorText);
        throw new Error(`Google Drive API error: ${res.status} ${errorText}`);
      }
      
      const data = await res.json();
      if (data.files && data.files.length > 0 && typeof data.files[0].id === 'string') {
        this.folderId = data.files[0].id;
        console.log('✅ Found existing KhataApp folder:', this.folderId);
        return this.folderId!;
      }
      
      // Create folder only if not found
      console.log('📁 Creating new KhataApp folder...');
      const meta = {
        name: this.FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      };
      const createRes = await fetch(
        "https://www.googleapis.com/drive/v3/files",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(meta),
        }
      );
      
      if (!createRes.ok) {
        const errorText = await createRes.text();
        console.error('❌ Failed to create folder:', errorText);
        throw new Error(`Failed to create folder: ${createRes.status} ${errorText}`);
      }
      
      const createData = await createRes.json();
      if (!createData.id || typeof createData.id !== 'string') {
        console.error('❌ No folder ID returned:', createData);
        throw new Error('Failed to create folder - no ID returned');
      }
      
      this.folderId = createData.id;
      console.log('✅ Created new KhataApp folder:', this.folderId);
      return this.folderId!;
    } catch (error) {
      console.error('❌ Error in getOrCreateFolderId:', error);
      throw error;
    }
  }

  // Update getOrCreateMainJsonFileId to always use this file name in the KhataApp folder
  private async getOrCreateMainJsonFileId(): Promise<string> {
    const accessToken = this.accessToken;
    if (!accessToken) throw new Error('No access token available');
    
    // Clear any potentially corrupted file IDs from localStorage first
    if (typeof window !== 'undefined') {
      localStorage.removeItem('khata_folder_id');
      localStorage.removeItem('khata_file_id');
      console.log('🧹 Cleared potentially corrupted file IDs from localStorage');
    }
    
    const folderId = await this.getOrCreateFolderId();
    const query = `name='${this.MAIN_JSON_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
    
    console.log('🔍 Searching for existing main data file...');
    
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (!searchRes.ok) {
        const errorText = await searchRes.text();
        console.error('❌ Google Drive search error:', errorText);
        throw new Error('Google Drive search error: ' + errorText);
      }
      
      const searchData = await searchRes.json();
      
      if (searchData.files && searchData.files.length > 0 && searchData.files[0].id) {
        const fileId = searchData.files[0].id;
        console.log('✅ Found existing main data file:', fileId);
        
        // Validate the file ID by trying to access it
        try {
          const validateRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          
          if (!validateRes.ok) {
            console.warn('⚠️ Found file ID is invalid, will create new file');
            throw new Error('Invalid file ID');
          }
          
          return fileId;
        } catch (validationError) {
          console.warn('⚠️ File ID validation failed, creating new file');
          // Continue to create new file
        }
      }
    } catch (searchError) {
      console.warn('⚠️ Search failed, will create new file:', searchError);
    }
    
    // Create the file if not found or invalid (empty data)
    console.log('📝 Creating new main data file...');
    
    try {
      const metadata = {
        name: this.MAIN_JSON_FILE_NAME,
        mimeType: 'application/json',
        parents: [folderId],
      };
      
      const content = JSON.stringify({ 
        customers: [], 
        transactions: [], 
        deletedCustomers: [], 
        deletedTransactions: [], 
        lastUpdated: new Date().toISOString() 
      });
      
      const boundary = 'foo_bar_baz';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;
      const body =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        content +
        closeDelimiter;
      
      const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      });
      
      if (!createRes.ok) {
        const errorText = await createRes.text();
        console.error('❌ Google Drive file creation error:', errorText);
        
        // If it's a 404 error, it might be a folder issue, try to recreate the folder
        if (errorText.includes('404') || errorText.includes('notFound')) {
          console.log('🔄 404 error detected, clearing folder ID and retrying...');
          this.folderId = null;
          if (typeof window !== 'undefined') {
            localStorage.removeItem('khata_folder_id');
          }
          // Recursive call to recreate everything
          return await this.getOrCreateMainJsonFileId();
        }
        
        throw new Error('Google Drive file creation error: ' + errorText);
      }
      
            const createData = await createRes.json();
      
      if (!createData.id) {
        console.error('❌ Failed to create file - no ID returned');
        throw new Error('Failed to create file - no ID returned');
      }
      
      console.log('✅ Created new main data file:', createData.id);
      return createData.id;
    } catch (error) {
      console.error('❌ Error creating file:', error);
      throw error;
    }
  }

  // 1. Add helper to get timestamped file name
  private getTimestampedFileName(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `khata_data_${yyyy}-${mm}-${dd}_${hh}${min}${ss}.json`;
  }
  // 2. Add helper to find latest backup file
  private async getLatestBackupFileId(): Promise<{id: string, name: string} | null> {
    const accessToken = this.accessToken;
    const query = `name contains 'khata_data_' and name contains '.json' and trashed=false`;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime)&orderBy=createdTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    if (data.files && data.files.length > 0 && data.files[0].id && data.files[0].name) {
      return { id: data.files[0].id, name: data.files[0].name };
    }
    return null;
  }
  // Update saveData to always PATCH this file
  async saveData(data: KhataData): Promise<boolean> {
    try {
      console.log('🔄 Starting to save data to Google Drive...');
      
      // Validate and refresh token if needed
      const isAuthenticated = await this.refreshTokenIfNeeded();
      if (!isAuthenticated) {
        console.error('❌ Not authenticated, cannot save data to Google Drive');
        return false;
      }

      const accessToken = this.accessToken;
      console.log('✅ Using access token:', accessToken.substring(0, 10) + '...');
      
      // Get or create the main JSON file
      const fileId = await this.getOrCreateMainJsonFileId();
      console.log('📁 Using file ID:', fileId);
      
      // Prepare the data with updated timestamp
      const dataToSave = { 
        ...data, 
        lastUpdated: new Date().toISOString() 
      };
      
      console.log('💾 Saving data:', {
        customersCount: dataToSave.customers?.length || 0,
        transactionsCount: dataToSave.transactions?.length || 0,
        deletedCustomersCount: dataToSave.deletedCustomers?.length || 0,
        deletedTransactionsCount: dataToSave.deletedTransactions?.length || 0,
        storeName: dataToSave.storeName,
        lastUpdated: dataToSave.lastUpdated
      });

      // Save to Google Drive
      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSave),
        }
      );
      
      const updateText = await updateRes.text();
      console.log('[JSON DEBUG] JSON update response:', updateRes.status, updateText);
      
      if (!updateRes.ok) {
        console.error('❌ Failed to upload JSON to Google Drive:', updateRes.status, updateText);
        return false;
      }
      
      console.log('✅ JSON data saved successfully to Google Drive');
      return true;
    } catch (error) {
      console.error('❌ Failed to save data to Google Drive (general error):', error);
      return false;
    }
  }
    // Update loadData to always load from this file
  async loadData(): Promise<KhataData | null> {
    try {
      console.log('🔄 Loading data from Google Drive...');
      
      // Validate and refresh token if needed
      const isAuthenticated = await this.refreshTokenIfNeeded();
      if (!isAuthenticated) {
        console.log('❌ Not authenticated, cannot load data from Google Drive');
        return null;
      }

      const accessToken = this.accessToken;
      
      try {
        const fileId = await this.getOrCreateMainJsonFileId();
        
        console.log('📁 Attempting to load from file ID:', fileId);
        
        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (!fileRes.ok) {
          const errText = await fileRes.text();
          console.error('❌ Failed to load file from Google Drive:', fileRes.status, errText);
          
          // If file not found (404), try to create a new one
          if (fileRes.status === 404) {
            console.log('🔄 File not found, creating new file...');
            // Clear any stored file IDs that might be corrupted
            if (typeof window !== 'undefined') {
              localStorage.removeItem('khata_folder_id');
              localStorage.removeItem('khata_file_id');
            }
            // Try to create a new file
            const newFileId = await this.getOrCreateMainJsonFileId();
            const newFileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${newFileId}?alt=media`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            
            if (!newFileRes.ok) {
              console.error('❌ Failed to load newly created file');
              return null;
            }
            
            const newFileText = await newFileRes.text();
            try {
              return JSON.parse(newFileText);
            } catch (parseError) {
              console.error('❌ Failed to parse new file data');
              return null;
            }
          }
          
          return null;
        }
        
        const data = await fileRes.json();
        
        // Validate that we have a proper data structure
        if (!data || typeof data !== 'object') {
          console.log('❌ Invalid data structure received, will create initial data');
          return null;
        }
        
        console.log('✅ Data loaded successfully from Google Drive:', {
          hasCustomers: !!data.customers,
          hasTransactions: !!data.transactions,
          hasStoreName: !!data.storeName,
          lastUpdated: data.lastUpdated
        });
        
        return data;
      } catch (error) {
        console.error('❌ Failed to load data from Google Drive:', error);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to load data from Google Drive (outer error):', error);
      return null;
    }
  }

  // --- CSV (Daily Summary) ---
  private getTodayCsvFileName() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `KB-${dd}-${mm}-${yyyy}.csv`;
  }
  private generateDailyCsv(transactions: Transaction[], customers: Customer[], storeName?: string): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateStr = `${dd}/${mm}/${yyyy}`;
    const header = `${storeName || "SHARMA GENERAL STORE"} DAILY LEDGER (${dateStr})\n\nCUSTOMER NAME,MOBILE NO,वर्तमान बैलेंस\n`;
    // Only include customers who are NOT soft deleted
    const rows = customers
      .filter((customer) => !customer.deletedAt)
      .map((customer) => {
        const customerTxns = transactions.filter((t) => t.customerId === customer.id);
        const due = customerTxns.filter((t) => t.type === "due").reduce((sum, t) => sum + t.amount, 0);
        const paid = customerTxns.filter((t) => t.type === "paid").reduce((sum, t) => sum + t.amount, 0);
        const balance = due - paid;
        const currentDue = balance > 0 ? balance : 0;
        const formattedDue = Number(currentDue).toFixed(3).replace(/\.0{1,3}$/, '');
        return `${customer.name},${customer.phone || ""},${formattedDue} RS`;
      });
    return header + rows.join("\n");
  }
  async uploadDailyCsv(data: KhataData): Promise<boolean> {
    try {
      console.log('📄 Starting to upload daily CSV to Google Drive...');
      
      // Check if we have a valid access token
      if (!this.accessToken) {
        console.error('❌ No access token available for CSV upload');
        return false;
      }

      // Ensure token is not expired
      if (this.isTokenExpired()) {
        console.log('🔄 Token expired, refreshing...');
        const refreshed = await this.refreshTokenIfNeeded();
        if (!refreshed) {
          console.error('❌ Failed to refresh token for CSV upload');
          return false;
        }
      }

      const accessToken = this.accessToken;
      const folderId = await this.getOrCreateFolderId();
      const fileName = this.getTodayCsvFileName();
      const csv = this.generateDailyCsv(data.transactions, data.customers, data.storeName);
      
      console.log('📄 Generated CSV for:', fileName);
      console.log('📄 CSV content preview:', csv.substring(0, 200) + '...');
      
      // Search for today's CSV file in the folder
      const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      let fileId: string | undefined;
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0 && typeof searchData.files[0].id === 'string') {
          fileId = searchData.files[0].id;
          console.log('📄 Found existing CSV file:', fileId);
        }
      }
      
      const metadata = {
        name: fileName,
        mimeType: "text/csv",
        parents: [folderId],
      };
      
      if (typeof fileId === 'string') {
        console.log('📄 Updating existing CSV file:', fileId);
        const updateRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "text/csv",
            },
            body: csv,
          }
        );
        const updateText = await updateRes.text();
        console.log('[CSV DEBUG] CSV update response:', updateRes.status, updateText);
        if (!updateRes.ok) {
          console.error('❌ Failed to update daily CSV:', updateText);
          return false;
        }
        console.log('✅ CSV updated successfully');
        return true;
      } else {
        console.log('📄 Creating new CSV file:', fileName);
        const boundary = "foo_bar_baz";
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;
        const body =
          delimiter +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify(metadata) +
          delimiter +
          "Content-Type: text/csv\r\n\r\n" +
          csv +
          closeDelimiter;
        const createRes = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": `multipart/related; boundary=${boundary}`,
            },
            body,
          }
        );
        const createText = await createRes.text();
        console.log('[CSV DEBUG] CSV create response:', createRes.status, createText);
        if (!createRes.ok) {
          console.error('❌ Failed to create daily CSV:', createText);
          return false;
        }
        console.log('✅ CSV created successfully');
        return true;
      }
    } catch (error) {
      console.error('❌ Error in uploadDailyCsv:', error);
      return false;
    }
  }

  // Public initialize method for compatibility with app usage
  public async initialize(): Promise<void> {
    console.log('🚀 Initializing Google Drive Service...');
    
    // Clear any potentially corrupted file IDs from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('khata_folder_id');
      localStorage.removeItem('khata_file_id');
      console.log('🧹 Cleared potentially corrupted file IDs from localStorage');
    }
    
    // Load existing token from localStorage if available
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('khata_google_drive_token');
      const storedExpiry = localStorage.getItem('khata_google_drive_token_expiry');
      const authFlag = localStorage.getItem('khata_auth');
      
      if (storedToken && storedExpiry && authFlag === 'true') {
        const expiry = parseInt(storedExpiry);
        if (Date.now() < expiry) {
          this.accessToken = storedToken;
          this.tokenExpiry = expiry;
          console.log('✅ Loaded existing valid token from localStorage');
        } else {
          console.log('⚠️ Stored token is expired, will need re-authentication');
          localStorage.removeItem('khata_google_drive_token');
          localStorage.removeItem('khata_google_drive_token_expiry');
          localStorage.removeItem('khata_auth');
        }
      } else {
        console.log('⚠️ No valid authentication found in localStorage');
      }
    }
    
    // Load Google libraries
    await this.loadGoogleLibraries();
    
    // Load client ID
    this.ensureClientIdLoaded();
    
    console.log('✅ Google Drive Service initialized');
  }
}

export const googleDriveService = new GoogleDriveService();