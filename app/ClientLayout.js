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
import { LineSettingsProvider } from "./contexts/LineSettingsContext";
import { ActivityFilterProvider } from "./contexts/ActivityFilterContext";
import { AccentColorProvider } from "./contexts/AccentColorContext";
import { MultiAccountProvider } from "./providers/MultiAccountProvider";
import { GADebugger } from "./utils/ga-debug";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

// Dynamically import components with no SSR
const WindsurfOverlay = dynamic(() => import('./components/WindsurfOverlay'), {
  ssr: false
});

const UsernameWarningBanner = dynamic(() => import('./components/UsernameWarningBanner'), {
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
      <AccentColorProvider>
        <LoggingProvider>
          <DataProvider>
            <MultiAccountProvider>
              <AuthProvider>
                <PortfolioProvider>
                  <RecentPagesProvider>
                    <ActivityFilterProvider>
                      <MobileProvider>
                        <DrawerProvider>
                          <LineSettingsProvider>
                      <Drawer />
                      <div className="flex flex-col min-h-screen bg-background pb-8">
                        {!isAuthPage && <UsernameWarningBanner />}
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
                          </LineSettingsProvider>
                        </DrawerProvider>
                      </MobileProvider>
                    </ActivityFilterProvider>
                  </RecentPagesProvider>
                </PortfolioProvider>
              </AuthProvider>
            </MultiAccountProvider>
          </DataProvider>
        </LoggingProvider>
      </AccentColorProvider>
    </ThemeProvider>
  );
}