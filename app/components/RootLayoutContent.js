"use client";
import { useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthContext } from "../providers/AuthProvider";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "react-hot-toast";
import { Drawer } from "./Drawer";

export function RootLayoutContent({ children }) {
  const { user, loading } = useContext(AuthContext);
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    let mounted = true;

    const handleNavigation = async () => {
      try {
        // Don't navigate if we're already navigating or loading
        if (isNavigating || loading) return;

        // Only navigate if the component is still mounted
        if (!mounted) return;

        console.log('Navigation check:', { user, loading, pathname, isNavigating });

        if (!loading) {
          if (user && pathname?.includes('/auth/')) {
            setIsNavigating(true);
            await router.replace('/');
          } else if (!user && pathname && !pathname.includes('/auth/')) {
            setIsNavigating(true);
            await router.replace('/auth/login');
          }
        }
      } catch (error) {
        console.error('Navigation error:', error);
      } finally {
        if (mounted) {
          setIsNavigating(false);
        }
      }
    };

    handleNavigation();

    return () => {
      mounted = false;
    };
  }, [user, loading, pathname, router, isNavigating]);

  // Show loading state while navigating or loading auth state
  if (loading || isNavigating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
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