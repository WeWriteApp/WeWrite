"use client";

import { ThemeProvider } from "./providers/ThemeProvider";
import { Toaster } from "sonner";
import { AuthProvider } from "./providers/AuthProvider";
import { LoggingProvider } from "./providers/LoggingProvider";
import { Drawer } from "./components/Drawer";
import { DrawerProvider } from "./providers/DrawerProvider";
import { MobileProvider } from "./providers/MobileProvider";
import { DataProvider } from "./providers/DataProvider";
import { PortfolioProvider } from "./providers/PortfolioProvider";
import { UnifiedAnalyticsProvider } from "./providers/UnifiedAnalyticsProvider";

export default function ClientLayout({ children }) {
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
              <MobileProvider>
                <DrawerProvider>
                  <UnifiedAnalyticsProvider>
                    <Drawer />
                    <main className="min-h-screen bg-background">
                      {children}
                    </main>
                    <Toaster />
                  </UnifiedAnalyticsProvider>
                </DrawerProvider>
              </MobileProvider>
            </PortfolioProvider>
          </DataProvider>
        </LoggingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
} 