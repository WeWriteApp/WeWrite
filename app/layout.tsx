import React from "react"
import "./globals.css"
import "leaflet/dist/leaflet.css" // Leaflet CSS for maps
import "./utils/init-logger" // Initialize logging system early
import ErrorBoundary from "./components/utils/ErrorBoundary"
import NextJSErrorBoundary, { GlobalErrorHandler } from "./components/utils/NextJSErrorHandler"

import ApiSessionInitializer from "./components/auth/ApiSessionInitializer"
// SessionZustandBridge removed - functionality integrated into hybrid session system
import { DataProvider } from "./providers/DataProvider"
import { DateFormatProvider } from "./contexts/DateFormatContext"
import { AccentColorProvider } from "./contexts/AccentColorContext"
import { PillStyleProvider } from "./contexts/PillStyleContext"
// LoggingProvider removed - using unified logger from init-logger.ts
import { LineSettingsProvider } from "./contexts/LineSettingsContext"
import { RecentPagesProvider } from "./contexts/RecentPagesContext"
import { TokenIncrementProvider } from "./contexts/TokenIncrementContext"
import { TokenBalanceProvider } from "./contexts/TokenBalanceContext"

import { ThemeProvider } from "./providers/ThemeProvider"
import { MultiAuthProvider } from "./providers/MultiAuthProvider"
import { CurrentAccountProvider } from "./providers/CurrentAccountProvider"
import { NotificationProvider } from "./providers/NotificationProvider"
import { MobileProvider } from "./providers/MobileProvider"
import { AdminStateSimulatorProvider } from "./providers/AdminStateSimulatorProvider"
import { LogRocketProvider } from "./providers/LogRocketProvider"
import GlobalNavigation from "./components/layout/GlobalNavigation"
import AdminStateSimulatorGuard from "./components/admin/AdminStateSimulatorGuard"

export default function RootLayout({
  children}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextJSErrorBoundary>
          <ErrorBoundary name="root">
            <GlobalErrorHandler />
            <ThemeProvider>
              <LogRocketProvider>
                <MultiAuthProvider>
                  <CurrentAccountProvider>
                    <AdminStateSimulatorProvider>
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
                                        <AdminStateSimulatorGuard />
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
                    </AdminStateSimulatorProvider>
                  </CurrentAccountProvider>
                </MultiAuthProvider>
              </LogRocketProvider>
            </ThemeProvider>
          </ErrorBoundary>
        </NextJSErrorBoundary>
      </body>
    </html>
  )
}