"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { useToast } from '../../components/ui/use-toast';

/**
 * Admin page for managing feature flags
 * Only accessible to admin users
 */
export default function FeatureFlagsAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [featureFlags, setFeatureFlags] = useState<any>({});
  const [userOverrides, setUserOverrides] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Check if user is admin
  const isAdmin = user?.email === 'jamiegray2234@gmail.com';

  useEffect(() => {
    if (!isAdmin) return;
    
    loadFeatureFlags();
  }, [isAdmin]);

  const loadFeatureFlags = async () => {
    try {
      setLoading(true);

      const { db } = await import('../../firebase/config');
      const { doc, getDoc } = await import('firebase/firestore');

      // Load global feature flags
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      if (featureFlagsDoc.exists()) {
        const flags = featureFlagsDoc.data();
        setFeatureFlags(flags);
        console.log('📋 Loaded global feature flags:', flags);
      } else {
        console.log('📋 No feature flags document found');
        setFeatureFlags({});
      }

      // Load user-specific overrides
      if (user?.uid) {
        const overrides: any = {};
        const flagKeys = ['payments', 'groups', 'link_functionality', 'daily_notes', 'notifications', 'map_view', 'calendar_view'];

        for (const flagKey of flagKeys) {
          const overrideRef = doc(db, 'featureOverrides', `${user.uid}_${flagKey}`);
          const overrideDoc = await getDoc(overrideRef);

          if (overrideDoc.exists()) {
            overrides[flagKey] = overrideDoc.data().enabled;
          }
        }

        setUserOverrides(overrides);
        console.log('📋 Loaded user overrides:', overrides);
      }
    } catch (error) {
      console.error('❌ Error loading feature flags:', error);
      toast({
        title: "Error",
        description: "Failed to load feature flags",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateFeatureFlag = async (flagName: string, enabled: boolean) => {
    try {
      setSaving(true);
      
      const { db } = await import('../../firebase/config');
      const { doc, setDoc } = await import('firebase/firestore');
      
      const updatedFlags = {
        ...featureFlags,
        [flagName]: enabled
      };
      
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      await setDoc(featureFlagsRef, updatedFlags);
      
      setFeatureFlags(updatedFlags);
      
      toast({
        title: "Success",
        description: `${flagName} feature flag ${enabled ? 'enabled' : 'disabled'}`,
      });
      
      console.log(`✅ ${flagName} feature flag ${enabled ? 'enabled' : 'disabled'}`);
      
    } catch (error) {
      console.error('❌ Error updating feature flag:', error);
      toast({
        title: "Error",
        description: "Failed to update feature flag",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const enableAllPaymentFeatures = async () => {
    try {
      setSaving(true);
      
      const { db } = await import('../../firebase/config');
      const { doc, setDoc } = await import('firebase/firestore');
      
      const updatedFlags = {
        ...featureFlags,
        payments: true
      };
      
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      await setDoc(featureFlagsRef, updatedFlags);
      
      setFeatureFlags(updatedFlags);
      
      toast({
        title: "Success",
        description: "Payments feature enabled! Please refresh the page to see changes.",
      });
      
      console.log('✅ Payments feature enabled successfully!');
      
    } catch (error) {
      console.error('❌ Error enabling payments:', error);
      toast({
        title: "Error",
        description: "Failed to enable payments feature",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>This page is only accessible to administrators.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const flagDefinitions = [
    { key: 'payments', label: 'Payments & Subscriptions', description: 'Enable payment processing, subscriptions, and pledge functionality' },
    { key: 'groups', label: 'Groups', description: 'Enable group collaboration features' },
    { key: 'link_functionality', label: 'Link Functionality', description: 'Enable advanced link editing and compound links' },
    { key: 'daily_notes', label: 'Daily Notes', description: 'Enable daily notes feature' },
    { key: 'notifications', label: 'Notifications', description: 'Enable notification system' },
    { key: 'map_view', label: 'Map View', description: 'Enable map-based content discovery' },
    { key: 'calendar_view', label: 'Calendar View', description: 'Enable calendar-based content view' },
  ];

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Feature Flags Administration</h1>
        <p className="text-muted-foreground">Manage feature flags for the WeWrite application</p>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> For personal feature flag overrides and advanced management, visit the{' '}
            <a href="/admin" className="underline hover:no-underline">main admin page</a> and go to the Feature Flags tab.
          </p>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4">Loading feature flags...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Quick Action for Payments */}
          <Card className="border-success/20 bg-success/5">
            <CardHeader>
              <CardTitle className="text-success">Quick Fix: Enable Payments</CardTitle>
              <CardDescription className="text-success/80">
                This will enable the payments feature flag to show payment sections in settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={enableAllPaymentFeatures}
                disabled={saving || featureFlags.payments === true}
                className="bg-success hover:bg-success/90 text-success-foreground"
              >
                {featureFlags.payments === true ? '✅ Payments Already Enabled' : '🚀 Enable Payments Feature'}
              </Button>
            </CardContent>
          </Card>

          {/* Individual Feature Flags */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>Toggle individual features on or off</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {flagDefinitions.map((flag) => (
                <div key={flag.key} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Label htmlFor={flag.key} className="font-medium">{flag.label}</Label>
                      <Badge variant={featureFlags[flag.key] ? "default" : "secondary"}>
                        {featureFlags[flag.key] ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{flag.description}</p>
                  </div>
                  <Switch
                    id={flag.key}
                    checked={featureFlags[flag.key] || false}
                    onCheckedChange={(checked) => updateFeatureFlag(flag.key, checked)}
                    disabled={saving}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Current State */}
          <Card>
            <CardHeader>
              <CardTitle>Current Feature Flag State</CardTitle>
              <CardDescription>Raw data from Firebase</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(featureFlags, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
