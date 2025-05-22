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
import { NotificationProvider } from "./providers/NotificationProvider";
import { RenderControlProvider } from "./providers/RenderControlProvider";
import { GADebugger } from "./utils/ga-debug";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import AdminFeaturesWrapper from "./components/AdminFeaturesWrapper";
import FeatureFlagCookieManager from "./components/FeatureFlagCookieManager";
import { PageTransition } from "./components/ui/page-transition";
import ErrorBoundary from "./components/ErrorBoundary";
import HydrationSafetyWrapper from "./components/HydrationSafetyWrapper";
import { useEffect } from "react";
import { initReloadProtection, getReloadStatus } from "./utils/reload-protection";

// Dynamically import PendingReplyHandler with no SSR
const PendingReplyHandler = dynamic(() => import('./components/PendingReplyHandler'), {
  ssr: false
});


// Dynamically import components with no SSR
const WindsurfOverlay = dynamic(() => import('./components/WindsurfOverlay'), {
  ssr: false
});

const UsernameWarningBanner = dynamic(() => import('./components/UsernameWarningBanner'), {
  ssr: false
});

const UsernameEnforcementBanner = dynamic(() => import('./components/UsernameEnforcementBanner'), {
  ssr: false
});



export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth/');

  // Initialize reload protection to prevent infinite refresh loops
  useEffect(() => {
    initReloadProtection();

    // Log reload status for debugging
    const status = getReloadStatus();
    console.log('Reload protection status:', status);

    // Enhanced logging for potential infinite loop detection
    if (status.potentialLoop) {
      console.warn('Reload protection: Potential infinite loop detected!', status);
    }
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <RenderControlProvider>
        <AccentColorProvider>
          <LoggingProvider>
            <DataProvider>
              <MultiAccountProvider>
                <AuthProvider>
                  <NotificationProvider>
                    <PortfolioProvider>
                      <RecentPagesProvider>
                        <ActivityFilterProvider>
                          <MobileProvider>
                            <DrawerProvider>
                              <LineSettingsProvider>
                                <Drawer />
                                <div className="flex flex-col min-h-screen bg-background pb-8">
                                  {/* Handle pending replies after authentication */}
                                  <PendingReplyHandler />

                                  {!isAuthPage && <UsernameWarningBanner />}
                                  {!isAuthPage && <UsernameEnforcementBanner />}
                                  <FeatureFlagCookieManager />
                                  <main className="flex-grow">
                                    <AdminFeaturesWrapper>
                                      <ErrorBoundary>
                                        <HydrationSafetyWrapper>
                                          <PageTransition enableTransitions={!isAuthPage}>
                                            {children}
                                          </PageTransition>
                                        </HydrationSafetyWrapper>
                                      </ErrorBoundary>
                                    </AdminFeaturesWrapper>
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
                </AuthProvider>
              </MultiAccountProvider>
            </DataProvider>
          </LoggingProvider>
        </AccentColorProvider>
      </RenderControlProvider>
    </ThemeProvider>
  );
}