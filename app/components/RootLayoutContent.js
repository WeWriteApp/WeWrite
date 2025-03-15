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

  console.log('RootLayoutContent render:', {
    user: user ? 'exists' : 'null',
    loading,
    pathname,
    isNavigating,
    routerReady: !!router
  });

  useEffect(() => {
    let mounted = true;

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
        console.log('handleNavigation started:', {
          isNavigating,
          loading,
          mounted,
          pathname
        });

        // Don't navigate if we're already navigating or loading
        if (isNavigating || loading) {
          console.log('Navigation skipped:', { isNavigating, loading });
          return;
        }

        // Only navigate if the component is still mounted
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
            await router.replace('/');
            console.log('Home redirect complete');
          } else if (!user && pathname && !pathname.includes('/auth/')) {
            console.log('Redirecting to login...');
            setIsNavigating(true);
            await router.replace('/auth/login');
            console.log('Login redirect complete');
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
          console.log('Resetting navigation state');
          setIsNavigating(false);
        }
      }
    };

    handleNavigation();

    return () => {
      console.log('Navigation effect cleanup - unmounting');
      mounted = false;
    };
  }, [user, loading, pathname, router, isNavigating]);

  // Show loading state while navigating or loading auth state
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