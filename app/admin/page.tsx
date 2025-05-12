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
  parentFlag?: FeatureFlag; // Optional parent flag that must be enabled for this flag to be shown
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
      id: 'stripe_sandbox_mode',
      name: 'Stripe Sandbox Mode',
      description: 'Use Stripe test keys instead of production keys',
      enabled: true,
      adminOnly: true,
      parentFlag: 'subscription_management' // Only show when subscription_management is enabled
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

      // Determine if search is by email (contains @) or username
      const isEmailSearch = searchTerm.includes('@');

      let results: User[] = [];

      if (isEmailSearch) {
        // Search by exact email match
        const emailQuery = query(collection(db, 'users'), where('email', '==', searchTerm));
        const emailSnapshot = await getDocs(emailQuery);

        emailSnapshot.forEach(doc => {
          results.push({ id: doc.id, ...doc.data(), isAdmin: adminUsers.some(admin => admin.id === doc.id) } as User);
        });

        // If no exact match, try case-insensitive search (if email contains uppercase)
        if (results.length === 0 && searchTerm !== searchTerm.toLowerCase()) {
          const lowerEmailQuery = query(collection(db, 'users'), where('email', '==', searchTerm.toLowerCase()));
          const lowerEmailSnapshot = await getDocs(lowerEmailQuery);

          lowerEmailSnapshot.forEach(doc => {
            results.push({ id: doc.id, ...doc.data(), isAdmin: adminUsers.some(admin => admin.id === doc.id) } as User);
          });
        }
      } else {
        // Search by username
        const usernameQuery = query(collection(db, 'users'), where('username', '==', searchTerm));
        const usernameSnapshot = await getDocs(usernameQuery);

        usernameSnapshot.forEach(doc => {
          results.push({ id: doc.id, ...doc.data(), isAdmin: adminUsers.some(admin => admin.id === doc.id) } as User);
        });

        // If no results, try searching by email that contains the search term
        if (results.length === 0) {
          // We can't do a 'contains' query directly in Firestore, so we'll get all admin users
          // and filter them client-side (this is OK for admin panel with limited users)
          const usersQuery = query(collection(db, 'users'), limit(100));
          const usersSnapshot = await getDocs(usersQuery);

          usersSnapshot.forEach(doc => {
            const userData = doc.data();
            // Check if email contains search term (case insensitive)
            if (userData.email && userData.email.toLowerCase().includes(searchTerm.toLowerCase())) {
              if (!results.some(user => user.id === doc.id)) {
                results.push({ id: doc.id, ...userData, isAdmin: adminUsers.some(admin => admin.id === doc.id) } as User);
              }
            }
            // Check if username contains search term (case insensitive)
            else if (userData.username && userData.username.toLowerCase().includes(searchTerm.toLowerCase())) {
              if (!results.some(user => user.id === doc.id)) {
                results.push({ id: doc.id, ...userData, isAdmin: adminUsers.some(admin => admin.id === doc.id) } as User);
              }
            }
          });
        }
      }

      setSearchResults(results);

      if (results.length === 0) {
        toast({
          title: 'No users found',
          description: `No users found matching "${searchTerm}"`,
          variant: 'default'
        });
      }
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
      // Prevent removing jamiegray2234@gmail.com as admin
      if (user.isAdmin && user.email === 'jamiegray2234@gmail.com') {
        toast({
          title: 'Cannot Remove Primary Admin',
          description: 'This is the primary admin account and cannot be removed',
          variant: 'destructive'
        });
        return;
      }

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
              {featureFlags
                .filter(flag => {
                  // If the flag has a parent flag, only show it if the parent flag is enabled
                  if (flag.parentFlag) {
                    const parentFlag = featureFlags.find(f => f.id === flag.parentFlag);
                    return parentFlag?.enabled;
                  }
                  return true; // Show all flags without a parent flag
                })
                .map(flag => (
                <div
                  key={flag.id}
                  className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    // Don't toggle admin_features flag
                    if (flag.id !== 'admin_features' && !isLoading) {
                      toggleFeatureFlag(flag.id as FeatureFlag);
                    }
                  }}
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
                      onClick={(e) => e.stopPropagation()} // Prevent the card click from triggering when clicking the switch
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
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Add Admin User</CardTitle>
              <CardDescription>Search for a user by email or username to add them as an admin</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
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
            </CardContent>
          </Card>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Search Results</CardTitle>
                <CardDescription>Users matching your search query</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium text-sm">Username</th>
                        <th className="text-left p-3 font-medium text-sm">Email</th>
                        <th className="text-right p-3 font-medium text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map(user => (
                        <tr key={user.id} className="border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                          <td className="p-3 font-medium">{user.username || 'No username'}</td>
                          <td className="p-3 text-muted-foreground">{user.email}</td>
                          <td className="p-3 text-right">
                            <Button
                              variant={user.isAdmin ? "destructive" : "outline"}
                              size="sm"
                              onClick={() => toggleAdminStatus(user)}
                              disabled={isLoading || user.email === 'jamiegray2234@gmail.com'}
                            >
                              {isLoading ? (
                                <Loader className="h-4 w-4 animate-spin" />
                              ) : user.isAdmin ? (
                                "Remove Admin"
                              ) : (
                                "Make Admin"
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Admin Users */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Admin Users</CardTitle>
              <CardDescription>Users with administrative privileges</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : adminUsers.length > 0 ? (
                <div className="border rounded-md">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium text-sm">Username</th>
                        <th className="text-left p-3 font-medium text-sm">Email</th>
                        <th className="text-right p-3 font-medium text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map(admin => (
                        <tr key={admin.id} className="border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{admin.username || 'No username'}</span>
                              {admin.email === 'jamiegray2234@gmail.com' && (
                                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Primary Admin</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{admin.email}</td>
                          <td className="p-3 text-right">
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No admin users found
                </div>
              )}
            </CardContent>
          </Card>
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
