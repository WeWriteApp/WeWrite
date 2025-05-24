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
import ErrorBoundary from "./components/ErrorBoundary"
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
            // Enhanced script to detect and recover from blank pages and script failures
            window.addEventListener('load', function() {
              // Track script loading failures
              window.scriptFailures = window.scriptFailures || [];

              // Override console.error to catch script loading failures
              var originalError = console.error;
              console.error = function() {
                var args = Array.prototype.slice.call(arguments);
                var message = args.join(' ');

                // Check for common script loading failure patterns
                if (message.includes('ERR_BLOCKED_BY_CLIENT') ||
                    message.includes('Failed to load') ||
                    message.includes('script error') ||
                    message.includes('googleapis') ||
                    message.includes('vercel') ||
                    message.includes('gtag')) {
                  window.scriptFailures.push({
                    message: message,
                    timestamp: Date.now()
                  });

                  // Don't let script failures cause page reloads
                  console.warn('Script loading failure detected but continuing gracefully:', message);
                  return;
                }

                // Call original console.error for other errors
                originalError.apply(console, arguments);
              };

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
        <ErrorBoundary name="root" resetOnPropsChange={true}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ErrorBoundary name="auth" resetOnPropsChange={true}>
              <AuthProvider>
                <ErrorBoundary name="app" resetOnPropsChange={true}>
                  <AppProvider>
                    <ErrorBoundary name="data" resetOnPropsChange={true}>
                      <DataProvider>
                        <ErrorBoundary name="analytics" resetOnPropsChange={false}>
                          <AnalyticsProvider>
                            <GAProvider>
                              <ToastProvider>
                                <PillStyleProvider>
                                  <PWAProvider>
                                    <ErrorBoundary name="layout" resetOnPropsChange={true}>
                                      <ClientLayout>
                                        {children}
                                      </ClientLayout>
                                    </ErrorBoundary>
                                    <ErrorBoundary name="vercel_analytics" resetOnPropsChange={false}>
                                      <Analytics debug={process.env.NODE_ENV === 'development'} />
                                    </ErrorBoundary>
                                    <ErrorBoundary name="speed_insights" resetOnPropsChange={false}>
                                      <SpeedInsights />
                                    </ErrorBoundary>
                                  </PWAProvider>
                                </PillStyleProvider>
                              </ToastProvider>
                            </GAProvider>
                          </AnalyticsProvider>
                        </ErrorBoundary>
                      </DataProvider>
                    </ErrorBoundary>
                  </AppProvider>
                </ErrorBoundary>
              </AuthProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}