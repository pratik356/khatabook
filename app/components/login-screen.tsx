"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { googleDriveService } from "./google-drive-service"

interface LoginScreenProps {
  onLogin: () => void
}

// Google SVG icon
const GoogleIcon = () => (
  <svg className="inline-block mr-2 -mt-0.5" width="22" height="22" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.36 1.53 7.82 2.81l5.77-5.62C34.6 3.55 29.8 1.5 24 1.5 14.98 1.5 6.98 7.5 3.44 15.44l6.91 5.37C12.1 15.09 17.6 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.43-4.74H24v9.24h12.4c-.54 2.9-2.18 5.36-4.65 7.02l7.18 5.59C43.98 37.09 46.1 31.27 46.1 24.5z"/><path fill="#FBBC05" d="M10.35 28.13A14.5 14.5 0 0 1 9.5 24c0-1.44.25-2.83.7-4.13l-6.91-5.37A23.93 23.93 0 0 0 0 24c0 3.77.9 7.34 2.49 10.5l7.86-6.37z"/><path fill="#EA4335" d="M24 46.5c6.48 0 11.92-2.14 15.89-5.84l-7.18-5.59c-2 1.36-4.56 2.18-8.71 2.18-6.4 0-11.9-5.59-13.65-12.81l-7.86 6.37C6.98 40.5 14.98 46.5 24 46.5z"/></g></svg>
)

// Custom animated SVG logo (ledger + ₹ + checkmark)
const AnimatedLogo = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mb-4 animate-bounce-slow drop-shadow-xl" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="14" width="60" height="52" rx="12" fill="#2563eb"/>
    <rect x="16" y="20" width="48" height="40" rx="8" fill="#fff"/>
    <text x="40" y="44" textAnchor="middle" fontSize="32" fontWeight="bold" fill="#2563eb" fontFamily="'Inter', 'Poppins', sans-serif">₹</text>
    <polyline points="30,54 38,62 52,38" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-check"/>
    <style>{`
      .animate-bounce-slow { animation: bounce 2.2s cubic-bezier(.28,.84,.42,1) infinite; }
      @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
      .animate-draw-check { stroke-dasharray: 40; stroke-dashoffset: 40; animation: drawCheck 1.2s 0.5s forwards; }
      @keyframes drawCheck { to { stroke-dashoffset: 0; } }
    `}</style>
  </svg>
)

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showPopupHint, setShowPopupHint] = useState(false)
  const [cardVisible, setCardVisible] = useState(false)
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  // Detect in-app browsers (Facebook, Instagram, WhatsApp, etc.)
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
      if (
        /FBAN|FBAV|Instagram|Line|WhatsApp|Messenger|Snapchat|Twitter|LinkedIn|TikTok|Pinterest|WeChat|MiuiBrowser|SamsungBrowser/i.test(ua)
      ) {
        setIsInAppBrowser(true);
      }
    }
  }, []);

  useEffect(() => {
    setTimeout(() => setCardVisible(true), 100)
  }, [])

  const handleGoogleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true)
    setShowPopupHint(false)
    const hintTimeout = setTimeout(() => {
      setShowPopupHint(true)
    }, 5000)
    try {
      // Check if we already have a code in the URL (user just returned from Google)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      
      if (code) {
        console.log("🔄 Processing existing OAuth code...")
        // The main page will handle this, just call onLogin
        onLogin();
      } else {
        console.log("🔄 Starting new OAuth flow...")
        const success = await googleDriveService.authenticate();
        if (success) {
          onLogin();
        } else {
          setShowPopupHint(true);
        }
      }
    } catch (error) {
      console.error("❌ Login error:", error)
      setShowPopupHint(true);
    } finally {
      clearTimeout(hintTimeout);
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-700 via-blue-500 to-blue-300 relative overflow-hidden font-sans" style={{ fontFamily: 'Inter, Poppins, sans-serif' }}>
      {isInAppBrowser && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-200 text-yellow-900 text-center py-3 px-4 font-semibold text-base shadow-md animate-fade-in">
          ⚠️ For best experience, please open this app in <b>Chrome</b> or <b>Safari</b>.<br />
          In-app browsers (like Facebook, Instagram, WhatsApp) may not support Google login.
        </div>
      )}
      {/* Decorative blurred circles for modern effect */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-200 opacity-30 rounded-full blur-3xl z-0" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-400 opacity-20 rounded-full blur-2xl z-0" />
      <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}> 
        <div className="bg-white/90 rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center animate-fade-in">
          <AnimatedLogo />
          <h1 className="text-4xl font-extrabold text-blue-700 mb-1 tracking-tight text-center" style={{ fontFamily: 'inherit' }}>खाता बुक</h1>
          <p className="text-lg text-blue-900/80 mb-8 text-center font-medium" style={{ fontFamily: 'inherit' }}>दुकानदारों के लिए डिजिटल लेजर</p>
          <Button
            onClick={handleGoogleLogin}
            className="bg-gradient-to-r from-blue-600 to-blue-400 text-white text-lg font-bold py-3 px-8 rounded-full shadow-lg transition-transform duration-150 hover:scale-105 focus:scale-95 focus:outline-none flex items-center justify-center w-full relative overflow-hidden group"
            disabled={isLoading}
            style={{ fontFamily: 'inherit' }}
          >
            <span className="absolute left-0 top-0 w-full h-full bg-white/10 opacity-0 group-active:opacity-100 transition-opacity duration-200 pointer-events-none" />
            {isLoading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                लॉगिन हो रहा है...
              </>
            ) : (
              <><GoogleIcon />Google से लॉग इन करें</>
            )}
          </Button>
          {showPopupHint && (
            <p className="mt-4 text-sm text-yellow-700 bg-yellow-100 rounded-lg px-3 py-2 text-center">
              यदि Google लॉगिन विंडो नहीं दिख रही है, तो कृपया अपने ब्राउज़र के पॉप-अप ब्लॉकर को अक्षम करें।<br />
              <span className="text-gray-500">(If Google login window is not appearing, please disable your browser's pop-up blocker.)</span>
            </p>
          )}
          <p className="mt-8 text-xs text-blue-700/70 text-center" style={{ fontFamily: 'inherit' }}>
            आपका डेटा Google Drive में सुरक्षित रूप से सहेजा जाएगा।
          </p>
        </div>
      </div>
      <style>{`
        .animate-fade-in { animation: fadeIn 1.2s cubic-bezier(.28,.84,.42,1) both; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  )
}
