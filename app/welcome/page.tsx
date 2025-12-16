"use client";

import React from 'react';
import { useAuth } from '../providers/AuthProvider';
import LandingPage from '../components/landing/LandingPage';

export default function WelcomePage() {
  const { isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-muted rounded-md" />
        </div>
      </div>
    );
  }

  // Show landing page for both logged in and logged out users
  // LandingPage component handles the different states internally
  return <LandingPage showReferralSection={true} />;
}
