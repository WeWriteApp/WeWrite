"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';

// Swipeable tabs removed - simplified admin interface
import { db } from "../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '../components/ui/use-toast';
import { usePWA } from '../providers/PWAProvider';
import Link from 'next/link';
// UserManagement import removed - users tab deleted

import { isAdmin } from '../utils/isAdmin';
import { useAdminData } from '../providers/AdminDataProvider';

interface User {
  id: string;
  email: string;
  username?: string;
  isAdmin?: boolean;
}



export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { resetBannerState } = usePWA();
  const { adminFetch, isHydrated } = useAdminData();
  // Tab state removed - simplified admin interface

  // Removed user management state - users tab deleted

  // Testing tools state - initialize from localStorage immediately to prevent flash
  const [showPWABanner, setShowPWABanner] = useState(false);
  const [showUnverifiedEmailBanner, setShowUnverifiedEmailBanner] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wewrite_admin_email_banner_override') === 'true';
    }
    return false;
  });
  const [noSubscriptionMode, setNoSubscriptionMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wewrite_admin_no_subscription_mode') === 'true';
    }
    return false;
  });
  const [earningsTestingMode, setEarningsTestingMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wewrite_admin_earnings_testing_mode') === 'true';
    }
    return false;
  });

  // Writing ideas state
  const [writingIdeasCount, setWritingIdeasCount] = useState<number | null>(null);

  // Load writing ideas count
  useEffect(() => {
    const loadWritingIdeasCount = async () => {
      try {
        console.log('Loading writing ideas count...');
        const response = await adminFetch('/api/admin/writing-ideas');
        console.log('Writing ideas API response status:', response.status);

        if (!response.ok) {
          // Do not block the page or spam console if this endpoint is restricted in dev
          if (response.status === 401 || response.status === 403) {
            setWritingIdeasCount(0);
            return;
          }
          console.error('Writing ideas API failed:', response.status, response.statusText);
          setWritingIdeasCount(0);
          return;
        }

        const result = await response.json();
        console.log('Writing ideas API result:', result);

        if (result.success) {
          setWritingIdeasCount(result.data.total || 0);
          console.log('Set writing ideas count to:', result.data.total || 0);
        } else {
          console.error('Writing ideas API returned error:', result.error);
          setWritingIdeasCount(0);
        }
      } catch (error) {
        console.error('Error loading writing ideas count:', error);
        setWritingIdeasCount(0);
      }
    };

    // Only load if user is authenticated, admin, and hydrated
    if (user && !authLoading && isHydrated) {
      loadWritingIdeasCount();
    }
  }, [user, authLoading, isHydrated, adminFetch]);

  // Handle email banner override changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (showUnverifiedEmailBanner) {
        localStorage.setItem('wewrite_admin_email_banner_override', 'true');
      } else {
        localStorage.removeItem('wewrite_admin_email_banner_override');
      }

      // Dispatch custom event to notify BannerProvider of changes
      window.dispatchEvent(new CustomEvent('bannerOverrideChange'));
    }
  }, [showUnverifiedEmailBanner]);

  // Handle paywall testing mode changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (noSubscriptionMode) {
        localStorage.setItem('wewrite_admin_no_subscription_mode', 'true');
      } else {
        localStorage.removeItem('wewrite_admin_no_subscription_mode');
      }

      // Dispatch custom event to notify subscription contexts of changes
      window.dispatchEvent(new CustomEvent('adminPaywallOverrideChange'));
    }
  }, [noSubscriptionMode]);

  // Handle earnings testing mode changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (earningsTestingMode) {
        localStorage.setItem('wewrite_admin_earnings_testing_mode', 'true');
      } else {
        localStorage.removeItem('wewrite_admin_earnings_testing_mode');
      }

      // Dispatch custom event to notify earnings contexts of changes
      window.dispatchEvent(new CustomEvent('adminEarningsTestingChange'));
    }
  }, [earningsTestingMode]);

  // Platform fee revenue state
  const [platformFeeData, setPlatformFeeData] = useState<any[]>([]);
  const [platformFeeStats, setPlatformFeeStats] = useState({
    totalPlatformRevenue: 0,
    monthlyPlatformRevenue: 0,
    platformFeeGrowth: 0,
    averageFeePerPayout: 0
  });
  const [usersCount, setUsersCount] = useState<number | null>(null);


  // Feature flags have been removed - all features are now always enabled

  // Filter state management removed - simplified admin interface

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && user) {
      if (!isAdmin(user.email)) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin');
    }
  }, [user, authLoading, router]);

  // Admin user management functions removed - users tab deleted

  // Platform fee data loading removed - now handled by admin dashboard

  // Feature flags have been removed - no loading needed

  // User search function removed - users tab deleted

  // Admin status toggle function removed - users tab deleted

  // Feature flags have been removed - no toggle function needed

  // Handle triggering PWA alert
  const handleTriggerPWAAlert = () => {
    resetBannerState();
    toast({
      title: 'Success',
      description: 'PWA installation banner will appear on next page load',
      variant: 'default'
    });
  };

  // Load user count for quick overview
  useEffect(() => {
    const loadUserCount = async () => {
      try {
        const res = await adminFetch('/api/admin/users?countOnly=true');
        const data = await res.json();
        if (res.ok && data?.total !== undefined) {
          setUsersCount(data.total);
        } else {
          setUsersCount(null);
        }
      } catch {
        setUsersCount(null);
      }
    };
    if (user && !authLoading && isHydrated) {
      loadUserCount();
    }
  }, [user, authLoading, isHydrated, adminFetch]);

  // Feature flags have been removed

  // Enhanced loading and error states
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Icon name="Loader" className="text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin(user.email)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-5xl">
      <header className="border-b-subtle bg-background px-4 py-3 mb-6 flex items-center justify-between lg:border-b-0 lg:px-0 lg:py-2">
        <div>
          <h1 className="text-3xl font-bold leading-tight">Admin Panel</h1>
          <p className="text-muted-foreground">
            Administrative tools and dashboard access
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/')}
          className="h-10 w-10"
        >
          <Icon name="X" size={20} />
        </Button>
      </header>

      {/* Simplified admin interface - no tabs needed */}
      <div className="space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Admin Tools</h2>
          <p className="text-muted-foreground">Administrative dashboard and testing utilities</p>
        </div>

          {/* Platform fee revenue moved to admin dashboard */}

          {/* Top admin tools - Product KPIs and Monthly Financials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Admin Product KPIs */}
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Admin Product KPIs</h3>
                <Icon name="BarChart3" size={20} className="text-primary" />
              </div>
              <span className="text-sm text-muted-foreground mb-4">
                View comprehensive analytics including user registrations, page creation metrics, platform fee revenue, and sharing statistics.
              </span>
              <div className="mt-auto">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/dashboard')}
                >
                  <Icon name="BarChart3" size={16} />
                  Open Product KPIs
                </Button>
              </div>
            </div>

            {/* Monthly Financials */}
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Monthly Financials</h3>
                <Icon name="Calendar" size={20} className="text-primary" />
              </div>
              <span className="text-sm text-muted-foreground mb-4">
                View current month fund status, creator obligations, Stripe balance breakdown, and historical monthly financial data with charts.
              </span>
              <div className="mt-auto">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/monthly-financials')}
                >
                  <Icon name="Calendar" size={16} />
                  Open Monthly Financials
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Users</h3>
                <Icon name="Users" size={16} className="text-primary" />
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                {usersCount !== null ? `${usersCount} users total` : 'User count unavailable'}
              </span>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/users')}
                >
                  <Icon name="Users" size={16} />
                  View users
                </Button>
              </div>
            </div>

            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Feature Flags</h3>
                <Icon name="Flag" size={16} className="text-primary" />
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                View and manage gated features (e.g., line numbers). Admin-only controls.
              </span>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/feature-flags')}
                >
                  <Icon name="Flag" size={16} />
                  Open feature flags
                </Button>
              </div>
            </div>

            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">PWA Testing</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Control PWA installation banner visibility for testing.
              </span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Show PWA banner</span>
                <Switch
                  checked={showPWABanner}
                  onCheckedChange={(checked) => {
                    setShowPWABanner(checked);
                    if (checked) {
                      handleTriggerPWAAlert();
                    }
                  }}
                />
              </div>
            </div>

            {/* Email Not Verified Testing */}
            <div
              className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors cursor-pointer text-left w-full"
              onClick={() => {
                const newValue = !showUnverifiedEmailBanner;
                setShowUnverifiedEmailBanner(newValue);
                // Clear dismissal flag when turning on so blocking screen shows first
                if (newValue && typeof window !== 'undefined') {
                  localStorage.removeItem('wewrite_email_verification_dismissed');
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const newValue = !showUnverifiedEmailBanner;
                  setShowUnverifiedEmailBanner(newValue);
                  if (newValue && typeof window !== 'undefined') {
                    localStorage.removeItem('wewrite_email_verification_dismissed');
                  }
                }
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Email Not Verified</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Simulate unverified email state. When enabled, shows the blocking "Verify Your Email" screen first. Click "Do this later" to dismiss and see the email banner instead. Navigate to home page to test.
              </span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Simulate unverified email</span>
                <Switch
                  checked={showUnverifiedEmailBanner}
                  onCheckedChange={(checked) => {
                    setShowUnverifiedEmailBanner(checked);
                    // Clear dismissal flag when turning on so blocking screen shows first
                    if (checked && typeof window !== 'undefined') {
                      localStorage.removeItem('wewrite_email_verification_dismissed');
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>





            {/* Paywall Testing */}
            <div
              className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors cursor-pointer text-left w-full"
              onClick={() => setNoSubscriptionMode(!noSubscriptionMode)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setNoSubscriptionMode(!noSubscriptionMode)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Paywall Testing</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Force all paywalls to show for testing purposes. When enabled, all subscription checks will return false, triggering paywalls even for active subscribers.
              </span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">No subscription (force paywalls)</span>
                <Switch
                  checked={noSubscriptionMode}
                  onCheckedChange={setNoSubscriptionMode}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Earnings Testing */}
            <div
              className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors cursor-pointer text-left w-full"
              onClick={() => setEarningsTestingMode(!earningsTestingMode)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setEarningsTestingMode(!earningsTestingMode)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Earnings Testing</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Simulate fake earnings to test earnings display states. When enabled, shows mock earnings data in the financial header ($127.50 pending, $89.25 available).
              </span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Show fake earnings</span>
                <Switch
                  checked={earningsTestingMode}
                  onCheckedChange={setEarningsTestingMode}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            {/* Design System */}
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Design System</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Interactive showcase of all WeWrite components with their states and documentation
              </span>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/design-system')}
                >
                  <Icon name="Palette" size={16} />
                  View Design System
                </Button>
              </div>
            </div>

            {/* System Diagram */}
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">System Diagram</h3>
                <Icon name="Network" size={16} className="text-primary" />
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Visual overview of system architecture, component layers, and data flows for architectural decisions.
              </span>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/system-diagram')}
                >
                  <Icon name="Network" size={16} />
                  View System Diagram
                </Button>
              </div>
            </div>

            {/* Background Images Management */}
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Background Images</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Manage default background images available to all users. Upload, delete, and reorder images.
              </span>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/background-images')}
                >
                  <Icon name="Image" size={16} className="" />
                  Manage Backgrounds
                </Button>
              </div>
            </div>

            {/* OpenGraph Images */}
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">OpenGraph Images</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Preview all OG image designs used when WeWrite pages are shared on social media.
              </span>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/opengraph-images')}
                >
                  <Icon name="Image" size={16} className="" />
                  View OG Images
                </Button>
              </div>
            </div>

            {/* Financial Test Harness */}
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Financial Tests</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Admin-only simulation of earnings and payouts (test-mode only, no live funds touched).
              </span>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/financial-tests')}
                >
                  <Icon name="DollarSign" size={16} />
                  Open Financial Tests
                </Button>
              </div>
            </div>

            {/* Writing Ideas Management */}
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Writing Ideas</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Manage writing ideas that appear when users create new pages. Currently: {writingIdeasCount !== null ? `${writingIdeasCount} ideas` : 'Loading...'}
              </span>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/writing-ideas')}
                >
                  <Icon name="FileText" size={16} />
                  Manage Writing Ideas
                </Button>
              </div>
            </div>

            {/* Notifications */}
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Notifications</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Manage email, in-app, and push notifications for all user communication.
              </span>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/notifications')}
                >
                  <Icon name="Mail" size={16} />
                  Manage Notifications
                </Button>
              </div>
            </div>

            {/* Capacitor App Onboarding Preview */}
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Capacitor App Onboarding</h3>
                <Icon name="TabletSmartphone" size={16} className="text-primary" />
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Preview and test the iOS and Android mobile app onboarding flows without needing simulators.
              </span>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/mobile-onboarding')}
                >
                  <Icon name="TabletSmartphone" size={16} />
                  Preview Onboarding
                </Button>
              </div>
            </div>

            {/* Onboarding Tutorial */}
            <div className="wewrite-card flex flex-col hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Onboarding Tutorial</h3>
                <Icon name="BookOpen" size={16} className="text-primary" />
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Test and preview the guided onboarding experience. Start the tutorial to see tooltips guiding new users.
              </span>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/onboarding-tutorial')}
                >
                  <Icon name="BookOpen" size={16} />
                  Test Tutorial
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
