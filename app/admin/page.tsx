"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from "../providers/AuthProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';

import { SwipeableTabs, SwipeableTabsList, SwipeableTabsTrigger, SwipeableTabsContent } from '../components/ui/swipeable-tabs';
import { Search, Users, Settings, Loader, Check, X, Shield, RefreshCw, Smartphone, ChevronLeft, ChevronRight, BarChart3, Coins, DollarSign } from 'lucide-react';
import { db } from "../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '../components/ui/use-toast';
import { FeatureFlag, isAdmin } from "../utils/feature-flags";
import { usePWA } from '../providers/PWAProvider';
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import SyncFeatureFlagsButton from '../components/utils/SyncFeatureFlagsButton';
import Link from 'next/link';
import FeatureFlagCard from '../components/admin/FeatureFlagCard';
import { UserManagement } from '../components/admin/UserManagement';
import { MockEarningsService } from '../services/mockEarningsService';


interface User {
  id: string;
  email: string;
  username?: string;
  isAdmin?: boolean;
}

interface FeatureFlagState {
  id: FeatureFlag;
  name: string;
  description: string;
  enabled: boolean;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { resetBannerState } = usePWA();
  const [activeTab, setActiveTab] = useState('features');

  // Valid tab values for hash navigation
  const validTabs = ['features', 'users', 'admins', 'tools', 'testing', 'payments'];
  const defaultTab = 'features';

