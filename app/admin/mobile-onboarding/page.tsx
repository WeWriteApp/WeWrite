"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { X, Smartphone, TabletSmartphone } from 'lucide-react';
import { isAdmin } from '../../utils/isAdmin';
import MobileOnboarding from '../../components/onboarding/MobileOnboarding';

export default function MobileOnboardingPreviewPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && user) {
      if (!isAdmin(user.email)) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/mobile-onboarding');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin(user.email)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-7xl">
        <header className="border-b-subtle bg-background px-4 py-3 mb-6 flex items-center justify-between lg:border-b-0 lg:px-0 lg:py-2">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Capacitor App Onboarding</h1>
            <p className="text-muted-foreground">
              Preview iOS and Android onboarding flows side by side
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin')}
            className="h-10 w-10"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* iOS Preview */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Smartphone className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">iOS Onboarding</h2>
                <p className="text-sm text-muted-foreground">iPhone / iPad experience</p>
              </div>
            </div>
            <div className="border rounded-xl overflow-hidden shadow-lg" style={{ height: '667px', maxHeight: '80vh' }}>
              <MobileOnboarding
                platform="ios"
                onComplete={() => {}}
                isPreview={true}
              />
            </div>
          </div>

          {/* Android Preview */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TabletSmartphone className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Android Onboarding</h2>
                <p className="text-sm text-muted-foreground">Android phone / tablet experience</p>
              </div>
            </div>
            <div className="border rounded-xl overflow-hidden shadow-lg" style={{ height: '667px', maxHeight: '80vh' }}>
              <MobileOnboarding
                platform="android"
                onComplete={() => {}}
                isPreview={true}
              />
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-muted/50">
          <h3 className="font-medium mb-2">About this preview</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>- Click "Continue" to step through the onboarding flow</li>
            <li>- The onboarding resets when you reach the final step</li>
            <li>- iOS uses blue accent colors, Android uses green</li>
            <li>- In the native app, users see this flow before the main app</li>
            <li>- Onboarding state is stored in localStorage as `wewrite_mobile_onboarding_complete`</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
