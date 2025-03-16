import type { Metadata } from 'next'
import "./globals.css"
import { Toaster } from "./components/ui/toaster"
import { AuthProvider } from "./providers/AuthProvider"
import { ThemeProvider } from "./providers/ThemeProvider"
import { AppProvider } from "./providers/AppProvider"
import { DataProvider } from "./providers/DataProvider"

export const metadata: Metadata = {
  title: 'WeWrite',
  description: 'Collaborative writing platform',
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <AppProvider>
              <DataProvider>
                {children}
                <Toaster />
              </DataProvider>
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 