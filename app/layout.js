import { Metadata } from "next";
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

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "WeWrite",
  description: "",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <DrawerProvider>
          <AuthProvider>
            <DataProvider>
              <CommunityProvider>
                <PortfolioProvider>
                  <MobileProvider>
                    <NavProvider>
                      <div className="flex flex-row">
                        <div className="flex flex-col w-full">{children}</div>
                      </div>
                      <Drawer />
                    </NavProvider>
                  </MobileProvider>
                </PortfolioProvider>
              </CommunityProvider>
            </DataProvider>
          </AuthProvider>
        </DrawerProvider>
      </body>
    </html>
  );
}
