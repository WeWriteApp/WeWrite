"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from './providers/AuthProvider';
import { ActivityFilterProvider } from './contexts/ActivityFilterContext';
import LandingPage from './components/landing/LandingPage';
import Home from './components/features/Home';

export default function HomePage() {
  console.log('🔴 HomePage: Component rendering');
  const { user, isAuthenticated, isLoading } = useAuth();
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

  // Debug logging for authentication state
  console.log('🔵 HomePage Auth State (render):', {
    mounted,
    isLoading,
    isAuthenticated,
    hasCurrentAccount: !!user,
    currentAccountUid: user?.uid,
    authRedirectPending
  });

  useEffect(() => {
    console.log('🔵 HomePage Auth State (useEffect):', {
      mounted,
      isLoading,
      isAuthenticated,
      hasCurrentAccount: !!user,
      currentAccountUid: user?.uid,
      authRedirectPending
    });
  }, [mounted, isLoading, isAuthenticated, user, authRedirectPending]);

  // Show loading state during hydration, authentication loading, or pending redirect
  if (!mounted || isLoading || authRedirectPending) {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="loader loader-md"></div>
            <p className="text-muted-foreground mt-3">
              {authRedirectPending ? 'Signing you in...' : 'Loading WeWrite...'}
            </p>
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