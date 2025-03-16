import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "./providers/ThemeProvider";
import { Toaster } from "sonner";
import { AuthProvider } from "./providers/AuthProvider";
import { LoggingProvider } from "./providers/LoggingProvider";
import { Drawer } from "./components/Drawer";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "WeWrite",
  description: "Write together",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
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
      </body>
    </html>
  );
}
