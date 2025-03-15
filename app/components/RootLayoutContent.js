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
    
    try {
      if (typeof window !== 'undefined') {
        // First try using the router
        if (router && typeof router.replace === 'function') {
          console.log('Using Next.js router for navigation');
          await router.replace(path);
        } else {
          // Fallback to window.location
          console.log('Falling back to window.location');
          window.location.href = path;
        }
      }
    } catch (error) {
      console.error('Safe navigation failed:', error);
      // Final fallback
      if (typeof window !== 'undefined') {
        window.location.href = path;
      }
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;
    let navigationTimeout;

    console.log('Navigation effect triggered:', {
      mounted,
      user: user ? 'exists' : 'null',
      loading,
      pathname,
      isNavigating,
      routerReady: !!router
    });

    const handleNavigation = async () => {
      try {
        // Clear any existing navigation timeouts
        if (navigationTimeout) {
          clearTimeout(navigationTimeout);
        }

        console.log('handleNavigation started:', {
          isNavigating,
          loading,
          mounted,
          pathname
        });

        if (isNavigating || loading) {
          console.log('Navigation skipped:', { isNavigating, loading });
          return;
        }

        if (!mounted) {
          console.log('Navigation aborted: component unmounted');
          return;
        }

        if (!loading) {
          console.log('Checking navigation conditions:', {
            hasUser: !!user,
            pathname,
            isAuthPath: pathname?.includes('/auth/'),
            shouldRedirectToHome: !!user && pathname?.includes('/auth/'),
            shouldRedirectToLogin: !user && pathname && !pathname.includes('/auth/')
          });

          if (user && pathname?.includes('/auth/')) {
            console.log('Redirecting to home...');
            setIsNavigating(true);
            await safeNavigate('/');
          } else if (!user && pathname && !pathname.includes('/auth/')) {
            console.log('Redirecting to login...');
            setIsNavigating(true);
            await safeNavigate('/auth/login');
          }
        }
      } catch (error) {
        console.error('Navigation error details:', {
          error,
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
          navigationState: {
            isNavigating,
            loading,
            pathname,
            hasUser: !!user,
            routerReady: !!router
          }
        });
      } finally {
        if (mounted) {
          // Add a small delay before resetting navigation state
          navigationTimeout = setTimeout(() => {
            if (mounted) {
              console.log('Resetting navigation state');
              setIsNavigating(false);
            }
          }, 100);
        }
      }
    };

    handleNavigation();

    return () => {
      console.log('Navigation effect cleanup - unmounting');
      mounted = false;
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
    };
  }, [user, loading, pathname, safeNavigate]);

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