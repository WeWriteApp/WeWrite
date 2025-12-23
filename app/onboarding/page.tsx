"use client";

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { getPlatform, isNativeApp, Platform } from '../utils/capacitor';
import MobileOnboarding from '../components/onboarding/MobileOnboarding';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [platform, setPlatform] = useState<Platform>('web');
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Detect platform
    const detectedPlatform = getPlatform();
    setPlatform(detectedPlatform);

    // Check if onboarding is already complete
    const onboardingComplete = localStorage.getItem('wewrite_mobile_onboarding_complete');

    if (onboardingComplete === 'true') {
      // Already completed onboarding, redirect to home or auth
      if (user) {
        router.replace('/home');
      } else {
        router.replace('/welcome');
      }
      return;
    }

    // If on web and not in preview mode, redirect to welcome page
    if (!isNativeApp()) {
      router.replace('/welcome');
      return;
    }

    setIsChecking(false);
  }, [router, user]);

  const handleOnboardingComplete = () => {
    // Navigate to appropriate page after onboarding
    if (user) {
      router.replace('/home');
    } else {
      router.replace('/auth/login');
    }
  };

  // Show loading while checking
  if (authLoading || isChecking) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Icon name="Loader" className="text-primary" />
      </div>
    );
  }

  return (
    <MobileOnboarding
      platform={platform}
      onComplete={handleOnboardingComplete}
    />
  );
}
