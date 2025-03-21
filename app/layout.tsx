import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/providers/ThemeProvider"
import { AuthProvider } from "@/providers/AuthProvider"
import { AppProvider } from "@/providers/AppProvider"
import { DataProvider } from "@/providers/DataProvider"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import GAProvider from "@/providers/GAProvider"
import { AnalyticsProvider } from "@/providers/AnalyticsProvider"
import dynamic from "next/dynamic"
import { Toaster } from "@/components/ui/toaster"

const ClientLayout = dynamic(() => import("./ClientLayout"), { ssr: true })

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "WeWrite",
  description: "Write together",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
                    <ClientLayout>
                      {children}
                    </ClientLayout>
                    <Analytics debug={process.env.NODE_ENV === 'development'} />
                    <SpeedInsights />
                    <Toaster />
                  </GAProvider>
                </AnalyticsProvider>
              </DataProvider>
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}