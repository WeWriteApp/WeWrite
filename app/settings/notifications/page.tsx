"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import NavPageLayout from '../../components/layout/NavPageLayout';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { Bell, Smartphone, Monitor, Loader2 } from 'lucide-react';

// Notification types that users can configure
const NOTIFICATION_TYPES = [
  {
    id: 'follow',
    title: 'New Followers',
    description: 'When someone follows you'
  },
  {
    id: 'link',
    title: 'Page Mentions',
    description: 'When someone links to your page'
  },
  {
    id: 'append',
    title: 'Page Additions',
    description: 'When someone adds your page to their page'
  },
  {
    id: 'payout_completed',
    title: 'Payouts Completed',
    description: 'When your payout is successfully processed'
  },
  {
    id: 'payout_failed',
    title: 'Payout Issues',
    description: 'When there are issues with your payouts'
  },
  {
    id: 'email_verification',
    title: 'Account Verification',
    description: 'Important account security notifications'
  },
  {
    id: 'system_updates',
    title: 'System Updates',
    description: 'Platform updates and maintenance notifications'
  }
];

interface NotificationPreferences {
  [key: string]: {
    push: boolean;
    inApp: boolean;
  };
}

export default function NotificationSettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allPushEnabled = NOTIFICATION_TYPES.every((type) => preferences[type.id]?.push);
  const allInAppEnabled = NOTIFICATION_TYPES.every((type) => preferences[type.id]?.inApp);
  const allEnabled = allPushEnabled && allInAppEnabled;

  // Initialize default preferences
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Set default preferences (all enabled for both push and in-app)
    const defaultPreferences: NotificationPreferences = {};
    NOTIFICATION_TYPES.forEach(type => {
      defaultPreferences[type.id] = {
        push: true,
        inApp: true
      };
    });

    setPreferences(defaultPreferences);
    setLoading(false);

    // TODO: Load actual preferences from API
    // loadNotificationPreferences();
  }, [user, isAuthenticated]);

  const handlePreferenceChange = (typeId: string, channel: 'push' | 'inApp', enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        [channel]: enabled
      }
    }));
  };

  const handleToggleAll = (channel: 'push' | 'inApp', enabled: boolean) => {
    setPreferences((prev) => {
      const updated: NotificationPreferences = { ...prev };
      NOTIFICATION_TYPES.forEach((type) => {
        updated[type.id] = {
          ...(updated[type.id] || { push: false, inApp: false }),
          [channel]: enabled
        };
      });
      return updated;
    });
  };

  const handleToggleAllChannels = (enabled: boolean) => {
    setPreferences((prev) => {
      const updated: NotificationPreferences = { ...prev };
      NOTIFICATION_TYPES.forEach((type) => {
        updated[type.id] = {
          push: enabled,
          inApp: enabled
        };
      });
      return updated;
    });
  };

  const handleToggleTypeAll = (typeId: string, enabled: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      [typeId]: {
        push: enabled,
        inApp: enabled
      }
    }));
  };

  const handleSavePreferences = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // TODO: Save preferences to API
      console.log('Saving notification preferences:', preferences);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Notification preferences saved successfully');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <NavPageLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Notification Settings</h1>
          <p className="text-muted-foreground">
            Customize how you receive notifications across different channels
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Channel Explanation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Channels
                </CardTitle>
                <CardDescription>
                  Choose how you want to receive each type of notification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Smartphone className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium">Push Notifications</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications on your device even when the app is closed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Monitor className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium">In-App Alerts</h4>
                      <p className="text-sm text-muted-foreground">
                        See notifications when you're using the app
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notification Types */}
            <Card>
              <CardHeader>
                <CardTitle>Notification Types</CardTitle>
                <CardDescription>
                  Configure each type of notification individually
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Column Headers */}
                  <div className="grid grid-cols-3 md:grid-cols-4 items-start pb-2 border-b border-border text-center gap-3">
                    <div className="text-sm font-medium text-muted-foreground text-left md:text-left">
                      Notification Type
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Push</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">In-App</span>
                    </div>
                    <div className="hidden md:flex flex-col items-center gap-1">
                      <Button
                        size="sm"
                        variant={allEnabled ? 'secondary' : 'outline'}
                        className="px-3 h-8"
                        onClick={() => handleToggleAllChannels(!allEnabled)}
                        aria-label={allEnabled ? 'Turn off all notifications' : 'Turn on all notifications'}
                      >
                        {allEnabled ? 'Turn all off' : 'Turn all on'}
                      </Button>
                    </div>
                  </div>

                  {/* Mobile all toggle */}
                  <div className="flex md:hidden justify-end">
                    <Button
                      size="sm"
                      variant={allEnabled ? 'secondary' : 'outline'}
                      className="px-3 h-8"
                      onClick={() => handleToggleAllChannels(!allEnabled)}
                      aria-label={allEnabled ? 'Turn off all notifications' : 'Turn on all notifications'}
                    >
                      {allEnabled ? 'All off' : 'All on'}
                    </Button>
                  </div>

                  {/* Notification Rows */}
                  <div className="space-y-4">
                    {NOTIFICATION_TYPES.map((type, index) => (
                      <div key={type.id}>
                      <div className="flex items-start justify-between py-2">
                        <div className="flex-1">
                          <h4 className="font-medium">{type.title}</h4>
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <div className="grid grid-cols-2 gap-4 w-48 sm:w-56 md:w-64 justify-items-center">
                            {/* Push Notifications Toggle */}
                            <div className="flex items-center justify-center">
                              <Switch
                                checked={preferences[type.id]?.push || false}
                                onCheckedChange={(checked) =>
                                  handlePreferenceChange(type.id, 'push', checked)
                                }
                                aria-label={`${type.title} push notifications`}
                              />
                            </div>

                            {/* In-App Alerts Toggle */}
                            <div className="flex items-center justify-center">
                              <Switch
                                checked={preferences[type.id]?.inApp || false}
                                onCheckedChange={(checked) =>
                                  handlePreferenceChange(type.id, 'inApp', checked)
                                }
                                aria-label={`${type.title} in-app alerts`}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => handleToggleTypeAll(type.id, true)}
                              aria-label={`Turn all ${type.title} notifications on`}
                            >
                              All on
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => handleToggleTypeAll(type.id, false)}
                              aria-label={`Turn all ${type.title} notifications off`}
                            >
                              All off
                            </Button>
                          </div>
                        </div>
                      </div>
                        {index < NOTIFICATION_TYPES.length - 1 && (
                          <Separator className="mt-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button 
                onClick={handleSavePreferences}
                disabled={saving}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Preferences'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </NavPageLayout>
  );
}
