"use client";

import { ThemeProvider } from "../providers/ThemeProvider";
import { AuthProvider } from "../providers/AuthProvider";
import { AppProvider } from "../providers/AppProvider";
import { DataProvider } from "../providers/DataProvider";
import { AnalyticsProvider } from "../providers/AnalyticsProvider";
import GAProvider from "../providers/GAProvider";
import { ToastProvider } from "../providers/ToastProvider";
import { PillStyleProvider } from "../contexts/PillStyleContext";
import { LoggingProvider } from "../providers/LoggingProvider";
import { Drawer } from "../components/Drawer";
import { DrawerProvider } from "../providers/DrawerProvider";
import { MobileProvider } from "../providers/MobileProvider";
import { PortfolioProvider } from "../providers/PortfolioProvider";
import { RecentPagesProvider } from "../contexts/RecentPagesContext";
import { LineSettingsProvider } from "../contexts/LineSettingsContext";
import { ActivityFilterProvider } from "../contexts/ActivityFilterContext";
import { AccentColorProvider } from "../contexts/AccentColorContext";
import { MultiAccountProvider } from "../providers/MultiAccountProvider";
import { NotificationProvider } from "../providers/NotificationProvider";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

// Dynamically import components with no SSR
const WindsurfOverlay = dynamic(() => import('../components/WindsurfOverlay'), {
  ssr: false
});

const UsernameWarningBanner = dynamic(() => import('../components/UsernameWarningBanner'), {
  ssr: false
});

const UsernameEnforcementBanner = dynamic(() => import('../components/UsernameEnforcementBanner'), {
  ssr: false
});

export default function ClientWrapper({ children }) {
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
                <AppProvider>
                  <AnalyticsProvider>
                    <GAProvider>
                      <ToastProvider>
                        <PillStyleProvider>
                          <NotificationProvider>
                            <PortfolioProvider>
                              <RecentPagesProvider>
                                <ActivityFilterProvider>
                                  <MobileProvider>
                                    <DrawerProvider>
                                      <LineSettingsProvider>
                                        <Drawer />
                                        <div className="flex flex-col min-h-screen bg-background pb-8">
                                          {!isAuthPage && <UsernameWarningBanner />}
                                          {!isAuthPage && <UsernameEnforcementBanner />}
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
                          </NotificationProvider>
                        </PillStyleProvider>
                      </ToastProvider>
                    </GAProvider>
                  </AnalyticsProvider>
                </AppProvider>
              </AuthProvider>
            </MultiAccountProvider>
          </DataProvider>
        </LoggingProvider>
      </AccentColorProvider>
    </ThemeProvider>
  );
}
