'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../../providers/AuthProvider';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { useToast } from '../../ui/use-toast';
import { Shield, Bell, DollarSign, Sparkles } from 'lucide-react';

interface EmailPreferences {
  securityAlerts: boolean;
  loginNotifications: boolean;
  newFollower: boolean;
  pageComments: boolean;
  pageLinks: boolean;
  userMentions: boolean;
  payoutReminders: boolean;
  paymentReceipts: boolean;
  earningsSummary: boolean;
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

interface EmailPreferencesContentProps {
  onClose: () => void;
}

export default function EmailPreferencesContent({ onClose }: EmailPreferencesContentProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [preferences, setPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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
      <div className="flex items-center justify-center py-12">
        <Icon name="Loader" size={24} className="text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
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
    <div className="flex items-start justify-between py-3 border-b border-border last:border-0">
      <div className="space-y-0.5 pr-4">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">
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
    <div className="px-4 pb-6 space-y-6">
      {/* Security & Authentication */}
      <section className="bg-card rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-blue-500" />
          <h2 className="text-base font-semibold">Security & Authentication</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Important notifications about your account security
        </p>
        <div className="divide-y divide-border">
          <PreferenceToggle
            id="securityAlerts"
            label="Security Alerts"
            description="Critical security notifications (password changes, suspicious activity)"
            checked={preferences.securityAlerts}
            disabled
          />
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-card rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="h-5 w-5 text-orange-500" />
          <h2 className="text-base font-semibold">Notifications</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
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
      <section className="bg-card rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-5 w-5 text-green-500" />
          <h2 className="text-base font-semibold">Payments & Earnings</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
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
      <section className="bg-card rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h2 className="text-base font-semibold">Engagement & Updates</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
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
      <section className="bg-muted/50 rounded-lg border border-dashed p-4">
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

      {/* Save Button */}
      {hasChanges && (
        <div className="pt-4">
          <Button
            onClick={savePreferences}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Icon name="Loader" size={16} />
                Saving...
              </>
            ) : (
              <>
                <Icon name="Save" size={16} />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
