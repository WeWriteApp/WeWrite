"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './providers/AuthProvider';
import { isNativeApp } from './utils/capacitor';

/**
 * Root page - redirects to /welcome (logged out) or /home (logged in)
 * For native Capacitor apps, redirects to /onboarding if not completed
 * This allows for URL-based routing with explicit paths for each state
 */
export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [authRedirectPending, setAuthRedirectPending] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if authentication redirect is pending
    const checkAuthRedirect = () => {
      if (typeof window !== 'undefined') {
        const pending = localStorage.getItem('authRedirectPending');
        setAuthRedirectPending(!!pending);
      }
    };

    checkAuthRedirect();

    // Listen for storage changes to detect when authRedirectPending is cleared
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authRedirectPending') {
        setAuthRedirectPending(!!e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also check periodically in case the storage change event doesn't fire
    const interval = setInterval(checkAuthRedirect, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Perform redirect once auth state is known
  useEffect(() => {
    if (!mounted || isLoading || authRedirectPending) return;

    const native = isNativeApp();

    // Check for native app onboarding
    if (native) {
      const onboardingComplete = localStorage.getItem('wewrite_mobile_onboarding_complete');
      if (onboardingComplete !== 'true') {
        router.replace('/onboarding');
        return;
      }
    }

    if (isAuthenticated) {
      router.replace('/home');
    } else {
      router.replace('/welcome');
    }
  }, [mounted, isAuthenticated, isLoading, authRedirectPending, router]);

  // Show loading skeleton while determining auth state
  return (
    <div className="min-h-screen bg-background">
      <div className="p-5 md:p-4">
        {/* Navigation header skeleton */}
        <div className="flex items-center mb-6">
          <div className="flex-1">
            <div className="h-9 w-20 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="h-8 w-32 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="flex-1 flex justify-end">
            <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
          </div>
        </div>

        {/* Search bar skeleton */}
        <div className="w-full mb-6">
          <div className="h-12 w-full bg-muted rounded-lg animate-pulse" />
        </div>

        {/* Quick actions skeleton */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Content sections skeleton */}
        <div className="space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <div className="h-6 w-40 bg-muted rounded-md animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}