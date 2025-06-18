"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from "../providers/AuthProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';

import { SwipeableTabs, SwipeableTabsList, SwipeableTabsTrigger, SwipeableTabsContent } from '../components/ui/swipeable-tabs';
import { Search, Users, Settings, Loader, Check, X, Shield, RefreshCw, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from "../firebase/database";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '../components/ui/use-toast';
import { FeatureFlag, isAdmin } from "../utils/feature-flags";
import { usePWA } from '../providers/PWAProvider';
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import SyncFeatureFlagsButton from '../components/utils/SyncFeatureFlagsButton';
import Link from 'next/link';
import FeatureFlagCard from '../components/admin/FeatureFlagCard';
import { UserManagement } from '../components/admin/UserManagement';


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

  // User management state
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hideGloballyEnabled, setHideGloballyEnabled] = useState(false);

  // Feature flags state - using system string names for easier identification
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagState[]>([
    {
      id: 'payments',
      name: 'payments',
      description: 'Enable subscription functionality and UI for managing user subscriptions',
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
    },
    {
      id: 'groups',
      name: 'groups',
      description: 'Enable group functionality for organizing pages and collaboration',
      enabled: true
    },

    {
      id: 'link_functionality',
      name: 'link_functionality',
      description: 'Enable link creation and editing in page editors. When disabled, shows a modal with social media follow prompt',
      enabled: true
    },
    {
      id: 'daily_notes',
      name: 'daily_notes',
      description: 'Enable daily notes section on home page with calendar day cards for quick note creation and access',
      enabled: false
    }
  ]);

  // Load filter state from session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFilterState = sessionStorage.getItem('admin-hide-globally-enabled');
      if (savedFilterState !== null) {
        setHideGloballyEnabled(JSON.parse(savedFilterState));
      }
    }
  }, []);

  // Persist filter state to session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('admin-hide-globally-enabled', JSON.stringify(hideGloballyEnabled));
    }
  }, [hideGloballyEnabled]);

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

        // Check if the 'groups' flag exists in the database
        if (validFlags['groups'] === undefined) {
          // Add the 'groups' flag to the database
          await setDoc(featureFlagsRef, {
            ...validFlags,
            groups: false // Initialize as disabled
          });
        }

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
        onValueChange={setActiveTab}
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
          </div>
        </SwipeableTabsList>

        {/* Feature Flags Tab */}
        <SwipeableTabsContent value="features" className="space-y-4 pt-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Feature Flags</h2>
              <p className="text-muted-foreground">Enable or disable features across the platform</p>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center space-x-2 mb-4 p-3 bg-muted/30 rounded-lg border">
            <Checkbox
              id="hide-globally-enabled"
              checked={hideGloballyEnabled}
              onCheckedChange={(checked) => setHideGloballyEnabled(checked as boolean)}
            />
            <label
              htmlFor="hide-globally-enabled"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Hide globally enabled flags
            </label>
            <span className="text-xs text-muted-foreground ml-2">
              ({filteredFeatureFlags.length} of {featureFlags.length} flags shown)
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  onClick={() => setActiveTab('features')}
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




          </div>


        </SwipeableTabsContent>
      </SwipeableTabs>
    </div>
  );
}
