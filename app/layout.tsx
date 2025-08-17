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

import SessionAuthInitializer from "./components/auth/SessionAuthInitializer"
import SessionMonitor from "./components/auth/SessionMonitor"
// SessionZustandBridge removed - functionality integrated into hybrid session system
import { DataProvider } from "./providers/DataProvider"
import { DateFormatProvider } from "./contexts/DateFormatContext"
import { AccentColorProvider } from "./contexts/AccentColorContext"
import { PillStyleProvider } from "./contexts/PillStyleContext"
// import { GraphSettingsProvider, GraphSettingsDrawer } from "./contexts/GraphSettingsContext"
// LoggingProvider removed - using unified logger from init-logger.ts
import { LineSettingsProvider } from "./contexts/LineSettingsContext"
import { RecentPagesProvider } from "./contexts/RecentPagesContext"
import { AllocationIncrementProvider } from "./contexts/AllocationIncrementContext"
import { UsdBalanceProvider } from "./contexts/UsdBalanceContext"
import { SubscriptionProvider } from "./contexts/SubscriptionContext"
import { EarningsProvider } from "./contexts/EarningsContext"
import { FakeBalanceProvider } from "./contexts/FakeBalanceContext"
import { AllocationIntervalProvider } from "./contexts/AllocationIntervalContext"
import { NavigationOrderProvider } from "./contexts/NavigationOrderContext"
// import SimpleNavigationOptimizer from "./components/navigation/SimpleNavigationOptimizer" // Temporarily disabled

import { ThemeProvider } from "./providers/ThemeProvider"
import { AuthProvider } from "./providers/AuthProvider"
import { ReactQueryProvider } from "./providers/ReactQueryProvider"
import { NotificationProvider } from "./providers/NotificationProvider"
import { MobileProvider } from "./providers/MobileProvider"
import { LogRocketProvider } from "./providers/LogRocketProvider"
import GlobalNavigation from "./components/layout/GlobalNavigation"
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import PWAAnalyticsInitializer from './components/utils/PWAAnalyticsInitializer'
import AutomaticUpdateManager from './components/common/AutomaticUpdateManager'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.getwewrite.app'),
  title: 'WeWrite',
  description: 'A platform for writers to share and monetize their content',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children}: {
  children: React.ReactNode
}) {
  // Add global error handlers for debugging
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('🚨 [Global] Unhandled Promise Rejection:', {
        reason: event.reason,
        promise: event.promise,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    };

    const handleError = (event: ErrorEvent) => {
      console.error('🚨 [Global] Unhandled Error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* OPTIMIZATION: Resource hints for better performance */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Preload critical API routes */}
        <link rel="prefetch" href="/api/pages" />
      </head>
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
              <ReactQueryProvider>
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
                                  <AllocationIncrementProvider>
                                    <SubscriptionProvider>
                                      <FakeBalanceProvider>
                                        <UsdBalanceProvider>
                                          <EarningsProvider>
                                            <AllocationIntervalProvider>
                                        <NavigationOrderProvider>
                                            <SessionAuthInitializer>
                                              <SessionMonitor />
                                              <AutomaticUpdateManager />
                                              <GlobalNavigation>
                                                {children}
                                              </GlobalNavigation>
                                            </SessionAuthInitializer>
                                          </NavigationOrderProvider>
                                            </AllocationIntervalProvider>
                                          </EarningsProvider>
                                        </UsdBalanceProvider>
                                      </FakeBalanceProvider>
                                    </SubscriptionProvider>
                                  </AllocationIncrementProvider>
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
              </ReactQueryProvider>
            </ThemeProvider>
          </ErrorBoundary>
        </NextJSErrorBoundary>
        <SpeedInsights />
      </body>
    </html>
  )
}