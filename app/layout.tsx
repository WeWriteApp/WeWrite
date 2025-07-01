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

import { ThemeProvider } from "./providers/ThemeProvider"
import { MultiAuthProvider } from "./providers/MultiAuthProvider"
import { CurrentAccountProvider } from "./providers/CurrentAccountProvider"
import { NotificationProvider } from "./providers/NotificationProvider"
import GlobalNavigation from "./components/layout/GlobalNavigation"

export default function RootLayout({
  children}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <NextJSErrorBoundary>
          <ErrorBoundary name="root">
            <GlobalErrorHandler />
            <ThemeProvider>
            <LoggingProvider>
              <MultiAuthProvider>
                <CurrentAccountProvider>
                  <NotificationProvider>
                    <DataProvider>
                        <DateFormatProvider>
                          <AccentColorProvider>
                            <PillStyleProvider>
                              <LineSettingsProvider>
                                <RecentPagesProvider>
                                  <SessionAuthInitializer />
                                  <GlobalNavigation>
                                    {children}
                                  </GlobalNavigation>
                                </RecentPagesProvider>
                              </LineSettingsProvider>
                            </PillStyleProvider>
                          </AccentColorProvider>
                        </DateFormatProvider>
                    </DataProvider>
                  </NotificationProvider>
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