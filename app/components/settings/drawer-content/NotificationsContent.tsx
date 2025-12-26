'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../../providers/AuthProvider';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';
import {
  UserPlus,
  Link2,
  AtSign,
  FilePlus,
  DollarSign,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Settings,
  Megaphone,
  Smartphone,
  Monitor,
  Mail
} from 'lucide-react';

const NOTIFICATION_TYPES = [
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
      />
      <Monitor
        className={`h-4 w-4 transition-colors ${
          inApp ? 'text-orange-500' : 'text-muted-foreground/30'
        }`}
      />
      <Mail
        className={`h-4 w-4 transition-colors ${
          email ? 'text-blue-500' : 'text-muted-foreground/30'
        }`}
      />
    </div>
  );
}

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
  const IconComponent = type.icon;
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
                  <IconComponent className="h-4 w-4" />
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
                <Icon name="ChevronDown" size={16} className={`text-muted-foreground transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`} />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="pt-4 mt-4 border-t border-border space-y-4">
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
              />
            </div>

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
              />
            </div>

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
              />
            </div>

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

interface NotificationsContentProps {
  onClose: () => void;
}

export default function NotificationsContent({ onClose }: NotificationsContentProps) {
  const { user, isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

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
      console.log('Saving notification preferences:', preferences);
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Notification preferences saved successfully');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
    } finally {
      setSaving(false);
    }
  };

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
    <div className="px-4 pb-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="Loader" size={24} className="text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Channel Legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon name="Bell" size={16} />
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

          {/* Save Button */}
          <div className="pt-4">
            <Button
              onClick={handleSavePreferences}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Icon name="Loader" size={16} className="animate-spin" />
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
  );
}
