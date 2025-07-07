import React from "react"
import "./globals.css"
import ErrorBoundary from "./components/utils/ErrorBoundary"
import NextJSErrorBoundary, { GlobalErrorHandler } from "./components/utils/NextJSErrorHandler"

import SessionAuthInitializer from "./components/auth/SessionAuthInitializer"
// SessionZustandBridge removed - functionality integrated into hybrid session system
import { DataProvider } from "./providers/DataProvider"
import { DateFormatProvider } from "./contexts/DateFormatContext"
import { AccentColorProvider } from "./contexts/AccentColorContext"
import { PillStyleProvider } from "./contexts/PillStyleContext"
import { LoggingProvider } from "./providers/LoggingProvider"
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
            <LoggingProvider>
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
                                          <SessionAuthInitializer>
                                        <GlobalNavigation>
                                          {children}
                                        </GlobalNavigation>
                                        <AdminStateSimulatorGuard />
                                          </SessionAuthInitializer>
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
            </LoggingProvider>
          </ThemeProvider>
          </ErrorBoundary>
        </NextJSErrorBoundary>
      </body>
    </html>
  )
}