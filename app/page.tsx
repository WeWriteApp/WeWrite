"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './providers/AuthProvider';
import { ActivityFilterProvider } from './contexts/ActivityFilterContext';
import LandingPage from './components/landing/LandingPage';
import Home from './components/features/Home';
// import { NavigationOptimizationDemo } from './components/examples/NavigationOptimizationDemo'; // Temporarily disabled

export default function HomePage() {
  console.log('🔴 HomePage: Component rendering');
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [authRedirectPending, setAuthRedirectPending] = useState(false);

  // Note: Email verification modal is now shown in Home component for logged-in users
  // Real unverified users will see the full-screen modal that blocks access

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

  // Debug logging for authentication state
  console.log('🔵 HomePage Auth State (render):', {
    mounted,
    isLoading,
    isAuthenticated,
    hasUser: !!user,
    userId: user?.uid,
    authRedirectPending
  });

  useEffect(() => {
    console.log('🔵 HomePage Auth State (useEffect):', {
      mounted,
      isLoading,
      isAuthenticated,
      hasUser: !!user,
      userId: user?.uid,
      authRedirectPending
    });
  }, [mounted, isLoading, isAuthenticated, user, authRedirectPending]);

  // Show progressive loading state during hydration, authentication loading, or pending redirect
  if (!mounted || isLoading || authRedirectPending) {
    return (
      <div className="min-h-screen bg-background">
        {/* Show app structure immediately */}
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

  // Show home for authenticated users, landing page for others
  return isAuthenticated ? (
    <ActivityFilterProvider>
      <Home />
    </ActivityFilterProvider>
  ) : (
    <LandingPage />
  );
}