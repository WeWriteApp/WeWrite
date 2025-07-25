import React from "react"
import "./globals.css"
import "leaflet/dist/leaflet.css" // Leaflet CSS for maps
import "./utils/init-logger" // Initialize logging system early
import "./utils/errorSuppression" // Initialize error suppression early
import "./utils/detailedErrorLogging" // Initialize detailed error logging
import "./utils/developmentErrorOverride" // Initialize enhanced React error messages
import Script from 'next/script'
import ErrorBoundary from "./components/utils/ErrorBoundary"
import NextJSErrorBoundary, { GlobalErrorHandler } from "./components/utils/NextJSErrorHandler"

import ApiSessionInitializer from "./components/auth/ApiSessionInitializer"
// SessionZustandBridge removed - functionality integrated into hybrid session system
import { DataProvider } from "./providers/DataProvider"
import { DateFormatProvider } from "./contexts/DateFormatContext"
import { AccentColorProvider } from "./contexts/AccentColorContext"
import { PillStyleProvider } from "./contexts/PillStyleContext"
// import { GraphSettingsProvider, GraphSettingsDrawer } from "./contexts/GraphSettingsContext"
// LoggingProvider removed - using unified logger from init-logger.ts
import { LineSettingsProvider } from "./contexts/LineSettingsContext"
import { RecentPagesProvider } from "./contexts/RecentPagesContext"
import { TokenIncrementProvider } from "./contexts/TokenIncrementContext"
import { TokenBalanceProvider } from "./contexts/TokenBalanceContext"

import { ThemeProvider } from "./providers/ThemeProvider"
import { AuthProvider } from "./providers/AuthProvider"
import { NotificationProvider } from "./providers/NotificationProvider"
import { MobileProvider } from "./providers/MobileProvider"
import { LogRocketProvider } from "./providers/LogRocketProvider"
import GlobalNavigation from "./components/layout/GlobalNavigation"
import { SpeedInsights } from '@vercel/speed-insights/next'


export default function RootLayout({
  children}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Early Firebase error suppression - must run before any other scripts */}
        <Script
          src="/firebase-error-suppression.js"
          strategy="beforeInteractive"
          priority
        />
        <NextJSErrorBoundary>
          <ErrorBoundary name="root">
            <GlobalErrorHandler />
            <ThemeProvider>
              <AuthProvider>
                <LogRocketProvider>
                  <NotificationProvider>
                    <MobileProvider>
                      <DataProvider>
                        <DateFormatProvider>
                          <AccentColorProvider>
                            <PillStyleProvider>
                              <LineSettingsProvider>
                                <RecentPagesProvider>
                                  <TokenIncrementProvider>
                                    <TokenBalanceProvider>
                                      <ApiSessionInitializer>
                                    <GlobalNavigation>
                                      {children}
                                    </GlobalNavigation>
                                      </ApiSessionInitializer>
                                    </TokenBalanceProvider>
                                  </TokenIncrementProvider>
                                </RecentPagesProvider>
                              </LineSettingsProvider>
                            </PillStyleProvider>
                          </AccentColorProvider>
                        </DateFormatProvider>
                      </DataProvider>
                    </MobileProvider>
                  </NotificationProvider>
                </LogRocketProvider>
              </AuthProvider>
            </ThemeProvider>
          </ErrorBoundary>
        </NextJSErrorBoundary>
        <SpeedInsights />
      </body>
    </html>
  )
}