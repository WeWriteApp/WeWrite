"use client";

import { ThemeProvider } from "./providers/ThemeProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { LoggingProvider } from "./providers/LoggingProvider";
import { Drawer } from "./components/Drawer";
import { DrawerProvider } from "./providers/DrawerProvider";
import { MobileProvider } from "./providers/MobileProvider";
import { DataProvider } from "./providers/DataProvider";
import { PortfolioProvider } from "./providers/PortfolioProvider";
import { RecentPagesProvider } from "./contexts/RecentPagesContext";
import { GADebugger } from "./utils/ga-debug";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

// Dynamically import WindsurfOverlay with no SSR
const WindsurfOverlay = dynamic(() => import('./components/WindsurfOverlay'), { 
  ssr: false 
});

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth/');

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <LoggingProvider>
          <DataProvider>
            <PortfolioProvider>
              <RecentPagesProvider>
                <MobileProvider>
                  <DrawerProvider>
                    <Drawer />
                    <div className="flex flex-col min-h-screen bg-background pb-8">
                      <main className="flex-grow">
                        {children}
                      </main>
                    </div>
                    {process.env.NODE_ENV === 'development' && (
                      <>
                        {/* <GADebugger /> */}
                        <WindsurfOverlay />
                      </>
                    )}
                  </DrawerProvider>
                </MobileProvider>
              </RecentPagesProvider>
            </PortfolioProvider>
          </DataProvider>
        </LoggingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}