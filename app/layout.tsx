import React from "react"
import "./globals.css"
import "./utils/init-logger" // Initialize logging system early
import "./utils/errorSuppression" // Initialize error suppression early
import "./utils/detailedErrorLogging" // Initialize detailed error logging
import "./utils/developmentErrorOverride" // Initialize enhanced React error messages
import Script from 'next/script'
import { UnifiedErrorBoundary } from "./components/utils/UnifiedErrorBoundary"
import { GlobalErrorHandler } from "./components/utils/NextJSErrorHandler"

import SessionAuthInitializer from "./components/auth/SessionAuthInitializer"
import SessionMonitor from "./components/auth/SessionMonitor"
// SessionZustandBridge removed - functionality integrated into hybrid session system
import { DataProvider } from "./providers/DataProvider"
import { DateFormatProvider } from "./contexts/DateFormatContext"
import { AccentColorProvider } from "./contexts/AccentColorContext"
import { NeutralColorProvider } from "./contexts/NeutralColorContext"
import { AppBackgroundProvider } from "./contexts/AppBackgroundContext"
import { PillStyleProvider } from "./contexts/PillStyleContext"
// import { GraphSettingsProvider, GraphSettingsDrawer } from "./contexts/GraphSettingsContext"
// LoggingProvider removed - using unified logger from init-logger.ts
import { LineSettingsProvider } from "./contexts/LineSettingsContext"
import { RecentPagesProvider } from "./contexts/RecentPagesContext"
import { AllocationIncrementProvider } from "./contexts/AllocationIncrementContext"
import { UsdBalanceProvider } from "./contexts/UsdBalanceContext"
import { SubscriptionProvider } from "./contexts/SubscriptionContext"
import { EarningsProvider } from "./contexts/EarningsContext"
import { DemoBalanceProvider } from "./contexts/DemoBalanceContext"
import { AllocationIntervalProvider } from "./contexts/AllocationIntervalContext"
import { NavigationOrderProvider } from "./contexts/NavigationOrderContext"
// import SimpleNavigationOptimizer from "./components/navigation/SimpleNavigationOptimizer" // Temporarily disabled

import { ThemeProvider } from "./providers/ThemeProvider"
import { AuthProvider } from "./providers/AuthProvider"
import { ReactQueryProvider } from "./providers/ReactQueryProvider"
import { NotificationProvider } from "./providers/NotificationProvider"
import { MobileProvider } from "./providers/MobileProvider"
import { LogRocketProvider } from "./providers/LogRocketProvider"
import { PWAProvider } from "./providers/PWAProvider"
import { BannerProvider } from "./providers/BannerProvider"
import GlobalNavigation from "./components/layout/GlobalNavigation"
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import PWAAnalyticsInitializer from './components/utils/PWAAnalyticsInitializer'
import AutomaticUpdateManager from './components/common/AutomaticUpdateManager'
import { FeatureFlagProvider } from "./contexts/FeatureFlagContext"

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
      <body className="min-h-screen bg-background text-foreground" suppressHydrationWarning>
        {/* Early Firebase error suppression - must run before any other scripts */}
        <Script
          src="/firebase-error-suppression.js"
          strategy="beforeInteractive"
          priority
        />
        <UnifiedErrorBoundary>
          <GlobalErrorHandler />
          <ThemeProvider>
              <ReactQueryProvider>
                <AuthProvider>
                  <LogRocketProvider>
                    <PWAProvider>
                      <BannerProvider>
                        <NotificationProvider>
                      <MobileProvider>
                      <DataProvider>
                        <DateFormatProvider>
                                  <AccentColorProvider>
                                    <NeutralColorProvider>
                                      <SubscriptionProvider>
                                        <AppBackgroundProvider>
                                          <PillStyleProvider>
                                <FeatureFlagProvider>
                                <LineSettingsProvider>
                                  <RecentPagesProvider>
                                    <AllocationIncrementProvider>
                                        <DemoBalanceProvider>
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
                                        </DemoBalanceProvider>
                                    </AllocationIncrementProvider>
                                  </RecentPagesProvider>
                                </LineSettingsProvider>
                                </FeatureFlagProvider>
                                  </PillStyleProvider>
                                </AppBackgroundProvider>
                              </SubscriptionProvider>
                            </NeutralColorProvider>
                          </AccentColorProvider>
                        </DateFormatProvider>
                      </DataProvider>
                    </MobileProvider>
                    </NotificationProvider>
                      </BannerProvider>
                    </PWAProvider>
                  </LogRocketProvider>
                </AuthProvider>
              </ReactQueryProvider>
            </ThemeProvider>
        </UnifiedErrorBoundary>
        <SpeedInsights />
      </body>
    </html>
  )
}
