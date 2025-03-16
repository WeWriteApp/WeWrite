"use client"

import * as React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/providers/AuthProvider"
import { DataProvider } from "@/providers/DataProvider"
import { MobileProvider } from "@/providers/MobileProvider"
import { NavProvider } from "@/providers/NavProvider"
import { PortfolioProvider } from "@/providers/PortfolioProvider"
import { DrawerProvider } from "@/providers/DrawerProvider"
import { CommunityProvider } from "@/providers/CommunityProvider"
import { Drawer } from "@/components/Drawer"
import { GroupsProvider } from "@/providers/GroupsProvider"
import { ThemeProvider } from "@/providers/ThemeProvider"
import GAProvider from "@/providers/GAProvider"
import LoggingProvider from "@/providers/LoggingProvider"
import GestureProvider from "@/providers/GestureProvider"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={inter.className}>
        <LoggingProvider>
          <GAProvider>
            <ThemeProvider defaultTheme="dark" storageKey="wewrite-theme">
              <GestureProvider>
                <DrawerProvider>
                  <AuthProvider>
                    <DataProvider>
                      <GroupsProvider>
                        <CommunityProvider>
                          <PortfolioProvider>
                            <MobileProvider>
                              <div className="flex flex-row">
                                <div className="flex flex-col w-full">
                                  {children}
                                </div>
                              </div>
                              <Drawer>{/* Drawer content */}</Drawer>
                              <Analytics />
                              <SpeedInsights />
                            </MobileProvider>
                          </PortfolioProvider>
                        </CommunityProvider>
                      </GroupsProvider>
                    </DataProvider>
                  </AuthProvider>
                </DrawerProvider>
              </GestureProvider>
            </ThemeProvider>
          </GAProvider>
        </LoggingProvider>
      </body>
    </html>
  )
} 