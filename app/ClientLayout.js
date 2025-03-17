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
                  <Drawer />
                  <main className="min-h-screen">
                    {children}
                  </main>
                  <Toaster 
                    position="top-center"
                    toastOptions={{
                      style: {
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        border: '1px solid var(--border)',
                      },
                    }}
                    className="z-[100]"
                  />
                </DrawerProvider>
              </MobileProvider>
            </PortfolioProvider>
          </DataProvider>
        </LoggingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
} 