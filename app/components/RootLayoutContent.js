"use client";
import { useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthContext } from "../providers/AuthProvider";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "react-hot-toast";
import { Drawer } from "./Drawer";

const NAVIGATION_TIMEOUT = 3000; // 3 seconds timeout for navigation

export function RootLayoutContent({ children }) {
  const { user, loading, error } = useContext(AuthContext);
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationError, setNavigationError] = useState(null);

  // Handle navigation based on auth state
  useEffect(() => {
    let timeoutId = null;
    let mounted = true;
    
    // Don't navigate if we're loading or missing essential info
    if (loading || !pathname || isNavigating) return;

    const isAuthPath = pathname.includes('/auth/');
    
    // Only navigate if we need to
    if ((user && isAuthPath) || (!user && !isAuthPath)) {
      setIsNavigating(true);
      setNavigationError(null);
      
      const path = user ? '/' : '/auth/login';
      
      // Set a timeout to prevent infinite navigation
      timeoutId = setTimeout(() => {
        if (mounted) {
          setIsNavigating(false);
          setNavigationError('Navigation timeout - please try refreshing the page');
        }
      }, NAVIGATION_TIMEOUT);

      // Use window.location for more reliable navigation
      try {
        window.location.href = path;
      } catch (error) {
        console.error('Navigation error:', error);
        if (mounted) {
          setIsNavigating(false);
          setNavigationError('Failed to navigate - please try refreshing the page');
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user, loading, pathname, isNavigating]);

  // Show loading state
  if (loading || isNavigating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        {isNavigating && (
          <div className="text-sm text-muted-foreground">
            Redirecting...
          </div>
        )}
      </div>
    );
  }

  // Show error states
  if (error || navigationError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-center">
          <p>{error || navigationError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Refresh Page
          </button>
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