"use client";
import { useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthContext } from "../providers/AuthProvider";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "react-hot-toast";
import { Drawer } from "./Drawer";

export function RootLayoutContent({ children }) {
  const { user, loading, error } = useContext(AuthContext);
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  // Handle navigation based on auth state
  useEffect(() => {
    if (loading || !pathname || !router || isNavigating) return;

    const isAuthPath = pathname.includes('/auth/');
    
    // Only navigate if we need to
    if ((user && isAuthPath) || (!user && !isAuthPath)) {
      setIsNavigating(true);
      
      const path = user ? '/' : '/auth/login';
      const timeoutId = setTimeout(() => {
        router.push(path).finally(() => {
          setIsNavigating(false);
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [user, loading, pathname, router, isNavigating]);

  // Show loading state
  if (loading || isNavigating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show error state if there's an auth error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">
          An error occurred. Please try refreshing the page.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-row">
        <div className="flex flex-col w-full">
          {children}
        </div>
      </div>
      <Drawer />
      <Analytics />
      <SpeedInsights />
      <Toaster />
    </>
  );
} 