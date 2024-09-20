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
const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LoggingProvider>
        <GAProvider>
          <ThemeProvider>
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
                        </MobileProvider>
                      </PortfolioProvider>
                    </CommunityProvider>
                  </GroupsProvider>
                </DataProvider>
              </AuthProvider>
            </DrawerProvider>
          </ThemeProvider>
        </GAProvider>
        </LoggingProvider>
      </body>
    </html>
  );
}
