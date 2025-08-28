"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff } from "lucide-react"

interface LoginScreenProps {
  onLogin: () => void
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Simulate network delay
    await new Promise((res) => setTimeout(res, 1000))

    // Use environment variables for demo credentials
    const demoUsername = process.env.NEXT_PUBLIC_DEMO_USERNAME || "anu";
    const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "1234567890";
    
    if (username === demoUsername && password === demoPassword) {
      onLogin()
    } else {
      setError("गलत उपयोगकर्ता नाम या पासवर्ड (Invalid username or password)")
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-600 to-blue-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">खाता बुक (Khata Book)</CardTitle>
          <p className="text-gray-600">कृपया लॉगिन करें</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-base font-semibold">
                उपयोगकर्ता नाम
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="उपयोगकर्ता नाम दर्ज करें"
                className="h-12 text-lg mt-1 w-full"
                required
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-base font-semibold">
                पासवर्ड
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="पासवर्ड दर्ज करें"
                  className="h-12 text-lg mt-1 pr-12 w-full"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? "लॉगिन हो रहा है..." : "लॉगिन करें"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-600">
            <strong>डेमो क्रेडेंशियल:</strong>
            <br />
            उपयोगकर्ता नाम: {process.env.NEXT_PUBLIC_DEMO_USERNAME || "anu"}
            <br />
            पासवर्ड: {process.env.NEXT_PUBLIC_DEMO_PASSWORD || "1234567890"}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
