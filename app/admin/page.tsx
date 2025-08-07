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

import { SwipeableTabs, SwipeableTabsList, SwipeableTabsTrigger, SwipeableTabsContent } from '../components/ui/swipeable-tabs';
import { Search, Users, Settings, Loader, Check, X, Shield, RefreshCw, Smartphone, ChevronLeft, ChevronRight, BarChart3, DollarSign, Eye, Palette } from 'lucide-react';
import { db } from "../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '../components/ui/use-toast';
import { usePWA } from '../providers/PWAProvider';
import Link from 'next/link';
import { UserManagement } from '../components/admin/UserManagement';
import { PayoutFlowValidator } from '../components/admin/PayoutFlowValidator';
import ReadOptimizationDashboard from '../components/admin/ReadOptimizationDashboard';
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
  const [activeTab, setActiveTab] = useState('features');



  // Valid tab values for hash navigation
  const validTabs = ['features', 'users', 'tools', 'performance'];
  const defaultTab = 'features';

  // User management state
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hideGloballyEnabled, setHideGloballyEnabled] = useState(false);

  // Testing tools state
  const [payoutTestLoading, setPayoutTestLoading] = useState(false);
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

  // Load filter state from user storage
  useEffect(() => {
    console.log('[Admin Testing] Component mounting, loading saved states...');
    console.log('[Admin Testing] Current user on mount:', user);

    if (typeof window !== 'undefined') {
      const savedFilterState = sessionStorage.getItem('admin-hide-globally-enabled');
      console.log('[Admin Testing] Saved filter state:', savedFilterState);
      if (savedFilterState !== null) {
        setHideGloballyEnabled(JSON.parse(savedFilterState));
      }


    } else {
      console.warn('[Admin Testing] Window not available during mount');
    }

    console.log('[Admin Testing] Component mount completed');
  }, [user]);

  // Persist filter state to user storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('admin-hide-globally-enabled', JSON.stringify(hideGloballyEnabled));
    }
  }, [hideGloballyEnabled]);

  // Hash-based navigation management
  useEffect(() => {
    // Read hash from URL on page load and set initial tab
    const hash = window.location.hash.slice(1); // Remove the # symbol
    if (hash && validTabs.includes(hash)) {
      setActiveTab(hash);
    } else if (hash && !validTabs.includes(hash)) {
      // Invalid hash, redirect to default tab
      window.history.replaceState(null, '', `/admin#${defaultTab}`);
      setActiveTab(defaultTab);
    } else if (!hash) {
      // No hash, set default tab and update URL
      window.history.replaceState(null, '', `/admin#${defaultTab}`);
      setActiveTab(defaultTab);
    }
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.slice(1);
      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      } else {
        // Invalid or missing hash, redirect to default
        window.history.replaceState(null, '', `/admin#${defaultTab}`);
        setActiveTab(defaultTab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && user) {
      if (!isAdmin(user.email)) {
        router.push('/');
      } else {
        try {
          loadAdminUsers();
          loadPlatformFeeData();
        } catch (error) {
          console.error('Error in admin data loading:', error);
        }
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin');
    }
  }, [user, authLoading, router]);

  // Custom tab change handler that updates URL hash
  const handleTabChange = (newTab: string) => {
    if (validTabs.includes(newTab)) {
      setActiveTab(newTab);
      // Update URL hash without triggering a page reload
      window.history.pushState(null, '', `/admin#${newTab}`);
    }
  };

  // Load admin users from API
  const loadAdminUsers = async () => {
    try {
      setIsLoading(true);

      // Call the admin users API endpoint
      const response = await fetch('/api/admin/admin-users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load admin users');
      }

      console.log(`Successfully loaded ${data.adminUsers.length} admin users from API`);
      setAdminUsers(data.adminUsers);

    } catch (error) {
      console.error('Error loading admin users:', error);
      toast({
        title: "Error",
        description: "Failed to load admin users",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlatformFeeData = async () => {
    try {
      const response = await fetch('/api/admin/platform-fee-revenue');
      if (response.ok) {
        const data = await response.json();
        setPlatformFeeData(data.chartData || []);
        setPlatformFeeStats(data.stats || {
          totalPlatformRevenue: 0,
          monthlyPlatformRevenue: 0,
          platformFeeGrowth: 0,
          averageFeePerPayout: 0
        });
      } else {
        console.error('Failed to load platform fee data');
      }
    } catch (error) {
      console.error('Failed to load platform fee data', error);
    }
  };

  // Feature flags have been removed - no loading needed

  // Handle search for users
  const handleSearch = async () => {
    if (!searchTerm) return;

    try {
      setIsSearching(true);

      // Call the admin users API endpoint with search term
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(searchTerm)}&limit=20`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to search users');
      }

      // Mark users as admin based on current admin list
      const results = data.users.map((user: any) => ({
        ...user,
        isAdmin: adminUsers.some(admin => admin.id === user.uid)
      }));

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to search users',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle admin status for a user
  const toggleAdminStatus = async (user: User) => {
    try {
      setIsLoading(true);

      // Call the admin users API endpoint
      const action = user.isAdmin ? 'remove' : 'add';
      const response = await fetch('/api/admin/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          targetUserId: user.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update admin status');
      }

      // Update local state
      if (user.isAdmin) {
        setAdminUsers(prev => prev.filter(admin => admin.id !== user.id));
        setSearchResults(prev =>
          prev.map(result =>
            result.id === user.id ? { ...result, isAdmin: false } : result
          )
        );
      } else {
        setAdminUsers(prev => [...prev, { ...user, isAdmin: true }]);
        setSearchResults(prev =>
          prev.map(result =>
            result.id === user.id ? { ...result, isAdmin: true } : result
          )
        );
      }

      toast({
        title: 'Success',
        description: `${user.username || user.email} is ${user.isAdmin ? 'no longer' : 'now'} an admin`,
        variant: 'default'
      });
    } catch (error) {
      console.error('Error toggling admin status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update admin status',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

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


  const handleTestPayoutFlow = async () => {
    console.log('[Admin Testing] Starting payout flow test...');
    console.log('[Admin Testing] Current user:', user);

    if (!user?.email) {
      console.error('[Admin Testing] User not found or no email for payout test:', user);
      toast({
        title: "User Not Found",
        description: "Unable to identify current user",
        variant: "destructive"
      });
      return;
    }

    setPayoutTestLoading(true);
    try {
      const requestBody = { userEmail: user.email };
      console.log('[Admin Testing] Sending payout flow test request with body:', requestBody);

      const response = await fetch('/api/admin/test-payout-flow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'},
        body: JSON.stringify(requestBody)
      });

      console.log('[Admin Testing] Payout flow test response status:', response.status);
      console.log('[Admin Testing] Payout flow test response headers:', Object.fromEntries(response.headers.entries()));

      const result = await response.json();
      console.log('[Admin Testing] Payout flow test response body:', result);

      if (result.success) {
        console.log('[Admin Testing] Payout flow test completed successfully');
        console.log('[Admin Testing] Test results:', result.data);
        toast({
          title: "Payout Flow Test Complete",
          description: "Test completed for your account. Check console for details."});
      } else {
        console.error('[Admin Testing] Payout flow test failed:', result);
        toast({
          title: "Payout Flow Test Failed",
          description: result.error || "An error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[Admin Testing] Exception in payout flow test:', error);
      console.error('[Admin Testing] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      toast({
        title: "Error",
        description: "Failed to test payout flow - check console for details",
        variant: "destructive"
      });
    } finally {
      console.log('[Admin Testing] Payout flow test completed, setting loading to false');
      setPayoutTestLoading(false);
    }
  };

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
      <div className={`py-6 px-4 ${activeTab === 'users' ? 'w-full' : 'container mx-auto max-w-5xl'}`}>
      <div className="mb-8">
        <Link href="/settings" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Link>
        <h1 className="text-3xl font-bold mt-4 mb-2 flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Admin Panel
        </h1>
        <p className="text-muted-foreground">
          Manage users and admin settings
        </p>

      </div>

      <SwipeableTabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6"
        tabsListClassName="flex w-full overflow-x-auto scrollbar-hide"
        preventScrollOnSwipe={false}
        swipeDistance={50}
        animationDuration={0.3}
      >
        <SwipeableTabsList className="w-full border-b border-border/40 sticky top-0 bg-background z-10">
          <div className="flex w-max space-x-4 px-1">

            <SwipeableTabsTrigger
              value="users"
              className="flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium transition-all"
            >
              <Users className="h-4 w-4" />
              Users
            </SwipeableTabsTrigger>
            <SwipeableTabsTrigger
              value="tools"
              className="flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium transition-all"
            >
              <Smartphone className="h-4 w-4" />
              Tools
            </SwipeableTabsTrigger>
          </div>
        </SwipeableTabsList>

        {/* Feature Flags Tab - Removed as all features are now always enabled */}

        {/* Users Tab - Combined User Management and Admin Users */}
        <SwipeableTabsContent value="users" className="space-y-6 pt-6">
          {/* User Management Section */}
          <div>
            <h2 className="text-2xl font-bold mb-2">User Management</h2>
            <p className="text-muted-foreground mb-4">Manage all users and administrative privileges</p>
            <UserManagement />
          </div>

          {/* Admin Users Section */}
          <div className="border-t pt-6">
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-2">Admin Users</h3>
              <p className="text-muted-foreground">Manage users with administrative privileges</p>
            </div>

            {/* Search */}
            <div className="flex gap-2 mb-6">
              <div className="flex-1">
                <Input
                  placeholder="Search by email or username"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleSearch}
                disabled={isSearching || !searchTerm}
              >
                {isSearching ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 mb-6">
                <h4 className="text-sm font-medium">Search Results</h4>
                <div className="space-y-2">
                  {searchResults.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{user.username || 'No username'}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                      <Button
                        variant={user.isAdmin ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => toggleAdminStatus(user as any)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : user.isAdmin ? (
                          "Remove Admin"
                        ) : (
                          "Make Admin"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current Admin Users */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Current Admin Users</h4>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : adminUsers.length > 0 ? (
                <div className="space-y-2">
                  {adminUsers.map(admin => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between p-3 rounded-md border border-border bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{admin.username || 'No username'}</span>
                        <span className="text-xs text-muted-foreground">{admin.email}</span>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => toggleAdminStatus(admin)}
                        disabled={isLoading || admin.email === 'jamiegray2234@gmail.com'} // Prevent removing the main admin
                      >
                        {isLoading ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          "Remove Admin"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No admin users found
                </div>
              )}
            </div>
          </div>
        </SwipeableTabsContent>



        {/* Tools Tab - Consolidated Admin Tools, Testing Tools, and Payments */}
        <SwipeableTabsContent value="tools" className="space-y-6 pt-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Admin Tools</h2>
            <p className="text-muted-foreground">Comprehensive administrative tools, testing utilities, and payment management</p>
          </div>

          {/* Platform Fee Revenue Chart */}
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Revenue from Platform Fees
                </CardTitle>
                <CardDescription>
                  WeWrite platform fee revenue (7% of payouts) over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-800">
                      ${platformFeeStats.totalPlatformRevenue.toFixed(2)}
                    </div>
                    <div className="text-sm text-green-600">Total Platform Revenue</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-800">
                      ${platformFeeStats.monthlyPlatformRevenue.toFixed(2)}
                    </div>
                    <div className="text-sm text-blue-600">This Month</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-800">
                      {platformFeeStats.platformFeeGrowth > 0 ? '+' : ''}{platformFeeStats.platformFeeGrowth.toFixed(1)}%
                    </div>
                    <div className="text-sm text-purple-600">Monthly Growth</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-800">
                      ${platformFeeStats.averageFeePerPayout.toFixed(2)}
                    </div>
                    <div className="text-sm text-orange-600">Avg Fee per Payout</div>
                  </div>
                </div>

                {platformFeeData.length > 0 ? (
                  <div className="h-64 w-full">
                    <div className="text-sm text-muted-foreground mb-2">
                      Platform fee revenue by month (7% of total payouts)
                    </div>
                    {/* Simple chart representation - could be enhanced with a proper chart library */}
                    <div className="space-y-2">
                      {platformFeeData.slice(-6).map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-16 text-xs text-muted-foreground">
                            {item.month}
                          </div>
                          <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                            <div
                              className="bg-green-600 h-4 rounded-full"
                              style={{
                                width: `${Math.min(100, (item.revenue / Math.max(...platformFeeData.map(d => d.revenue))) * 100)}%`
                              }}
                            />
                          </div>
                          <div className="w-20 text-xs font-medium text-right">
                            ${item.revenue.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-muted-foreground">
                    No platform fee data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
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

            {/* Feature Flags Sync Tool - Removed as feature flags have been eliminated */}

            {/* Admin Dashboard */}
            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Admin Dashboard</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                View comprehensive analytics including user registrations, page creation metrics, and sharing statistics with interactive charts and date filtering.
              </span>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/dashboard')}
                >
                  <BarChart3 className="h-4 w-4" />
                  Open Dashboard
                </Button>
              </div>
            </div>

            {/* 🚨 EMERGENCY: Database Read Analytics Dashboard */}
            <div className="flex flex-col p-4 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-destructive">🚨 Database Read Analytics</h3>
                <Badge variant="destructive">EMERGENCY</Badge>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Real-time monitoring of database read patterns, cost projections, and optimization effectiveness. Critical for managing the 2.5M reads/60min crisis.
              </span>
              <div className="mt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/database-analytics')}
                >
                  <Database className="h-4 w-4" />
                  Open Read Analytics
                </Button>
              </div>
            </div>

            {/* Design System */}
            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Design System</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Comprehensive catalog of UI components with usage analytics, deduplication recommendations, and design system health metrics.
              </span>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => router.push('/admin/design-system')}
                >
                  <Palette className="h-4 w-4" />
                  Open Design System
                </Button>
              </div>
            </div>

            {/* Testing Tools */}
            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
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

                {/* Payout Flow Validator */}
                <div className="border-t pt-4">
                  <PayoutFlowValidator />
                </div>
              </div>
            </div>

            {/* Payment Management */}
            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
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
                  onClick={() => window.open('/admin/tools', '_blank')}
                >
                  <Settings className="h-4 w-4" />
                  Advanced Tools
                </Button>
              </div>
            </div>

          </div>
        </SwipeableTabsContent>

      </SwipeableTabs>
      </div>
    </div>
  );
}