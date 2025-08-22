"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';

// Swipeable tabs removed - simplified admin interface
import { Search, Users, Settings, Loader, Check, X, Shield, RefreshCw, Smartphone, ChevronLeft, ChevronRight, BarChart3, DollarSign, Eye, Palette, Database } from 'lucide-react';
import { db } from "../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '../components/ui/use-toast';
import { usePWA } from '../providers/PWAProvider';
import Link from 'next/link';
// UserManagement import removed - users tab deleted


import { isAdmin } from '../utils/isAdmin';

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
  // Tab state removed - simplified admin interface

  // Removed user management state - users tab deleted

  // Testing tools state
  const [statusCheckLoading, setStatusCheckLoading] = useState(false);
  const [distributionMonth, setDistributionMonth] = useState(new Date().toISOString().slice(0, 7));

  // Platform fee revenue state
  const [platformFeeData, setPlatformFeeData] = useState<any[]>([]);
  const [platformFeeStats, setPlatformFeeStats] = useState({
    totalPlatformRevenue: 0,
    monthlyPlatformRevenue: 0,
    platformFeeGrowth: 0,
    averageFeePerPayout: 0
  });
  const [distributionLoading, setDistributionLoading] = useState(false);

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

  // Testing tools handlers




  const handleCheckPayoutStatus = async () => {
    console.log('[Admin Testing] Starting payout status check...');
    setStatusCheckLoading(true);
    try {
      console.log('[Admin Testing] Sending request to /api/admin/payout-status');

      const response = await fetch('/api/admin/payout-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'}
      });

      console.log('[Admin Testing] Status check response status:', response.status);
      console.log('[Admin Testing] Status check response headers:', Object.fromEntries(response.headers.entries()));

      const result = await response.json();
      console.log('[Admin Testing] Status check response body:', result);

      if (result.success) {
        console.log('[Admin Testing] System status check completed successfully');
        console.log('[Admin Testing] Payout System Status:', result.data);
        toast({
          title: "System Status Check Complete",
          description: "Check console for detailed status information"});
      } else {
        console.error('[Admin Testing] Status check failed:', result);
        toast({
          title: "Status Check Failed",
          description: result.error || "An error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[Admin Testing] Exception in status check:', error);
      console.error('[Admin Testing] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      toast({
        title: "Error",
        description: "Failed to check system status - check console for details",
        variant: "destructive"
      });
    } finally {
      console.log('[Admin Testing] Status check completed, setting loading to false');
      setStatusCheckLoading(false);
    }
  };

  const handleMonthlyDistribution = async () => {
    console.log('[Admin Testing] Starting monthly distribution...');
    console.log('[Admin Testing] Distribution month:', distributionMonth);

    if (!distributionMonth) {
      console.error('[Admin Testing] Missing distribution month');
      toast({
        title: "Missing Information",
        description: "Please provide a month in YYYY-MM format",
        variant: "destructive"
      });
      return;
    }

    setDistributionLoading(true);
    try {
      const requestBody = { month: distributionMonth };
      console.log('[Admin Testing] Sending monthly distribution request with body:', requestBody);

      const response = await fetch('/api/admin/monthly-distribution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'},
        body: JSON.stringify(requestBody)
      });

      console.log('[Admin Testing] Monthly distribution response status:', response.status);
      console.log('[Admin Testing] Monthly distribution response headers:', Object.fromEntries(response.headers.entries()));

      const result = await response.json();
      console.log('[Admin Testing] Monthly distribution response body:', result);

      if (result.success) {
        console.log('[Admin Testing] Monthly distribution completed successfully');
        toast({
          title: "Monthly Distribution Complete",
          description: `Successfully processed distribution for ${distributionMonth}`});
      } else {
        console.error('[Admin Testing] Monthly distribution failed:', result);
        toast({
          title: "Distribution Failed",
          description: result.error || "An error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[Admin Testing] Exception in monthly distribution:', error);
      console.error('[Admin Testing] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      toast({
        title: "Error",
        description: "Failed to process monthly distribution - check console for details",
        variant: "destructive"
      });
    } finally {
      console.log('[Admin Testing] Monthly distribution completed, setting loading to false');
      setDistributionLoading(false);
    }
  };





  // Feature flags have been removed

  // Enhanced loading and error states
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
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
      <div className="mb-8">
        <Link href="/settings" className="inline-flex items-center text-primary hover:text-primary/80">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Link>
        <h1 className="text-3xl font-bold mt-4 mb-2">
          Admin Panel
        </h1>
        <p className="text-muted-foreground">
          Administrative tools and dashboard access
        </p>

      </div>

      {/* Simplified admin interface - no tabs needed */}
      <div className="space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Admin Tools</h2>
          <p className="text-muted-foreground">Administrative dashboard and testing utilities</p>
        </div>

          {/* Platform fee revenue moved to admin dashboard */}

          {/* Admin Dashboard - Moved to top */}
          <div className="mb-6">
            <div className="flex flex-col p-6 rounded-lg border-theme-strong hover:bg-muted/50 transition-colors bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Admin Dashboard</h3>
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground mb-4">
                View comprehensive analytics including user registrations, page creation metrics, platform fee revenue, and sharing statistics with interactive charts and date filtering.
              </span>
              <div className="mt-2">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/dashboard')}
                >
                  <BarChart3 className="h-4 w-4" />
                  Open Admin Dashboard
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col p-4 rounded-lg border-theme-strong hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">PWA Testing</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Test the PWA installation banner by forcing it to appear.
              </span>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleTriggerPWAAlert}
                >
                  <RefreshCw className="h-4 w-4" />
                  Trigger PWA Alert
                </Button>
              </div>
            </div>





            {/* Testing Tools */}
            <div className="flex flex-col p-4 rounded-lg border-theme-strong hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Testing Tools</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Test payout systems, token earnings, and subscription states
              </span>
              <div className="mt-2 space-y-4">

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={handleMonthlyDistribution}
                  disabled={distributionLoading}
                >
                  {distributionLoading ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Test Monthly Distribution
                </Button>


              </div>
            </div>

            {/* Landing Page Management */}
            <div className="flex flex-col p-4 rounded-lg border-theme-strong hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Landing Page Cards</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Manage which pages appear on the landing page and their display order
              </span>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/landing-page-cards')}
                >
                  <Eye className="h-4 w-4" />
                  Manage Landing Cards
                </Button>
              </div>
            </div>

            {/* Payment Management */}
            <div className="flex flex-col p-4 rounded-lg border-theme-strong hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Payment Management</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Monitor and manage financial operations and payouts
              </span>
              <div className="mt-2 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/payments')}
                >
                  <DollarSign className="h-4 w-4" />
                  Payment Dashboard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/payout-validation')}
                >
                  <Settings className="h-4 w-4" />
                  Payout Validation
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}