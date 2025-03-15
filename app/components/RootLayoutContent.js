"use client";
import { useContext, useEffect, useState, useCallback } from "react";
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

  console.log('RootLayoutContent render:', {
    user: user ? 'exists' : 'null',
    loading,
    pathname,
    isNavigating,
    routerReady: !!router
  });

  const safeNavigate = useCallback(async (path) => {
    console.log('Attempting safe navigation to:', path);
    
    if (!router || typeof router.push !== 'function') {
      console.log('Router not ready, deferring navigation');
      return;
    }

    try {
      await router.push(path);
    } catch (error) {
      console.error('Navigation failed:', error);
      if (typeof window !== 'undefined') {
        window.location.href = path;
      }
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;
    let navigationTimeout;

    const handleNavigation = async () => {
      if (!mounted || isNavigating || loading || !pathname || !router) {
        return;
      }

      try {
        const isAuthPath = pathname.includes('/auth/');
        const shouldRedirectToHome = user && isAuthPath;
        const shouldRedirectToLogin = !user && !isAuthPath;

        if (shouldRedirectToHome) {
          setIsNavigating(true);
          await safeNavigate('/');
        } else if (shouldRedirectToLogin) {
          setIsNavigating(true);
          await safeNavigate('/auth/login');
        }
      } catch (error) {
        console.error('Navigation error:', error);
      } finally {
        if (mounted) {
          navigationTimeout = setTimeout(() => {
            if (mounted) {
              setIsNavigating(false);
            }
          }, 300);
        }
      }
    };

    handleNavigation();

    return () => {
      mounted = false;
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
    };
  }, [user, loading, pathname, router, safeNavigate, isNavigating]);

  if (loading || isNavigating) {
    console.log('Rendering loading state:', { loading, isNavigating });
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