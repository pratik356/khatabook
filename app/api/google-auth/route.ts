import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    const client_id = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_CLIENT_SECRET;
    const redirect_uri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/';

    // Debug: Log all environment variables
    console.log('[Backend] Environment variables check:');
    console.log('[Backend] GOOGLE_CLIENT_ID:', client_id ? 'SET' : 'NOT_SET');
    console.log('[Backend] GOOGLE_CLIENT_SECRET:', client_secret ? 'SET' : 'NOT_SET');
    console.log('[Backend] GOOGLE_REDIRECT_URI:', redirect_uri);
    console.log('[Backend] All env vars:', Object.keys(process.env).filter(key => key.includes('GOOGLE')));

    if (!code || !client_id || !client_secret || !redirect_uri) {
      return NextResponse.json({ error: 'Missing Google OAuth config or code' }, { status: 400 });
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id,
        client_secret,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.access_token) {
      return NextResponse.json(tokenData);
    } else {
      return NextResponse.json({ error: 'Failed to get token', details: tokenData }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 });
  }
} 