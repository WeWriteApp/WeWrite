"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import NavPageLayout from '../../components/layout/NavPageLayout';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../components/ui/collapsible';
import {
  Bell,
  Smartphone,
  Monitor,
  Mail,
  Loader2,
  ChevronDown,
  UserPlus,
  Link2,
  AtSign,
  FilePlus,
  DollarSign,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Settings,
  Megaphone
} from 'lucide-react';

// Notification types that users can configure
// Grouped by category for better organization
const NOTIFICATION_TYPES = [
  // Social notifications
  {
    id: 'follow',
    title: 'New Followers',
    description: 'When someone follows you',
    icon: UserPlus,
    category: 'social'
  },
  {
    id: 'pageLinks',
    title: 'Page Links',
    description: 'When someone links to your page',
    icon: Link2,
    category: 'social'
  },
  {
    id: 'userMentions',
    title: 'User Mentions',
    description: 'When someone mentions you by linking to your user page',
    icon: AtSign,
    category: 'social'
  },
  {
    id: 'append',
    title: 'Page Additions',
    description: 'When someone adds your page to their page',
    icon: FilePlus,
    category: 'social'
  },
  // Payout notifications
  {
    id: 'payout_completed',
    title: 'Payouts Completed',
    description: 'When your payout is successfully processed',
    icon: DollarSign,
    category: 'payments'
  },
  {
    id: 'payout_failed',
    title: 'Payout Issues',
    description: 'When there are issues with your payouts',
    icon: AlertTriangle,
    category: 'payments'
  },
  {
    id: 'payout_setup_reminder',
    title: 'Payout Setup Reminder',
    description: 'Reminders to connect your payout method when funds are available',
    icon: Clock,
    category: 'payments'
  },
  // System notifications
  {
    id: 'email_verification',
    title: 'Account Verification',
    description: 'Important account security notifications',
    icon: ShieldCheck,
    category: 'system'
  },
  {
    id: 'system_updates',
    title: 'System Updates',
    description: 'Platform updates and maintenance notifications',
    icon: Settings,
    category: 'system'
  },
  {
    id: 'product_updates',
    title: 'Product Updates',
    description: 'New features and improvements to WeWrite',
    icon: Megaphone,
    category: 'system'
  }
];

interface NotificationPreferences {
  [key: string]: {
    push: boolean;
    inApp: boolean;
    email: boolean;
  };
}

// Component for the channel status icons in collapsed state
function ChannelStatusIcons({
  push,
  inApp,
  email
}: {
  push: boolean;
  inApp: boolean;
  email: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Smartphone
        className={`h-4 w-4 transition-colors ${
          push ? 'text-purple-500' : 'text-muted-foreground/30'
        }`}
        aria-label={push ? 'Push enabled' : 'Push disabled'}
      />
      <Monitor
        className={`h-4 w-4 transition-colors ${
          inApp ? 'text-orange-500' : 'text-muted-foreground/30'
        }`}
        aria-label={inApp ? 'In-app enabled' : 'In-app disabled'}
      />
      <Mail
        className={`h-4 w-4 transition-colors ${
          email ? 'text-blue-500' : 'text-muted-foreground/30'
        }`}
        aria-label={email ? 'Email enabled' : 'Email disabled'}
      />
    </div>
  );
}

