"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAccount } from "../providers/CurrentAccountProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';

import { SwipeableTabs, SwipeableTabsList, SwipeableTabsTrigger, SwipeableTabsContent } from '../components/ui/swipeable-tabs';
import { Search, Users, Settings, Loader, Check, X, Shield, RefreshCw, Smartphone, ChevronLeft, ChevronRight, BarChart3, DollarSign, Eye } from 'lucide-react';
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
  const { currentAccount, isLoading: authLoading } = useCurrentAccount();
  const router = useRouter();
  const { toast } = useToast();
  const { resetBannerState } = usePWA();
  const [activeTab, setActiveTab] = useState('features');

  // State for state simulator
  const [simulatorVisible, setSimulatorVisible] = useState(true);

  // Valid tab values for hash navigation
  const validTabs = ['features', 'users', 'tools'];
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
    console.log('[Admin Testing] Current user on mount:', currentAccount);

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
  }, [currentAccount]);

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
    if (!authLoading && currentAccount) {
      if (currentAccount.email !== 'jamiegray2234@gmail.com') {
        router.push('/');
      } else {
        try {
          loadAdminUsers();
          loadFeatureFlags();
        } catch (error) {
          console.error('Error in admin data loading:', error);
        }
      }
    } else if (!authLoading && !currentAccount) {
      router.push('/auth/login?redirect=/admin');
    }
  }, [currentAccount, authLoading, router]);

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

  // Toggle feature flag with robust error handling and retry logic
  const toggleFeatureFlag = async (flagId: FeatureFlag, newState?: boolean) => {
    try {
      setIsLoading(true);

      // Check if user is admin
      if (!currentAccount || currentAccount.email !== 'jamiegray2234@gmail.com') {
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
          flag.id === flagId ? { ...flag, enabled: newEnabledState ?? false } : flag
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

    if (!currentAccount?.email) {
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
          description: `Successfully created ${mockTokenAmount} tokens for your account`});
        setMockTokenAmount('');
      } else {
        toast({
          title: "Failed to Create Mock Earnings",
          description: (result as any).error || "An error occurred",
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
    if (!currentAccount?.email) {
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
          description: summary});
      } else {
        toast({
          title: "Reset Failed",
          description: (result as any).error || "An error occurred",
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
    console.log('[Admin Testing] Current user:', currentAccount);

    if (!currentAccount?.email) {
      console.error('[Admin Testing] User not found or no email for payout test:', currentAccount);
      toast({
        title: "User Not Found",
        description: "Unable to identify current user",
        variant: "destructive"
      });
      return;
    }

    setPayoutTestLoading(true);
    try {
      const requestBody = { userEmail: currentAccount.email };
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
          : "Subscription will show normal status"});
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

  // Check simulator visibility on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isHidden = sessionStorage.getItem('admin-state-simulator-hidden') === 'true';
      setSimulatorVisible(!isHidden);
    }
  }, []);

  // Function to show the simulator
  const showSimulator = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin-state-simulator-hidden');
      setSimulatorVisible(true);
      // Refresh the page to re-mount the simulator
      window.location.reload();
    }
  };

  // Function to reset simulator state
  const resetSimulatorState = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin-state-simulator');
      sessionStorage.removeItem('admin-state-simulator-hidden');
      setSimulatorVisible(true);
      window.location.reload();
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

  if (!currentAccount) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (currentAccount.email !== 'jamiegray2234@gmail.com') {
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
                        <span className="font-medium">{currentAccount.username || 'No username'}</span>
                        <span className="text-xs text-muted-foreground">{currentAccount.email}</span>
                      </div>
                      <Button
                        variant={user.isAdmin ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => toggleAdminStatus(currentAccount as any)}
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

            {/* Admin State Simulator */}
            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Admin State Simulator</h3>
                <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
                  {simulatorVisible ? 'Visible' : 'Hidden'}
                </span>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Floating UI for simulating auth, subscription, and token states for testing
              </span>
              <div className="mt-2 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={showSimulator}
                  disabled={simulatorVisible}
                >
                  <Eye className="h-4 w-4" />
                  {simulatorVisible ? 'Already Visible' : 'Show Simulator'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={resetSimulatorState}
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset State
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

            {/* Testing Tools */}
            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Testing Tools</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Test payout systems, token earnings, and subscription states
              </span>
              <div className="mt-2 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => {
                    const enabled = !inactiveSubscriptionEnabled;
                    handleInactiveSubscriptionToggle(enabled);
                  }}
                >
                  <DollarSign className="h-4 w-4" />
                  {inactiveSubscriptionEnabled ? 'Disable' : 'Enable'} Inactive Subscription Test
                </Button>
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