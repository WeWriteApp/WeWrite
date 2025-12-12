"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import {
  Mail,
  Loader,
  Bell,
  DollarSign,
  Sparkles,
  Shield,
  Save,
  Check,
  AlertCircle,
  User
} from 'lucide-react';
import { useToast } from '../../components/ui/use-toast';

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

interface UserData {
  userId: string;
  email: string;
  username?: string;
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

export default function TokenEmailPreferencesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const emailType = searchParams.get('type');
  const { toast } = useToast();

  const [preferences, setPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justUnsubscribed, setJustUnsubscribed] = useState<string | null>(null);

  // Load preferences using token
  useEffect(() => {
    const loadPreferences = async () => {
      if (!token) {
        setError('Missing token');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/email/preferences?token=${token}`);
        const data = await response.json();

        if (data.success && data.preferences) {
          setPreferences({ ...defaultPreferences, ...data.preferences });
          setUserData(data.userData);

          // If there's an email type in the URL, show which type they came from
          if (emailType) {
            setJustUnsubscribed(emailType);
          }
        } else {
          setError(data.error || 'Invalid or expired link');
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
        setError('Failed to load preferences');
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [token, emailType]);

  const handleToggle = (key: keyof EmailPreferences) => {
    // Security alerts cannot be disabled
    if (key === 'securityAlerts') return;

    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    setHasChanges(true);
    setJustUnsubscribed(null);
  };

  const savePreferences = async () => {
    setSaving(true);

    try {
      const response = await fetch('/api/email/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, preferences }),
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
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to save preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const unsubscribeFromAll = () => {
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
    setJustUnsubscribed(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your preferences...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Unable to Load Preferences</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">
            This link may have expired or is invalid. If you need to manage your email preferences,
            please log in to your account and visit Settings → Email Preferences.
          </p>
        </div>
      </div>
    );
  }

  const PreferenceToggle = ({
    id,
    label,
    description,
    checked,
    disabled = false,
    highlighted = false
  }: {
    id: keyof EmailPreferences;
    label: string;
    description: string;
    checked: boolean;
    disabled?: boolean;
    highlighted?: boolean;
  }) => (
    <div className={`flex items-start justify-between py-4 border-b border-border last:border-0 ${highlighted ? 'bg-primary/5 -mx-4 px-4 rounded-lg' : ''}`}>
      <div className="space-y-0.5 pr-4">
        <Label htmlFor={id} className="text-base font-medium cursor-pointer">
          {label}
          {highlighted && (
            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              from email
            </span>
          )}
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

  // Map email types to preference keys for highlighting
  const emailTypeToKey: Record<string, keyof EmailPreferences> = {
    'weekly-digest': 'weeklyDigest',
    'new-follower': 'newFollower',
    'page-linked': 'pageLinks',
    'payout-reminder': 'payoutReminders',
    'payout-processed': 'paymentReceipts',
    'product-update': 'productUpdates',
    'earnings-summary': 'earningsSummary',
    'tips': 'tipsAndTricks',
    'comments': 'pageComments',
    'mentions': 'userMentions',
  };

  const highlightedKey = justUnsubscribed ? emailTypeToKey[justUnsubscribed] : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Email Preferences</h1>
          </div>
          <p className="text-muted-foreground">
            Choose which emails you'd like to receive
          </p>

          {/* Account indicator */}
          {userData && (
            <div className="mt-4 flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Managing preferences for:</span>
              <span className="font-medium">
                {userData.username ? `@${userData.username}` : userData.email}
              </span>
            </div>
          )}
        </div>

        {/* Save button - sticky at top when there are changes */}
        {hasChanges && (
          <div className="sticky top-4 z-10 mb-6 bg-card border rounded-lg p-4 shadow-lg flex items-center justify-between">
            <span className="text-sm text-muted-foreground">You have unsaved changes</span>
            <Button
              onClick={savePreferences}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        )}

        <div className="space-y-8">
          {/* Security & Authentication */}
          <section className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-blue-500" />
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
            </div>
          </section>

          {/* Notifications */}
          <section className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-orange-500" />
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
                highlighted={highlightedKey === 'newFollower'}
              />
              <PreferenceToggle
                id="pageComments"
                label="Comments on Your Pages"
                description="Get notified when someone comments on your pages"
                checked={preferences.pageComments}
                highlighted={highlightedKey === 'pageComments'}
              />
              <PreferenceToggle
                id="pageLinks"
                label="Page Links"
                description="Get notified when someone links to your page"
                checked={preferences.pageLinks}
                highlighted={highlightedKey === 'pageLinks'}
              />
              <PreferenceToggle
                id="userMentions"
                label="User Mentions"
                description="Get notified when someone mentions you by linking to your user page"
                checked={preferences.userMentions}
                highlighted={highlightedKey === 'userMentions'}
              />
            </div>
          </section>

          {/* Payments */}
          <section className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-green-500" />
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
                highlighted={highlightedKey === 'payoutReminders'}
              />
              <PreferenceToggle
                id="paymentReceipts"
                label="Payment Receipts"
                description="Receipts when you receive payments from subscribers"
                checked={preferences.paymentReceipts}
                highlighted={highlightedKey === 'paymentReceipts'}
              />
              <PreferenceToggle
                id="earningsSummary"
                label="Earnings Summary"
                description="Monthly summary of your earnings and supporter activity"
                checked={preferences.earningsSummary}
                highlighted={highlightedKey === 'earningsSummary'}
              />
            </div>
          </section>

          {/* Engagement & Marketing */}
          <section className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-purple-500" />
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
                highlighted={highlightedKey === 'weeklyDigest'}
              />
              <PreferenceToggle
                id="productUpdates"
                label="Product Updates"
                description="New features, improvements, and platform news"
                checked={preferences.productUpdates}
                highlighted={highlightedKey === 'productUpdates'}
              />
              <PreferenceToggle
                id="tipsAndTricks"
                label="Tips & Writing Prompts"
                description="Occasional writing tips and creative prompts"
                checked={preferences.tipsAndTricks}
                highlighted={highlightedKey === 'tipsAndTricks'}
              />
            </div>
          </section>

          {/* Unsubscribe All */}
          <section className="bg-muted/50 rounded-lg border border-dashed p-6">
            <p className="text-sm text-muted-foreground text-center">
              Need to unsubscribe from everything? You can{' '}
              <button
                onClick={unsubscribeFromAll}
                className="text-primary hover:underline"
              >
                unsubscribe from all non-essential emails
              </button>
              . Security alerts will always remain enabled.
            </p>
          </section>

          {/* Save button at bottom */}
          {hasChanges && (
            <div className="flex justify-center pb-8">
              <Button
                onClick={savePreferences}
                disabled={saving}
                size="lg"
                className="gap-2"
              >
                {saving ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save All Changes
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
