import "./globals.css"
import "./styles/scrollbar-hide.css"
import "./styles/loader.css"
import "./styles/responsive-table.css"
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
import { PWAProvider } from "./providers/PWAProvider"

const ClientLayout = dynamic(() => import("./ClientLayout"), { ssr: true })

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "WeWrite - Home",
  description: "Create, collaborate, and share your writing with others in real-time",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32' },
    ],
    apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
  },
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
        <script dangerouslySetInnerHTML={{
          __html: `
            // Inline script to detect and recover from blank pages
            window.addEventListener('load', function() {
              // Wait for a reasonable time after load to check if page is blank
              setTimeout(function() {
                // Check if the page appears to be blank (minimal content)
                var hasMinimalContent = document.body.innerHTML.length < 1000;
                var hasNoVisibleElements = document.querySelectorAll('div, p, h1, h2, h3, button, a').length < 5;

                if (hasMinimalContent || hasNoVisibleElements) {
                  console.warn('Detected potential blank page, attempting recovery...');

                  // Add a flag to prevent reload loops
                  var reloadCount = parseInt(localStorage.getItem('blankPageReloadCount') || '0');

                  if (reloadCount < 1) { // Limit to 1 reload attempt to prevent loops
                    localStorage.setItem('blankPageReloadCount', (reloadCount + 1).toString());

                    // Force reload after a short delay
                    setTimeout(function() {
                      window.location.reload(true);
                    }, 500);
                  }
                } else {
                  // Reset the counter if page loaded successfully
                  localStorage.setItem('blankPageReloadCount', '0');
                }
              }, 3000);
            });
          `
        }} />
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
                        <PWAProvider>
                          <ClientLayout>
                            {children}
                          </ClientLayout>
                          <Analytics debug={process.env.NODE_ENV === 'development'} />
                          <SpeedInsights />
                        </PWAProvider>
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