import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers/AuthProvider";
import { DataProvider } from "./providers/DataProvider";
import { MobileProvider } from "./providers/MobileProvider";
import { NavProvider } from "./providers/NavProvider";
import { PortfolioProvider } from "./providers/PortfolioProvider";
import { DrawerProvider } from "./providers/DrawerProvider";
import { CommunityProvider } from "./providers/CommunityProvider";
import { Drawer } from "./components/Drawer";
import Header from "./components/Header";
import { GroupsProvider } from "./providers/GroupsProvider";
import { ThemeProvider } from "./providers/ThemeProvider";
import GAProvider from "./providers/GAProvider";
import LoggingProvider from "./providers/LoggingProvider";
import GestureProvider from "./providers/GestureProvider";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Disable pinch-to-zoom */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={inter.className}>
        <LoggingProvider>
        <GAProvider>
          <ThemeProvider>
            <GestureProvider>
            <DrawerProvider>
              <AuthProvider>
                <DataProvider>
                  <GroupsProvider>
                    <CommunityProvider>
                      <PortfolioProvider>
                        <MobileProvider>
                          <Header />
                          <div className="flex flex-row">
                            <div className="flex flex-col w-full">
                              {children}
                            </div>
                          </div>
                          <Drawer />
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
  );
}
