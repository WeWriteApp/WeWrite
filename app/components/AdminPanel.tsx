"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Search, Users, Settings, Loader, Check, X, Shield, RefreshCw, Smartphone } from 'lucide-react';
import { db } from '../firebase/database';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from './ui/use-toast';
import { FeatureFlag, isAdmin } from '../utils/feature-flags';
import { usePWA } from '../providers/PWAProvider';
import { getAnalyticsService } from '../utils/analytics-service';
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

interface AdminPanelProps {
  userEmail: string;
}

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

export default function AdminPanel({ userEmail }: AdminPanelProps) {
  // Only show admin panel for specific user
  if (userEmail !== 'jamiegray2234@gmail.com') {
    return null;
  }

  const { toast } = useToast();
  const { resetBannerState } = usePWA();
  const [activeTab, setActiveTab] = useState('features');
  const [isOpen, setIsOpen] = useState(false);

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
      name: 'Subscription Management',
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

  // Load admin users and feature flags on mount
  useEffect(() => {
    if (isOpen) {
      loadAdminUsers();
      loadFeatureFlags();
    }
  }, [isOpen]);

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

  // Search for users
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

  // Handle PWA alert trigger
  const handleTriggerPWAAlert = () => {
    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.ADMIN,
        action: ANALYTICS_EVENTS.PWA_BANNER_RESET,
        label: userEmail,
      });
    } catch (error) {
      console.error('Error tracking admin action:', error);
    }

    resetBannerState();

    toast({
      title: 'Success',
      description: 'PWA installation banner has been reset',
      variant: 'default'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Admin Panel
        </CardTitle>
        <CardDescription>
          Manage feature flags and admin settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-4">
          <CollapsibleTrigger asChild>
            <Button
              variant={isOpen ? "secondary" : "default"}
              className="w-full"
            >
              <Shield className="h-4 w-4 mr-2" />
              {isOpen ? "Close Admin Panel" : "Open Admin Panel"}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="features">
                  <Settings className="h-4 w-4 mr-2" />
                  Feature Flags
                </TabsTrigger>
                <TabsTrigger value="users">
                  <Users className="h-4 w-4 mr-2" />
                  Admin Users
                </TabsTrigger>
                <TabsTrigger value="tools">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Admin Tools
                </TabsTrigger>
              </TabsList>

              {/* Feature Flags Tab - Removed */}
              <TabsContent value="features" className="space-y-4">
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Feature Flags Moved</h3>
                  <p className="text-muted-foreground mb-4">
                    Feature flag management has been moved to the home page debugger.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/'}
                  >
                    Go to Home Page
                  </Button>
                </div>
              </TabsContent>

              {/* Admin Users Tab */}
              <TabsContent value="users" className="space-y-4">
                {/* Search */}
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

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Search Results</h3>
                    <div className="space-y-2">
                      {searchResults.map(user => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 rounded-md border border-border/40 hover:bg-muted/50 transition-colors"
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
                <div className="space-y-2 mt-4">
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
                          className="flex items-center justify-between p-3 rounded-md border border-border/40 bg-primary/5 hover:bg-primary/10 transition-colors"
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
                    <div className="text-sm text-muted-foreground">No admin users found</div>
                  )}
                </div>
              </TabsContent>

              {/* Admin Tools Tab */}
              <TabsContent value="tools" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">PWA Testing</h3>
                    <p className="text-sm text-muted-foreground">
                      Test the PWA installation banner by forcing it to appear.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-2"
                      onClick={handleTriggerPWAAlert}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Trigger PWA Alert
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