// Individual notification type card
function NotificationTypeCard({
  type,
  preferences,
  onPreferenceChange,
  openId,
  setOpenId
}: {
  type: typeof NOTIFICATION_TYPES[0];
  preferences: { push: boolean; inApp: boolean; email: boolean };
  onPreferenceChange: (channel: 'push' | 'inApp' | 'email', enabled: boolean) => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const isOpen = openId === type.id;
  const Icon = type.icon;
  const allEnabled = preferences.push && preferences.inApp && preferences.email;
  const allDisabled = !preferences.push && !preferences.inApp && !preferences.email;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) => setOpenId(open ? type.id : null)}
    >
      <div className={`wewrite-card transition-all duration-200 ${isOpen ? 'ring-1 ring-primary/20' : ''}`}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-lg transition-colors ${
                  allDisabled
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-primary/10 text-primary'
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium truncate ${allDisabled ? 'text-muted-foreground' : ''}`}>
                    {type.title}
                  </h4>
                  <p className="text-sm text-muted-foreground truncate">
                    {type.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <ChannelStatusIcons
                  push={preferences.push}
                  inApp={preferences.inApp}
                  email={preferences.email}
                />
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="pt-4 mt-4 border-t border-border space-y-4">
            {/* Push Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">Get notified on your device</p>
                </div>
              </div>
              <Switch
                checked={preferences.push}
                onCheckedChange={(checked) => onPreferenceChange('push', checked)}
                aria-label={`${type.title} push notifications`}
              />
            </div>

            {/* In-App Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-sm font-medium">In-App Alerts</p>
                  <p className="text-xs text-muted-foreground">See in your notification center</p>
                </div>
              </div>
              <Switch
                checked={preferences.inApp}
                onCheckedChange={(checked) => onPreferenceChange('inApp', checked)}
                aria-label={`${type.title} in-app alerts`}
              />
            </div>

            {/* Email Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-xs text-muted-foreground">Receive email notifications</p>
                </div>
              </div>
              <Switch
                checked={preferences.email}
                onCheckedChange={(checked) => onPreferenceChange('email', checked)}
                aria-label={`${type.title} email notifications`}
              />
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreferenceChange('push', true);
                  onPreferenceChange('inApp', true);
                  onPreferenceChange('email', true);
                }}
                disabled={allEnabled}
              >
                Enable all
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreferenceChange('push', false);
                  onPreferenceChange('inApp', false);
                  onPreferenceChange('email', false);
                }}
                disabled={allDisabled}
              >
                Disable all
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function NotificationSettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Initialize default preferences
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Set default preferences (all enabled for all channels)
    const defaultPreferences: NotificationPreferences = {};
    NOTIFICATION_TYPES.forEach(type => {
      defaultPreferences[type.id] = {
        push: true,
        inApp: true,
        email: true
      };
    });

    setPreferences(defaultPreferences);
    setLoading(false);

    // TODO: Load actual preferences from API
    // loadNotificationPreferences();
  }, [user, isAuthenticated]);

  const handlePreferenceChange = (typeId: string, channel: 'push' | 'inApp' | 'email', enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        [channel]: enabled
      }
    }));
  };

  const handleToggleAll = (enabled: boolean) => {
    setPreferences((prev) => {
      const updated: NotificationPreferences = { ...prev };
      NOTIFICATION_TYPES.forEach((type) => {
        updated[type.id] = {
          push: enabled,
          inApp: enabled,
          email: enabled
        };
      });
      return updated;
    });
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

  // Group notifications by category
  const socialNotifications = NOTIFICATION_TYPES.filter(t => t.category === 'social');
  const paymentNotifications = NOTIFICATION_TYPES.filter(t => t.category === 'payments');
  const systemNotifications = NOTIFICATION_TYPES.filter(t => t.category === 'system');

  const allEnabled = NOTIFICATION_TYPES.every(
    type => preferences[type.id]?.push && preferences[type.id]?.inApp && preferences[type.id]?.email
  );
  const allDisabled = NOTIFICATION_TYPES.every(
    type => !preferences[type.id]?.push && !preferences[type.id]?.inApp && !preferences[type.id]?.email
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <NavPageLayout>
      <div className="max-w-2xl mx-auto pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Notification Settings</h1>
          <p className="text-muted-foreground">
            Choose how you want to be notified about activity on WeWrite
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Channel Legend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notification Channels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-purple-500" />
                    <span>Push</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-orange-500" />
                    <span>In-App</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-500" />
                    <span>Email</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Tap each notification type below to customize delivery channels
                </p>
              </CardContent>
            </Card>

            {/* Master Toggle */}
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-muted-foreground">Quick actions</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleAll(true)}
                  disabled={allEnabled}
                >
                  Enable all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleAll(false)}
                  disabled={allDisabled}
                >
                  Disable all
                </Button>
              </div>
            </div>

            {/* Social Notifications */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground px-1">Social</h3>
              <div className="space-y-3">
                {socialNotifications.map((type) => (
                  <NotificationTypeCard
                    key={type.id}
                    type={type}
                    preferences={preferences[type.id] || { push: true, inApp: true, email: true }}
                    onPreferenceChange={(channel, enabled) =>
                      handlePreferenceChange(type.id, channel, enabled)
                    }
                    openId={openId}
                    setOpenId={setOpenId}
                  />
                ))}
              </div>
            </div>

            {/* Payment Notifications */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground px-1">Payments</h3>
              <div className="space-y-3">
                {paymentNotifications.map((type) => (
                  <NotificationTypeCard
                    key={type.id}
                    type={type}
                    preferences={preferences[type.id] || { push: true, inApp: true, email: true }}
                    onPreferenceChange={(channel, enabled) =>
                      handlePreferenceChange(type.id, channel, enabled)
                    }
                    openId={openId}
                    setOpenId={setOpenId}
                  />
                ))}
              </div>
            </div>

            {/* System Notifications */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground px-1">System</h3>
              <div className="space-y-3">
                {systemNotifications.map((type) => (
                  <NotificationTypeCard
                    key={type.id}
                    type={type}
                    preferences={preferences[type.id] || { push: true, inApp: true, email: true }}
                    onPreferenceChange={(channel, enabled) =>
                      handlePreferenceChange(type.id, channel, enabled)
                    }
                    openId={openId}
                    setOpenId={setOpenId}
                  />
                ))}
              </div>
            </div>

            {/* Save Button - Fixed at bottom on mobile */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border md:relative md:border-0 md:p-0 md:bg-transparent">
              <Button
                onClick={handleSavePreferences}
                disabled={saving}
                className="w-full md:w-auto flex items-center justify-center gap-2"
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
