"use client";

import { ThemeProvider } from "./providers/ThemeProvider";
import { Toaster } from "sonner";
import { AuthProvider } from "./providers/AuthProvider";
import { LoggingProvider } from "./providers/LoggingProvider";
import { Drawer } from "./components/Drawer";

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
          <Drawer />
          <main className="min-h-screen">
            {children}
          </main>
          <Toaster />
        </LoggingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
} 