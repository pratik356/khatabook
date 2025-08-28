"use client"

import { useState, useEffect } from "react"
import LoginScreen from "./components/login-screen"
import KhataApp from "./components/khata-app"

export default function KhataAppPreview() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const authStatus = localStorage.getItem("khata_auth")
    if (authStatus === "true") {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const handleLogin = () => {
    setIsAuthenticated(true)
    localStorage.setItem("khata_auth", "true")
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem("khata_auth")
    localStorage.removeItem("khata_google_drive_token") // Clear simulated Google Drive token
    localStorage.removeItem("khata_data") // Clear simulated khata data
    localStorage.removeItem("khata_google_drive_token_expiry")
    window.location.reload();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        <div className="text-white text-xl">लोड हो रहा है... (Loading...)</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return <KhataApp onLogout={handleLogout} />
}
