import React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "KhataApp - Digital Ledger for Shopkeepers",
  description: "A digital ledger app for shopkeepers to manage customer accounts and transactions",
  icons: {
    icon: "/icon.png",
  },
}

// Global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    event.preventDefault() // Prevent the default browser behavior
  })

  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error)
  })
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="hi" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.png" />
        <meta name="google-client-id" content={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""} />
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.className)} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
