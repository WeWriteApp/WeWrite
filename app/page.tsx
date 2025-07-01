"use client";

import React, { useEffect, useState } from 'react';
import { useCurrentAccount } from './providers/CurrentAccountProvider';
import LandingPage from './components/landing/LandingPage';
import Dashboard from './components/features/Dashboard';

export default function HomePage() {
  const { currentAccount, isAuthenticated, isLoading } = useCurrentAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Debug logging for authentication state
  useEffect(() => {
    console.log('🔵 HomePage Auth State:', {
      mounted,
      isLoading,
      isAuthenticated,
      hasCurrentAccount: !!currentAccount,
      currentAccountUid: currentAccount?.uid
    });
  }, [mounted, isLoading, isAuthenticated, currentAccount]);

  // Show loading state during hydration or authentication loading
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading WeWrite...</p>
        </div>
      </div>
    );
  }

  // Show dashboard for authenticated users, landing page for others
  return isAuthenticated ? <Dashboard /> : <LandingPage />;
}