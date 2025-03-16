"use client";

import { ThemeProvider } from "./providers/ThemeProvider";
import { Toaster } from "sonner";
import { AuthProvider } from "./providers/AuthProvider";
import { LoggingProvider } from "./providers/LoggingProvider";
import { Drawer } from "./components/Drawer";
import { DrawerProvider } from "./providers/DrawerProvider";
import { MobileProvider } from "./providers/MobileProvider";

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
          <MobileProvider>
            <DrawerProvider>
              <Drawer />
              <main className="min-h-screen">
                {children}
              </main>
              <Toaster />
            </DrawerProvider>
          </MobileProvider>
        </LoggingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
} 