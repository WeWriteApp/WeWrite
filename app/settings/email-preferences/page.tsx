"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { FloatingHeader } from '../../components/ui/FloatingCard';
import { useToast } from '../../components/ui/use-toast';

interface EmailPreferences {
  // Authentication & Security
  securityAlerts: boolean;
  loginNotifications: boolean;

  // Notifications
  newFollower: boolean;
  pageComments: boolean;
  pageLinks: boolean;
  userMentions: boolean;

  // Payments
  payoutReminders: boolean;
  paymentReceipts: boolean;
  earningsSummary: boolean;

  // Engagement & Marketing
  weeklyDigest: boolean;
  productUpdates: boolean;
  tipsAndTricks: boolean;
}

const defaultPreferences: EmailPreferences = {
  securityAlerts: true,
  loginNotifications: true,
  newFollower: true,
  pageComments: true,
  pageLinks: true,
  userMentions: true,
  payoutReminders: true,
  paymentReceipts: true,
  earningsSummary: true,
  weeklyDigest: true,
  productUpdates: true,
  tipsAndTricks: false,
};

export default function EmailPreferencesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [preferences, setPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Check auth
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/settings/email-preferences');
    }
  }, [user, authLoading, router]);

  // Load preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;
      
      try {
        const response = await fetch('/api/user/email-preferences');
        const data = await response.json();
        
        if (data.success && data.preferences) {
          setPreferences({ ...defaultPreferences, ...data.preferences });
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user && !authLoading) {
      loadPreferences();
    }
  }, [user, authLoading]);

  const handleToggle = (key: keyof EmailPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    setHasChanges(true);
  };

  const savePreferences = async () => {
    setSaving(true);
    
    try {
      const response = await fetch('/api/user/email-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Saved!',
          description: 'Your email preferences have been updated',
        });
        setHasChanges(false);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Icon name="Loader" className="text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-muted-foreground">Please sign in</p>
      </div>
    );
  }

  const PreferenceToggle = ({ 
    id, 
    label, 
    description, 
    checked,
    disabled = false 
  }: { 
    id: keyof EmailPreferences; 
    label: string; 
    description: string; 
    checked: boolean;
    disabled?: boolean;
  }) => (
    <div className="flex items-start justify-between py-4 border-b border-border last:border-0">
      <div className="space-y-0.5 pr-4">
        <Label htmlFor={id} className="text-base font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={() => handleToggle(id)}
        disabled={disabled}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-2xl lg:max-w-3xl">
        <FloatingHeader className="fixed-header-sidebar-aware px-4 py-3 mb-6 flex items-center justify-between lg:relative lg:top-0 lg:left-0 lg:right-0 lg:z-auto lg:mb-6 lg:px-0 lg:py-2">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/settings')}
              className="h-10 w-10"
            >
              <Icon name="ArrowLeft" size={20} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold leading-tight flex items-center gap-2">
                <Icon name="Mail" size={24} />
                Email Preferences
              </h1>
              <p className="text-muted-foreground text-sm">
                Choose which emails you'd like to receive
              </p>
            </div>
          </div>
          {hasChanges && (
            <Button
              onClick={savePreferences}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <Icon name="Loader" />
              ) : (
                <Icon name="Save" size={16} />
              )}
              Save
            </Button>
          )}
        </FloatingHeader>

        <div className="pt-24 lg:pt-0 space-y-8">
          {/* Security & Authentication */}
          <section className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Shield" size={20} className="text-blue-500" />
              <h2 className="text-lg font-semibold">Security & Authentication</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Important notifications about your account security
            </p>
            <div className="divide-y divide-border">
              <PreferenceToggle
                id="securityAlerts"
                label="Security Alerts"
                description="Critical security notifications (password changes, suspicious activity)"
                checked={preferences.securityAlerts}
                disabled // Always required
              />
              {/* Login notifications disabled - feature not working properly
              <PreferenceToggle
                id="loginNotifications"
                label="Login Notifications"
                description="Get notified when your account is accessed from a new device"
                checked={preferences.loginNotifications}
              />
              */}
            </div>
          </section>

          {/* Notifications */}
          <section className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Bell" size={20} className="text-orange-500" />
              <h2 className="text-lg font-semibold">Notifications</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Activity updates from the community
            </p>
            <div className="divide-y divide-border">
              <PreferenceToggle
                id="newFollower"
                label="New Followers"
                description="Get notified when someone follows you"
                checked={preferences.newFollower}
              />
              <PreferenceToggle
                id="pageComments"
                label="Comments on Your Pages"
                description="Get notified when someone comments on your pages"
                checked={preferences.pageComments}
              />
              <PreferenceToggle
                id="pageLinks"
                label="Page Links"
                description="Get notified when someone links to your page"
                checked={preferences.pageLinks}
              />
              <PreferenceToggle
                id="userMentions"
                label="User Mentions"
                description="Get notified when someone mentions you by linking to your user page"
                checked={preferences.userMentions}
              />
            </div>
          </section>

          {/* Payments */}
          <section className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="DollarSign" size={20} className="text-green-500" />
              <h2 className="text-lg font-semibold">Payments & Earnings</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Updates about your earnings and payouts
            </p>
            <div className="divide-y divide-border">
              <PreferenceToggle
                id="payoutReminders"
                label="Payout Reminders"
                description="Reminders to set up or complete your payout method"
                checked={preferences.payoutReminders}
              />
              <PreferenceToggle
                id="paymentReceipts"
                label="Payment Receipts"
                description="Receipts when you receive payments from subscribers"
                checked={preferences.paymentReceipts}
              />
              <PreferenceToggle
                id="earningsSummary"
                label="Earnings Summary"
                description="Monthly summary of your earnings and supporter activity"
                checked={preferences.earningsSummary}
              />
            </div>
          </section>

          {/* Engagement & Marketing */}
          <section className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Sparkles" size={20} className="text-purple-500" />
              <h2 className="text-lg font-semibold">Engagement & Updates</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Product updates and writing inspiration
            </p>
            <div className="divide-y divide-border">
              <PreferenceToggle
                id="weeklyDigest"
                label="Weekly Digest"
                description="A weekly summary of activity from writers you follow"
                checked={preferences.weeklyDigest}
              />
              <PreferenceToggle
                id="productUpdates"
                label="Product Updates"
                description="New features, improvements, and platform news"
                checked={preferences.productUpdates}
              />
              <PreferenceToggle
                id="tipsAndTricks"
                label="Tips & Writing Prompts"
                description="Occasional writing tips and creative prompts"
                checked={preferences.tipsAndTricks}
              />
            </div>
          </section>

          {/* Unsubscribe All */}
          <section className="bg-muted/50 rounded-lg empty-state-border p-6">
            <p className="text-sm text-muted-foreground text-center">
              Need to unsubscribe from everything? You can{' '}
              <button
                onClick={() => {
                  setPreferences({
                    ...preferences,
                    loginNotifications: false,
                    newFollower: false,
                    pageComments: false,
                    pageLinks: false,
                    userMentions: false,
                    payoutReminders: false,
                    paymentReceipts: false,
                    earningsSummary: false,
                    weeklyDigest: false,
                    productUpdates: false,
                    tipsAndTricks: false,
                  });
                  setHasChanges(true);
                }}
                className="text-primary hover:underline"
              >
                unsubscribe from all non-essential emails
              </button>
              . Security alerts will always remain enabled.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
