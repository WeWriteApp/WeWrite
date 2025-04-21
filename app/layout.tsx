import "./globals.css"
import "./styles/scrollbar-hide.css"
import "./styles/loader.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "./providers/ThemeProvider"
import { AuthProvider } from "./providers/AuthProvider"
import { AppProvider } from "./providers/AppProvider"
import { DataProvider } from "./providers/DataProvider"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import GAProvider from "./providers/GAProvider"
import { AnalyticsProvider } from "./providers/AnalyticsProvider"
import dynamic from "next/dynamic"
import { ToastProvider } from "./providers/ToastProvider"
import { PillStyleProvider } from "./contexts/PillStyleContext"

const ClientLayout = dynamic(() => import("./ClientLayout"), { ssr: true })

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "WeWrite - Home",
  description: "Create, collaborate, and share your writing with others in real-time",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AppProvider>
              <DataProvider>
                <AnalyticsProvider>
                  <GAProvider>
                    <ToastProvider>
                      <PillStyleProvider>
                        <ClientLayout>
                          {children}
                        </ClientLayout>
                        <Analytics debug={process.env.NODE_ENV === 'development'} />
                        <SpeedInsights />
                      </PillStyleProvider>
                    </ToastProvider>
                  </GAProvider>
                </AnalyticsProvider>
              </DataProvider>
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}