"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

import { SwipeableTabs, SwipeableTabsList, SwipeableTabsTrigger, SwipeableTabsContent } from '../components/ui/swipeable-tabs';
import { Search, Users, Settings, Loader, Check, X, Shield, RefreshCw, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../firebase/database';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '../components/ui/use-toast';
import { FeatureFlag, isAdmin } from '../utils/feature-flags';
import { usePWA } from '../providers/PWAProvider';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import SyncFeatureFlagsButton from '../components/SyncFeatureFlagsButton';
import Link from 'next/link';
import FeatureFlagCard from '../components/admin/FeatureFlagCard';
import FeatureFlagTestPanel from '../components/FeatureFlagTestPanel';

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

  // Feature flags state - using system string names for easier identification
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagState[]>([
    {
      id: 'payments',
      name: 'payments',
      description: 'Enable subscription functionality and UI for managing user subscriptions',
      enabled: false
    },
    {
      id: 'username_management',
      name: 'username_management',
      description: 'Allow admins to manage user usernames and handle username-related operations',
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
      id: 'notifications',
      name: 'notifications',
      description: 'Enable in-app notifications for follows, page links, and other activities',
      enabled: false
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

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && user) {
      if (user.email !== 'jamiegray2234@gmail.com') {
        router.push('/');
      } else {
        loadAdminUsers();
        loadFeatureFlags();
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
        title: 'Error',
        description: 'Failed to load admin users',
        variant: 'destructive'
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
        console.log('[DEBUG] Feature flags from database:', flagsData);

        // Filter out any flags that aren't defined in our FeatureFlag type
        const validFlags = {};
        Object.keys(flagsData).forEach(key => {
          // Only include keys that match our defined feature flags
          if (featureFlags.some(flag => flag.id === key)) {
            validFlags[key] = flagsData[key];
          } else {
            console.log(`[DEBUG] Removing undefined feature flag from database: ${key}`);
          }
        });

        // Specifically check for admin_features flag
        if ('admin_features' in flagsData) {
          console.log('[DEBUG] Found admin_features flag in database, removing it');
          // No need to add it to validFlags since it's not in our FeatureFlag type
        }

        // Update local state with data from Firestore
        setFeatureFlags(prev => {
          const updatedFlags = prev.map(flag => ({
            ...flag,
            enabled: validFlags[flag.id] !== undefined ? validFlags[flag.id] : flag.enabled
          }));
          console.log('[DEBUG] Updated local feature flags state:', updatedFlags);
          return updatedFlags;
        });

        // Check if the 'groups' flag exists in the database
        if (validFlags['groups'] === undefined) {
          console.log("[DEBUG] 'groups' feature flag not found in database, initializing it");

          // Add the 'groups' flag to the database
          await setDoc(featureFlagsRef, {
            ...validFlags,
            groups: false // Initialize as disabled
          });
        }

        // If we found invalid flags, update the database to remove them
        if (Object.keys(validFlags).length !== Object.keys(flagsData).length) {
          console.log('[DEBUG] Updating database to remove invalid feature flags');
          await setDoc(featureFlagsRef, validFlags);
        }
      } else {
        // If the document doesn't exist, create it with all feature flags
        console.log("[DEBUG] Feature flags document not found, creating it");

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

  // Toggle feature flag
  const toggleFeatureFlag = async (flagId: FeatureFlag, newState?: boolean) => {
    try {
      setIsLoading(true);
      console.log(`[DEBUG] Starting toggle for feature flag: ${flagId}`);

      // Get current feature flags from database first to avoid race conditions
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      let flagsData = {};
      if (featureFlagsDoc.exists()) {
        flagsData = featureFlagsDoc.data();
        console.log('[DEBUG] Current flags in database:', flagsData);

        // Check if admin_features flag exists and remove it
        if ('admin_features' in flagsData) {
          console.log('[DEBUG] Found admin_features flag in database, removing it');
          delete flagsData['admin_features'];
        }
      }

      // Get the current value from the database (not local state)
      const currentDatabaseValue = flagsData[flagId] || false;
      const newEnabledState = newState !== undefined ? newState : !currentDatabaseValue;

      console.log(`[DEBUG] Current database value for ${flagId}: ${currentDatabaseValue}`);
      console.log(`[DEBUG] New value for ${flagId}: ${newEnabledState}`);

      // Update the database first
      const updatedFlagsData = {
        ...flagsData,
        [flagId]: newEnabledState
      };

      console.log('[DEBUG] Updated flags to save:', updatedFlagsData);

      await setDoc(featureFlagsRef, updatedFlagsData);
      console.log(`[DEBUG] Successfully updated ${flagId} in database to ${newEnabledState}`);

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
      console.error('[DEBUG] Error toggling feature flag:', error);

      // Provide more specific error messages
      let errorMessage = 'Failed to update feature flag';
      if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. You may not have admin access.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Database is temporarily unavailable. Please try again.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });

      // Reload feature flags from database to ensure consistency
      await loadFeatureFlags();
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

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="mb-8">
        <Link href="/account" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Account
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
        tabsListClassName="flex w-full mb-6 overflow-x-auto scrollbar-hide"
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

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featureFlags.map(flag => (
                  <FeatureFlagCard
                    key={flag.id}
                    flag={flag}
                    onToggle={(flagId, checked) => toggleFeatureFlag(flagId, checked)}
                    isLoading={isLoading}
                  />
                ))}
              </div>
            </>
          )}
        </SwipeableTabsContent>

        {/* Admin Users Tab */}
        <SwipeableTabsContent value="users" className="space-y-4 pt-4">
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

            {/* Groups Debug Tool */}
            <div className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Groups Feature Debug</h3>
              </div>
              <span className="text-sm text-muted-foreground mb-3">
                Debug tools for the Groups feature.
              </span>
              <div className="mt-2 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={async () => {
                    try {
                      // Import RTDB
                      const { rtdb } = await import('../firebase/rtdb');
                      const { ref, get } = await import('firebase/database');

                      // Check if RTDB is initialized
                      console.log('[DEBUG] RTDB Debug - RTDB instance:', rtdb);

                      // Check if groups node exists
                      const groupsRef = ref(rtdb, 'groups');
                      const groupsSnapshot = await get(groupsRef);

                      console.log('[DEBUG] RTDB Debug - Groups node exists:', groupsSnapshot.exists());
                      console.log('[DEBUG] RTDB Debug - Groups data:', groupsSnapshot.val());

                      toast({
                        title: 'Groups Debug',
                        description: `Groups node exists: ${groupsSnapshot.exists()}. Check console for details.`,
                        variant: 'default'
                      });
                    } catch (error) {
                      console.error('[DEBUG] RTDB Debug - Error:', error);

                      toast({
                        title: 'Error',
                        description: `Error debugging groups: ${error.message}`,
                        variant: 'destructive'
                      });
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Check RTDB Groups
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={async () => {
                    try {
                      // Check feature flag in Firestore
                      const { doc, getDoc } = await import('firebase/firestore');
                      const { db } = await import('../firebase/database');

                      const featureFlagsRef = doc(db, 'config', 'featureFlags');
                      const featureFlagsDoc = await getDoc(featureFlagsRef);

                      if (featureFlagsDoc.exists()) {
                        const flagsData = featureFlagsDoc.data();
                        console.log('[DEBUG] Feature Flags Debug - Flags data:', flagsData);
                        console.log('[DEBUG] Feature Flags Debug - Groups flag:', flagsData['groups']);

                        toast({
                          title: 'Feature Flags Debug',
                          description: `Groups flag: ${flagsData['groups'] ? 'Enabled' : 'Disabled'}. Check console for details.`,
                          variant: 'default'
                        });
                      } else {
                        console.log('[DEBUG] Feature Flags Debug - No feature flags document found');

                        toast({
                          title: 'Feature Flags Debug',
                          description: 'No feature flags document found in Firestore.',
                          variant: 'destructive'
                        });
                      }
                    } catch (error) {
                      console.error('[DEBUG] Feature Flags Debug - Error:', error);

                      toast({
                        title: 'Error',
                        description: `Error debugging feature flags: ${error.message}`,
                        variant: 'destructive'
                      });
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Check Feature Flags
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={async () => {
                    try {
                      if (!user?.uid) {
                        toast({
                          title: 'Error',
                          description: 'User not logged in',
                          variant: 'destructive'
                        });
                        return;
                      }

                      // Import RTDB functions
                      const { rtdb } = await import('../firebase/rtdb');
                      const { ref, push, set } = await import('firebase/database');

                      // Create a test group
                      const groupsRef = ref(rtdb, 'groups');
                      const newGroupRef = push(groupsRef);

                      // Group data
                      const groupData = {
                        name: 'Test Group',
                        description: 'A test group created for debugging',
                        owner: user.uid,
                        createdAt: new Date().toISOString(),
                        members: {
                          [user.uid]: {
                            role: 'owner',
                            joinedAt: new Date().toISOString()
                          }
                        }
                      };

                      // Save the group
                      await set(newGroupRef, groupData);

                      // Add the group to the user's groups
                      const userGroupsRef = ref(rtdb, `users/${user.uid}/groups`);
                      await set(userGroupsRef, {
                        [newGroupRef.key]: true
                      });

                      console.log('[DEBUG] Created test group:', newGroupRef.key);

                      toast({
                        title: 'Success',
                        description: `Created test group with ID: ${newGroupRef.key}`,
                        variant: 'default'
                      });
                    } catch (error) {
                      console.error('[DEBUG] Error creating test group:', error);

                      toast({
                        title: 'Error',
                        description: `Error creating test group: ${error.message}`,
                        variant: 'destructive'
                      });
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Create Test Group
                </Button>
              </div>
            </div>
          </div>

          {/* Feature Flag Testing Panel */}
          <div className="mt-8">
            <FeatureFlagTestPanel />
          </div>
        </SwipeableTabsContent>
      </SwipeableTabs>
    </div>
  );
}
