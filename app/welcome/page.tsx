"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import LandingPage from '../components/landing/LandingPage';
import { isNativeApp } from '../utils/capacitor';

export default function WelcomePage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [checkingNative, setCheckingNative] = useState(true);

  useEffect(() => {
    // For native apps, check if onboarding is complete
    // If not, redirect to onboarding instead of showing welcome
    const checkNativeOnboarding = () => {
      const native = isNativeApp();

      if (native) {
        const onboardingComplete = localStorage.getItem('wewrite_mobile_onboarding_complete');

        if (onboardingComplete !== 'true') {
          router.replace('/onboarding');
          return;
        }

        // If authenticated on native and onboarding is complete, go to home
        if (isAuthenticated) {
          router.replace('/home');
          return;
        }
      }

      setCheckingNative(false);
    };

    if (!isLoading) {
      checkNativeOnboarding();
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading state while checking auth or native status
  if (isLoading || checkingNative) {
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
  // isPreviewMode=true enables the preview banner and shows Sign In/Sign Up buttons for authenticated users
  return <LandingPage showReferralSection={true} isPreviewMode={true} />;
}
