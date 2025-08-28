"use client";

import { useEffect, useState } from 'react';

export default function EnvDebug() {
  const [envInfo, setEnvInfo] = useState<any>({});

  useEffect(() => {
    // Check environment variables
    const envCheck = {
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      hasGoogleClientId: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      metaTagContent: (document.querySelector('meta[name="google-client-id"]') as HTMLMetaElement)?.content || 'NOT_FOUND',
      windowLocation: typeof window !== 'undefined' ? window.location.href : 'NOT_AVAILABLE',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'NOT_AVAILABLE'
    };

    setEnvInfo(envCheck);
    console.log('Environment Debug Info:', envCheck);
  }, []);

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: '#f0f0f0',
      border: '1px solid #ccc',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 9999
    }}>
      <h4>Environment Debug</h4>
      <pre>{JSON.stringify(envInfo, null, 2)}</pre>
    </div>
  );
} 