  // User management state
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hideGloballyEnabled, setHideGloballyEnabled] = useState(false);

  // Testing tools state
  const [mockTokenAmount, setMockTokenAmount] = useState('');
  const [mockEarningsLoading, setMockEarningsLoading] = useState(false);
  const [resetEarningsLoading, setResetEarningsLoading] = useState(false);
  const [payoutTestLoading, setPayoutTestLoading] = useState(false);
  const [statusCheckLoading, setStatusCheckLoading] = useState(false);
  const [distributionMonth, setDistributionMonth] = useState(new Date().toISOString().slice(0, 7));
  const [distributionLoading, setDistributionLoading] = useState(false);
  const [inactiveSubscriptionEnabled, setInactiveSubscriptionEnabled] = useState(false);

  // Feature flags state - using system string names for easier identification
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagState[]>([
    {
      id: 'payments',
      name: 'payments',
      description: 'Enable subscription functionality, payment processing, and token-based pledge system',
      enabled: false
    },
    {
      id: 'map_view',
      name: 'map_view',
      description: 'Enable map view for pages with location data and geographic visualization',
      enabled: false
    },
    {
      id: 'calendar_view',
      name: 'calendar_view',
      description: 'Enable calendar view for activity tracking and temporal organization',
      enabled: false
    }

  ]);

  // Load filter state from session storage
  useEffect(() => {
    console.log('[Admin Testing] Component mounting, loading saved states...');
    console.log('[Admin Testing] Current user on mount:', user);

    if (typeof window !== 'undefined') {
      const savedFilterState = sessionStorage.getItem('admin-hide-globally-enabled');
      console.log('[Admin Testing] Saved filter state:', savedFilterState);
      if (savedFilterState !== null) {
        setHideGloballyEnabled(JSON.parse(savedFilterState));
      }

      // Load inactive subscription testing state
      const inactiveSubState = localStorage.getItem('admin-inactive-subscription-test');
      console.log('[Admin Testing] Saved inactive subscription state:', inactiveSubState);
      if (inactiveSubState !== null) {
        setInactiveSubscriptionEnabled(JSON.parse(inactiveSubState));
      }
    } else {
      console.warn('[Admin Testing] Window not available during mount');
    }

    console.log('[Admin Testing] Component mount completed');
  }, [user]);

  // Persist filter state to session storage
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
      if (user.email !== 'jamiegray2234@gmail.com') {
        router.push('/');
      } else {
        try {
          loadAdminUsers();
          loadFeatureFlags();
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

  // Load admin users from Firestore
  const loadAdminUsers = async () => {
    try {
      setIsLoading(true);

      // Get admin users from Firestore
      const adminUsersRef = doc(db, 'config', 'adminUsers');
      const adminUsersDoc = await getDoc(adminUsersRef);

      if (adminUsersDoc.exists()) {
        const adminUserIds = adminUsersDoc.data().userIds || [];

        // Get user details for each admin user
        const adminUserPromises = adminUserIds.map(async (userId: string) => {
          const userRef = doc(db, 'users', userId);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            return {
              id: userId,
              ...userDoc.data(),
              isAdmin: true
            } as User;
          }
          return null;
        });

        const adminUserResults = await Promise.all(adminUserPromises);
        setAdminUsers(adminUserResults.filter(Boolean) as User[]);
      }
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

  // Load feature flags from Firestore
  const loadFeatureFlags = async () => {
    try {
      setIsLoading(true);

      // Get feature flags from Firestore
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      if (featureFlagsDoc.exists()) {
        const flagsData = featureFlagsDoc.data();

        // Filter out any flags that aren't defined in our FeatureFlag type
        const validFlags = {};
        Object.keys(flagsData).forEach(key => {
          // Only include keys that match our defined feature flags
          if (featureFlags.some(flag => flag.id === key)) {
            validFlags[key] = flagsData[key];
          }
        });

        // Update local state with data from Firestore
        setFeatureFlags(prev => {
          const updatedFlags = prev.map(flag => ({
            ...flag,
            enabled: validFlags[flag.id] !== undefined ? validFlags[flag.id] : flag.enabled
          }));
          return updatedFlags;
        });

        // Groups feature flag removed - no longer needed

        // If we found invalid flags, update the database to remove them
        if (Object.keys(validFlags).length !== Object.keys(flagsData).length) {
          await setDoc(featureFlagsRef, validFlags);
        }
      } else {
        // If the document doesn't exist, create it with all feature flags

        const initialFlags = {};
        featureFlags.forEach(flag => {
          initialFlags[flag.id] = flag.enabled;
        });

        await setDoc(featureFlagsRef, initialFlags);
      }
    } catch (error) {
      console.error('[DEBUG] Error loading feature flags:', error);
      toast({
        title: 'Error',
        description: 'Failed to load feature flags',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search for users
  const handleSearch = async () => {
    if (!searchTerm) return;

    try {
      setIsSearching(true);

      // Search by email
      const emailQuery = query(collection(db, 'users'), where('email', '==', searchTerm));
      const emailSnapshot = await getDocs(emailQuery);

      // Search by username
      const usernameQuery = query(collection(db, 'users'), where('username', '==', searchTerm));
      const usernameSnapshot = await getDocs(usernameQuery);

      // Combine results
      const results: User[] = [];

      emailSnapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data(), isAdmin: adminUsers.some(admin => admin.id === doc.id) } as User);
      });

      usernameSnapshot.forEach(doc => {
        // Avoid duplicates
        if (!results.some(user => user.id === doc.id)) {
          results.push({ id: doc.id, ...doc.data(), isAdmin: adminUsers.some(admin => admin.id === doc.id) } as User);
        }
      });

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

      // Get current admin users
      const adminUsersRef = doc(db, 'config', 'adminUsers');
      const adminUsersDoc = await getDoc(adminUsersRef);

      let adminUserIds: string[] = [];

      if (adminUsersDoc.exists()) {
        adminUserIds = adminUsersDoc.data().userIds || [];
      }

      // Toggle admin status
      if (user.isAdmin) {
        // Remove from admin users
        adminUserIds = adminUserIds.filter(id => id !== user.id);
      } else {
        // Add to admin users
        adminUserIds.push(user.id);
      }

      // Update Firestore
      await setDoc(adminUsersRef, { userIds: adminUserIds });

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

  // Toggle feature flag with robust error handling and retry logic
  const toggleFeatureFlag = async (flagId: FeatureFlag, newState?: boolean) => {
    try {
      setIsLoading(true);


      // Check if user is admin
      if (!user || user.email !== 'jamiegray2234@gmail.com') {
        throw new Error('Admin access required');
      }

      const featureFlagsRef = doc(db, 'config', 'featureFlags');

      // Get current value if newState is not provided
      let newEnabledState = newState;
      if (newState === undefined) {
        const featureFlagsDoc = await getDoc(featureFlagsRef);
        const currentValue = featureFlagsDoc.exists() ? featureFlagsDoc.data()[flagId] || false : false;
        newEnabledState = !currentValue;
      }



      // Multiple retry strategies to handle "blocked by client" errors
      let updateSuccess = false;
      let lastError = null;

      // Strategy 1: Try updateDoc
      if (!updateSuccess) {
        try {
          await updateDoc(featureFlagsRef, {
            [flagId]: newEnabledState
          });
          updateSuccess = true;
        } catch (updateError) {
          lastError = updateError;
        }
      }

      // Strategy 2: Try setDoc with merge
      if (!updateSuccess) {
        try {
          const currentDoc = await getDoc(featureFlagsRef);
          const currentData = currentDoc.exists() ? currentDoc.data() : {};
          await setDoc(featureFlagsRef, {
            ...currentData,
            [flagId]: newEnabledState
          });
          updateSuccess = true;
        } catch (setDocError) {
          lastError = setDocError;
        }
      }

      // Strategy 3: Try with a small delay (sometimes helps with rate limiting)
      if (!updateSuccess) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          await updateDoc(featureFlagsRef, {
            [flagId]: newEnabledState
          });
          updateSuccess = true;
        } catch (delayedError) {
          lastError = delayedError;
        }
      }

      if (!updateSuccess) {
        throw lastError || new Error('All update strategies failed');
      }



      // Update local state after successful database write
      setFeatureFlags(prev =>
        prev.map(flag =>
          flag.id === flagId ? { ...flag, enabled: newEnabledState } : flag
        )
      );

      // Trigger a feature flag refresh event for all users
      try {
        window.dispatchEvent(new CustomEvent('featureFlagChanged', {
          detail: { flagId, newValue: newEnabledState, timestamp: Date.now() }
        }));
      } catch (eventError) {
        console.warn('Could not dispatch feature flag change event:', eventError);
      }

      toast({
        title: 'Success',
        description: `${flagId} is now ${newEnabledState ? 'enabled' : 'disabled'} for everyone`,
        variant: 'default'
      });

    } catch (error) {
      console.error('Error toggling feature flag:', error);

      // Enhanced error handling with specific solutions
      let errorMessage = 'Failed to update feature flag';
      let showConsoleHelp = false;

      if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. You may not have admin access.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Database is temporarily unavailable. Please try again.';
      } else if (error.message?.includes('blocked') || error.message?.includes('client')) {
        errorMessage = 'Request blocked by browser security or ad blocker. Try disabling ad blockers or use browser console.';
        showConsoleHelp = true;
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error occurred. Check your internet connection.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
        showConsoleHelp = true;
      }

      // Show enhanced error message
      toast({
        title: 'Error',
        description: errorMessage + (showConsoleHelp ? ` Console command: enableFeatureFlag("${flagId}")` : ''),
        variant: 'destructive'
      });

      // Log console command for easy copy-paste
      if (showConsoleHelp) {
        console.log(`%c🚀 Console Command to Fix This:`, 'color: #00ff00; font-weight: bold; font-size: 14px;');
        console.log(`%cenableFeatureFlag("${flagId}")`, 'color: #ffff00; font-weight: bold; font-size: 12px; background: #333; padding: 4px;');
      }

      // Reload feature flags from database to ensure consistency
      try {
        await loadFeatureFlags();
      } catch (reloadError) {
        console.error('Failed to reload feature flags after error:', reloadError);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
  /**
   * Handle mock token earnings creation
   * Uses the centralized MockEarningsService for type safety and consistency
   */
  const handleMockTokenEarnings = async () => {
    if (!mockTokenAmount) {
      toast({
        title: "Missing Information",
        description: "Please provide token amount",
        variant: "destructive"
      });
      return;
    }

    if (!user?.email) {
      toast({
        title: "User Not Found",
        description: "Unable to identify current user",
        variant: "destructive"
      });
      return;
    }

    const tokenAmount = parseInt(mockTokenAmount);

    // Validate request using service
    const validation = MockEarningsService.validateCreateRequest({
      tokenAmount,
      month: new Date().toISOString().slice(0, 7)
    });

    if (!validation.isValid) {
      toast({
        title: "Validation Error",
        description: validation.errors.join(', '),
        variant: "destructive"
      });
      return;
    }

    setMockEarningsLoading(true);
    try {
      const request = MockEarningsService.createRequestForCurrentMonth(tokenAmount);
      const result = await MockEarningsService.createMockEarnings(request);

      if (result.success) {
        toast({
          title: "Mock Earnings Created",
          description: `Successfully created ${mockTokenAmount} tokens for your account`,
        });
        setMockTokenAmount('');
      } else {
        toast({
          title: "Failed to Create Mock Earnings",
          description: result.error || "An error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[Admin] Error creating mock earnings:', error);
      toast({
        title: "Error",
        description: "Failed to create mock earnings",
        variant: "destructive"
      });
    } finally {
      setMockEarningsLoading(false);
    }
  };

  /**
   * Handle mock earnings reset
   * Uses the centralized MockEarningsService for consistency
   */
  const handleResetMockEarnings = async () => {
    if (!user?.email) {
      toast({
        title: "User Not Found",
        description: "Unable to identify current user",
        variant: "destructive"
      });
      return;
    }

    setResetEarningsLoading(true);
    try {
      const result = await MockEarningsService.resetMockEarnings();

      if (result.success) {
        const summary = result.data ?
          `Removed ${result.data.tokensRemoved} tokens ($${result.data.usdRemoved.toFixed(2)})` :
          'Successfully reset mock earnings';

        toast({
          title: "Mock Earnings Reset",
          description: summary,
        });
      } else {
        toast({
          title: "Reset Failed",
          description: result.error || "An error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[Admin] Error resetting mock earnings:', error);
      toast({
        title: "Error",
        description: "Failed to reset mock earnings",
        variant: "destructive"
      });
    } finally {
      setResetEarningsLoading(false);
    }
  };

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
          'Content-Type': 'application/json',
        },
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
          description: "Test completed for your account. Check console for details.",
        });
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
          'Content-Type': 'application/json',
        }
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
          description: "Check console for detailed status information",
        });
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
          'Content-Type': 'application/json',
        },
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
          description: `Successfully processed distribution for ${distributionMonth}`,
        });
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

  const handleInactiveSubscriptionToggle = (enabled: boolean) => {
    console.log('[Admin Testing] Toggling inactive subscription test:', enabled);
    console.log('[Admin Testing] Previous state:', inactiveSubscriptionEnabled);

    try {
      setInactiveSubscriptionEnabled(enabled);

      if (typeof window !== 'undefined') {
        localStorage.setItem('admin-inactive-subscription-test', JSON.stringify(enabled));
        console.log('[Admin Testing] Saved to localStorage:', localStorage.getItem('admin-inactive-subscription-test'));
      } else {
        console.warn('[Admin Testing] Window not available, cannot save to localStorage');
      }

      console.log('[Admin Testing] Inactive subscription toggle completed successfully');
      toast({
        title: enabled ? "Inactive Subscription Test Enabled" : "Inactive Subscription Test Disabled",
        description: enabled
          ? "Subscription will appear as inactive for UI testing"
          : "Subscription will show normal status",
      });
    } catch (error) {
      console.error('[Admin Testing] Exception in inactive subscription toggle:', error);
      console.error('[Admin Testing] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      toast({
        title: "Error",
        description: "Failed to toggle inactive subscription test - check console for details",
        variant: "destructive"
      });
    }
  };

  // Filter feature flags based on hideGloballyEnabled setting
  const filteredFeatureFlags = hideGloballyEnabled
    ? featureFlags.filter(flag => !flag.enabled)
    : featureFlags;

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

  if (user.email !== 'jamiegray2234@gmail.com') {
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
          Manage feature flags and admin settings
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
              value="features"
              className="flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium transition-all"
            >
              <Settings className="h-4 w-4" />
              Feature Flags
            </SwipeableTabsTrigger>
            <SwipeableTabsTrigger
              value="users"
              className="flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium transition-all"
            >
              <Users className="h-4 w-4" />
              User Management
            </SwipeableTabsTrigger>
            <SwipeableTabsTrigger
              value="admins"
              className="flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium transition-all"
            >
              <Shield className="h-4 w-4" />
              Admin Users
            </SwipeableTabsTrigger>
            <SwipeableTabsTrigger
              value="tools"
              className="flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium transition-all"
            >
              <Smartphone className="h-4 w-4" />
              Admin Tools
            </SwipeableTabsTrigger>
            <SwipeableTabsTrigger
              value="testing"
              className="flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium transition-all"
            >
              <BarChart3 className="h-4 w-4" />
              Testing Tools
            </SwipeableTabsTrigger>
            <SwipeableTabsTrigger
              value="payments"
              className="flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium transition-all"
            >
              <DollarSign className="h-4 w-4" />
              Payments & Payouts
            </SwipeableTabsTrigger>
          </div>
        </SwipeableTabsList>

        {/* Feature Flags Tab */}
        <SwipeableTabsContent value="features" className="space-y-6 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Feature Flags</h2>
            <div className="flex items-center gap-3">
              <Checkbox
                id="hide-globally-enabled"
                checked={hideGloballyEnabled}
                onCheckedChange={(checked) => setHideGloballyEnabled(checked as boolean)}
              />
              <label htmlFor="hide-globally-enabled" className="text-sm cursor-pointer">
                Hide enabled ({filteredFeatureFlags.length}/{featureFlags.length})
              </label>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>


              <div className="space-y-3">
                {filteredFeatureFlags.map(flag => (
                  <FeatureFlagCard
                    key={flag.id}
                    flag={flag}
                    onToggle={(flagId, checked) => toggleFeatureFlag(flagId, checked)}
                    onPersonalToggle={(flagId, checked) => {
                      // Personal toggle doesn't need to update the global state
                      // The component handles its own personal state
                    }}
                    isLoading={isLoading}
                  />
                ))}
              </div>
            </>
          )}
        </SwipeableTabsContent>

        {/* User Management Tab */}
        <SwipeableTabsContent value="users" className="space-y-4 pt-4">
          <UserManagement />
        </SwipeableTabsContent>

        {/* Admin Users Tab */}
        <SwipeableTabsContent value="admins" className="space-y-4 pt-4">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Admin Users</h2>
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
              <h3 className="text-sm font-medium">Search Results</h3>
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
                      onClick={() => toggleAdminStatus(user)}
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
            <h3 className="text-sm font-medium">Current Admin Users</h3>
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
        </SwipeableTabsContent>

        {/* Admin Tools Tab */}
        <SwipeableTabsContent value="tools" className="space-y-4 pt-4">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Admin Tools</h2>
            <p className="text-muted-foreground">Additional administrative tools and utilities</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Feature Flags Management</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Feature flags can be managed in the Feature Flags tab. Use the tools below for advanced operations like fixing database issues
                or checking the raw state of feature flags.
              </span>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => handleTabChange('features')}
                >
                  <Settings className="h-4 w-4" />
                  Go to Feature Flags Tab
                </Button>
              </div>
            </div>

            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Search Debug Tools</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Debug search functionality, test specific search terms, and analyze search performance issues.
              </span>
              <div className="mt-2 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => window.open('/search-debug', '_blank')}
                >
                  <Search className="h-4 w-4" />
                  Search Debug Tool
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => window.open('/search', '_blank')}
                >
                  <Search className="h-4 w-4" />
                  Test Search Page
                </Button>
              </div>
            </div>

            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Development Tools</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Additional development and debugging tools for WeWrite functionality.
              </span>
              <div className="mt-2 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => window.open('/admin/tools', '_blank')}
                >
                  <Settings className="h-4 w-4" />
                  Admin Tools
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => {
                    // Clear all localStorage for debugging
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.reload();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Clear Cache & Reload
                </Button>
              </div>
            </div>

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

            {/* Feature Flags Sync Tool */}
            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Feature Flags Sync</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Synchronize feature flags in the database by removing invalid flags and ensuring all valid flags are present with correct metadata.
              </span>
              <div className="mt-2">
                <SyncFeatureFlagsButton />
              </div>
            </div>

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




          </div>
        </SwipeableTabsContent>

        {/* Testing Tools Tab */}
        <SwipeableTabsContent value="testing" className="space-y-4 pt-4">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Testing Tools</h2>
            <p className="text-muted-foreground">Admin-only tools for testing payout systems and token earnings</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Inactive Subscription Testing Tool */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Inactive Subscription Test
                </CardTitle>
                <CardDescription>
                  Test UI behavior when subscription appears as inactive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Show Inactive Subscription</span>
                    <p className="text-xs text-muted-foreground">
                      Makes subscription appear inactive for UI testing
                    </p>
                  </div>
                  <Switch
                    checked={inactiveSubscriptionEnabled}
                    onCheckedChange={handleInactiveSubscriptionToggle}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                  <strong>Note:</strong> This only affects the UI display for testing purposes.
                  It does not change actual subscription status or billing.
                </div>
              </CardContent>
            </Card>

            {/* Mock Token Earnings Tool */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Mock Token Earnings
                </CardTitle>
                <CardDescription>
                  Create test token earnings for your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Token Amount</label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={mockTokenAmount}
                    onChange={(e) => setMockTokenAmount(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleMockTokenEarnings}
                    disabled={mockEarningsLoading || resetEarningsLoading}
                    className="flex-1"
                  >
                    {mockEarningsLoading ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Mock Earnings'
                    )}
                  </Button>
                  <Button
                    onClick={handleResetMockEarnings}
                    disabled={mockEarningsLoading || resetEarningsLoading}
                    variant="outline"
                    className="flex-1"
                  >
                    {resetEarningsLoading ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      'Reset to Normal'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Payout Flow Testing Tool */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Test Payout Flow
                </CardTitle>
                <CardDescription>
                  Test the complete payout workflow for your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  This will test the complete flow: token allocation → earnings calculation → payout request → processing
                </div>
                <Button
                  onClick={handleTestPayoutFlow}
                  disabled={payoutTestLoading}
                  className="w-full"
                >
                  {payoutTestLoading ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Testing Payout Flow...
                    </>
                  ) : (
                    'Test Complete Payout Flow for My Account'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Payout System Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Payout System Status
                </CardTitle>
                <CardDescription>
                  Check the health and status of the payout system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleCheckPayoutStatus}
                  disabled={statusCheckLoading}
                  className="w-full"
                  variant="outline"
                >
                  {statusCheckLoading ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Checking Status...
                    </>
                  ) : (
                    'Check System Status'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Monthly Distribution Tool */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Monthly Distribution
                </CardTitle>
                <CardDescription>
                  Manually trigger monthly token distribution processing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Month (YYYY-MM)</label>
                  <Input
                    placeholder="2024-01"
                    value={distributionMonth}
                    onChange={(e) => setDistributionMonth(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleMonthlyDistribution}
                  disabled={distributionLoading}
                  className="w-full"
                  variant="outline"
                >
                  {distributionLoading ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Processing Distribution...
                    </>
                  ) : (
                    'Process Monthly Distribution'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </SwipeableTabsContent>

        {/* Payments & Payouts Tab */}
        <SwipeableTabsContent value="payments" className="space-y-4 pt-4">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Payment & Payout Systems</h2>
            <p className="text-muted-foreground">Real-time monitoring and management of financial operations</p>
          </div>

          <div className="grid gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common payment and payout management tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Link href="/admin/payments">
                    <Button className="w-full" variant="outline">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Full Monitoring Dashboard
                    </Button>
                  </Link>
                  <Button
                    onClick={() => window.open('/api/admin/webhook-validation', '_blank')}
                    className="w-full"
                    variant="outline"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Webhook Health Check
                  </Button>
                  <Button
                    onClick={() => window.open('/api/admin/payment-metrics', '_blank')}
                    className="w-full"
                    variant="outline"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    System Status API
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* System Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle>System Status Overview</CardTitle>
                <CardDescription>
                  High-level health indicators for payment and payout systems
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    For detailed monitoring, use the full dashboard
                  </p>
                  <Link href="/admin/payments">
                    <Button>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Open Payment Monitoring Dashboard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </SwipeableTabsContent>
      </SwipeableTabs>
      </div>
    </div>
  );
}
