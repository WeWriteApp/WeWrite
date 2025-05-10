"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { SwipeableTabs, SwipeableTabsList, SwipeableTabsTrigger, SwipeableTabsContent } from '../components/ui/swipeable-tabs';
import { Search, Users, Settings, Loader, Check, X, Shield, RefreshCw, Smartphone, ChevronLeft } from 'lucide-react';
import { db } from '../firebase/database';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '../components/ui/use-toast';
import { FeatureFlag, isAdmin } from '../utils/feature-flags';
import { usePWA } from '../providers/PWAProvider';
import Link from 'next/link';

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
  adminOnly: boolean;
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

  // Feature flags state
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagState[]>([
    {
      id: 'subscription_management',
      name: 'Subscription',
      description: 'Enable subscription functionality and UI',
      enabled: false,
      adminOnly: true
    },
    {
      id: 'username_management',
      name: 'Username Management',
      description: 'Allow admins to manage user usernames',
      enabled: false,
      adminOnly: true
    },
    {
      id: 'map_view',
      name: 'Map View',
      description: 'Enable map view for pages with location data',
      enabled: false,
      adminOnly: false
    },
    {
      id: 'calendar_view',
      name: 'Calendar View',
      description: 'Enable calendar view for activity tracking',
      enabled: false,
      adminOnly: false
    },
    {
      id: 'groups',
      name: 'Groups',
      description: 'Enable groups functionality and UI',
      enabled: false,
      adminOnly: false
    },
    {
      id: 'admin_features',
      name: 'Admin Features',
      description: 'Enable admin-only features',
      enabled: true,
      adminOnly: true
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

        // Update local state with data from Firestore
        setFeatureFlags(prev =>
          prev.map(flag => ({
            ...flag,
            enabled: flagsData[flag.id] !== undefined ? flagsData[flag.id] : flag.enabled
          }))
        );
      }
    } catch (error) {
      console.error('Error loading feature flags:', error);
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
  const toggleFeatureFlag = async (flagId: FeatureFlag) => {
    try {
      setIsLoading(true);

      // Update local state first for immediate feedback
      setFeatureFlags(prev =>
        prev.map(flag =>
          flag.id === flagId ? { ...flag, enabled: !flag.enabled } : flag
        )
      );

      // Get current feature flags
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      let flagsData = {};

      if (featureFlagsDoc.exists()) {
        flagsData = featureFlagsDoc.data();
      }

      // Update feature flag
      const updatedFlag = featureFlags.find(flag => flag.id === flagId);
      if (updatedFlag) {
        flagsData = {
          ...flagsData,
          [flagId]: !updatedFlag.enabled
        };
      }

      // Update Firestore
      await setDoc(featureFlagsRef, flagsData);

      toast({
        title: 'Success',
        description: `${flagId} is now ${updatedFlag?.enabled ? 'disabled' : 'enabled'}`,
        variant: 'default'
      });
    } catch (error) {
      console.error('Error toggling feature flag:', error);
      toast({
        title: 'Error',
        description: 'Failed to update feature flag',
        variant: 'destructive'
      });

      // Revert local state on error
      loadFeatureFlags();
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
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Feature Flags</h2>
            <p className="text-muted-foreground">Enable or disable features across the platform</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featureFlags.map(flag => (
                <div
                  key={flag.id}
                  className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{flag.name}</span>
                      {flag.adminOnly && (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          Admin Only
                        </span>
                      )}
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => toggleFeatureFlag(flag.id as FeatureFlag)}
                      disabled={isLoading || flag.id === 'admin_features'} // Prevent disabling admin features
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">{flag.description}</span>
                  <div className="mt-2">
                    <span className="text-xs font-medium">
                      {flag.enabled ? (
                        <span className="text-green-600 dark:text-green-400 flex items-center">
                          <Check className="h-3 w-3 mr-1" />
                          Enabled
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 flex items-center">
                          <X className="h-3 w-3 mr-1" />
                          Disabled
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
          </div>
        </SwipeableTabsContent>
      </SwipeableTabs>
    </div>
  );
}
