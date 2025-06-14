"use client";

// Removed Slate patches - no longer needed with SimpleEditor
import MobileBottomNav from "./components/layout/MobileBottomNav";
import { SidebarProvider } from "./components/layout/UnifiedSidebar";
import SidebarLayout from "./components/layout/SidebarLayout";

import { ThemeProvider } from "./providers/ThemeProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { LoggingProvider } from "./providers/LoggingProvider";
import { Drawer } from './components/utils/Drawer';
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
import { TextSelectionProvider } from "./providers/TextSelectionProvider";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import AdminFeaturesWrapper from './components/utils/AdminFeaturesWrapper';
import FeatureFlagCookieManager from "./components/utils/FeatureFlagCookieManager";
import { PageTransition } from "./components/ui/page-transition";
import ErrorBoundary from "./components/utils/ErrorBoundary";
import HydrationSafetyWrapper from "./components/utils/HydrationSafetyWrapper";
import { useScrollToTop } from "./hooks/useScrollRestoration";

// Dynamically import PendingReplyHandler with no SSR
const PendingReplyHandler = dynamic(() => import('./components/utils/PendingReplyHandler'), {
  ssr: false
});

const UsernameWarningBanner = dynamic(() => import('./components/auth/UsernameWarningBanner'), {
  ssr: false
});

const UsernameEnforcementBanner = dynamic(() => import('./components/auth/UsernameEnforcementBanner'), {
  ssr: false
});

const UnverifiedUserBanner = dynamic(() => import('./components/utils/UnverifiedUserBanner'), {
  ssr: false
});





export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth/');
  const isHomePage = pathname === '/';

  // Use scroll restoration hook to ensure pages always start at the top
  useScrollToTop();



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
                                <SidebarProvider>
                                  <SidebarLayout>
                                    <div className="flex flex-col min-h-screen bg-background pb-20 md:pb-8">
                                      {/* Handle pending replies after authentication */}
                                      <PendingReplyHandler />

                                      {!isAuthPage && <UsernameWarningBanner />}
                                      {!isAuthPage && <UsernameEnforcementBanner />}
                                      <FeatureFlagCookieManager />
                                      <main className="flex-grow">
                                        <AdminFeaturesWrapper>
                                          <ErrorBoundary>
                                            <HydrationSafetyWrapper>
                                              <TextSelectionProvider>
                                                <PageTransition enableTransitions={!isAuthPage}>
                                                  {children}
                                                </PageTransition>
                                              </TextSelectionProvider>
                                            </HydrationSafetyWrapper>
                                          </ErrorBoundary>
                                        </AdminFeaturesWrapper>
                                      </main>

                                      {/* Mobile Bottom Navigation */}
                                      {!isAuthPage && <MobileBottomNav />}
                                    </div>
                                  </SidebarLayout>
                                </SidebarProvider>
                                {process.env.NODE_ENV === 'development' && (
                                  <>
                                    {/* <GADebugger /> */}
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