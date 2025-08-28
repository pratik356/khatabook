"use client"

import { useState, useEffect } from "react"
import LoginScreen from "@/app/components/login-screen"
import KhataApp from "@/app/components/khata-app"
import ErrorBoundary from "@/app/components/error-boundary"
import { RefreshCw } from "lucide-react"
import { googleDriveService } from "@/app/components/google-drive-service"

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check authentication status with proper error handling
    const checkAuth = async () => {
      try {
        if (typeof window !== 'undefined') {
          // Check if we have a Google OAuth code in the URL (user just returned from Google)
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get("code");
          
          if (code) {
            console.log("🔄 Found OAuth code in URL, processing authentication...")
            setIsLoading(true)
            
            try {
              // Process the OAuth code
              const success = await googleDriveService.authenticate();
              if (success) {
                console.log("✅ OAuth authentication successful")
                setIsLoggedIn(true)
                if (typeof window !== 'undefined') {
                  localStorage.setItem("khata_auth", "true")
                }
              } else {
                console.log("❌ OAuth authentication failed")
                setIsLoggedIn(false)
              }
            } catch (error) {
              console.error("❌ OAuth processing error:", error)
              setIsLoggedIn(false)
            }
            setIsLoading(false)
            return
          }
          
          // No OAuth code, check existing authentication
          const token = localStorage.getItem("khata_google_drive_token")
          const authFlag = localStorage.getItem("khata_auth")
          
          console.log("🔍 Checking existing authentication status...")
          console.log("Token exists:", !!token)
          console.log("Auth flag:", authFlag)
          
          if (token && authFlag === "true") {
            console.log("✅ User is authenticated")
            setIsLoggedIn(true)
          } else {
            console.log("❌ User needs to authenticate")
            setIsLoggedIn(false)
          }
        } else {
          console.log("❌ Not in browser environment")
          setIsLoggedIn(false)
        }
      } catch (error) {
        console.error("❌ Authentication check error:", error)
        setError("Authentication check failed")
        setIsLoggedIn(false)
      } finally {
        setIsLoading(false)
      }
    }

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log("⏰ Auth check timeout, showing login screen")
      setIsLoggedIn(false)
      setIsLoading(false)
    }, 5000) // Increased timeout for OAuth processing

    // Check auth immediately
    checkAuth().catch((error) => {
      console.error("❌ Unhandled auth check error:", error)
      setError("Failed to check authentication")
      setIsLoggedIn(false)
      setIsLoading(false)
    })

    return () => clearTimeout(timeoutId)
  }, [])

  const handleLogin = () => {
    try {
      console.log("🔐 User logged in")
      setIsLoggedIn(true)
      setError(null)
      if (typeof window !== 'undefined') {
        localStorage.setItem("khata_auth", "true")
      }
    } catch (error) {
      console.error("❌ Login error:", error)
      setError("Failed to log in")
    }
  }

  const handleLogout = () => {
    try {
      console.log("🚪 User logged out")
      setIsLoggedIn(false)
      setError(null)
      if (typeof window !== 'undefined') {
        localStorage.removeItem("khata_auth")
        localStorage.removeItem("khata_google_drive_token")
      }
    } catch (error) {
      console.error("❌ Logout error:", error)
      setError("Failed to log out")
    }
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-red-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-xl mb-4">Error occurred</div>
          <div className="text-sm mb-4">{error}</div>
          <button 
            onClick={() => {
              setError(null)
              setIsLoading(true)
              window.location.reload()
            }}
            className="bg-white text-red-600 px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div className="text-xl">खाता ऐप लोड हो रहा है...</div>
          <div className="text-sm mt-2 opacity-75">Loading KhataApp...</div>
        </div>
      </div>
    )
  }

  // Show main app wrapped in error boundary
  return (
    <ErrorBoundary>
      {isLoggedIn ? <KhataApp onLogout={handleLogout} onLogin={handleLogin} /> : <LoginScreen onLogin={handleLogin} />}
    </ErrorBoundary>
  )
}
