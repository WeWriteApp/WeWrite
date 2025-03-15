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
      if (typeof window !== 'undefined' && router) {
        if (typeof router.push === 'function') {
          console.log('Using Next.js router push for navigation');
          await router.push(path);
        } else if (typeof router.replace === 'function') {
          console.log('Using Next.js router replace for navigation');
          await router.replace(path);
        } else {
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

        // Don't proceed if we're already navigating or loading
        if (isNavigating || loading) {
          console.log('Navigation skipped:', { isNavigating, loading });
          return;
        }

        // Don't proceed if component is unmounted
        if (!mounted) {
          console.log('Navigation aborted: component unmounted');
          return;
        }

        // Only proceed with navigation checks if we're not loading
        if (!loading && pathname) {
          console.log('Checking navigation conditions:', {
            hasUser: !!user,
            pathname,
            isAuthPath: pathname.includes('/auth/'),
            shouldRedirectToHome: !!user && pathname.includes('/auth/'),
            shouldRedirectToLogin: !user && !pathname.includes('/auth/')
          });

          // Handle authenticated user trying to access auth pages
          if (user && pathname.includes('/auth/')) {
            console.log('Redirecting to home...');
            setIsNavigating(true);
            await safeNavigate('/');
          } 
          // Handle unauthenticated user trying to access protected pages
          else if (!user && !pathname.includes('/auth/')) {
            console.log('Redirecting to login...');
            setIsNavigating(true);
            await safeNavigate('/auth/login');
          }
        }
      } catch (error) {
        console.error('Navigation error:', error);
      } finally {
        if (mounted) {
          // Reset navigation state after a small delay
          navigationTimeout = setTimeout(() => {
            if (mounted) {
              setIsNavigating(false);
            }
          }, 200);
        }
      }
    };

    // Run navigation check
    handleNavigation();

    // Cleanup
    return () => {
      mounted = false;
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
    };
  }, [user, loading, pathname, safeNavigate, router]);

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