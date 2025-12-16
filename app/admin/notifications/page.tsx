"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  ArrowLeft,
  Mail,
  Search,
  Loader,
  Shield,
  DollarSign,
  Bell,
  Settings,
  Sparkles,
  ExternalLink,
  Code,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  History,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Calendar,
  X,
  Users,
  User
} from 'lucide-react';
import { isAdmin } from '../../utils/isAdmin';
import { useToast } from '../../components/ui/use-toast';

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: 'authentication' | 'notifications' | 'payments' | 'engagement' | 'system';
  subject: string;
}

interface EmailLogEntry {
  id: string;
  templateId: string;
  templateName: string;
  recipientEmail: string;
  recipientUserId?: string;
  recipientUsername?: string;
  subject: string;
  status: 'sent' | 'failed' | 'bounced' | 'delivered';
  resendId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  sentAt: string;
  createdAt: string;
}

interface GroupedTemplates {
  authentication: EmailTemplate[];
  payments: EmailTemplate[];
  engagement: EmailTemplate[];
  system: EmailTemplate[];
  notifications: EmailTemplate[];
}

// Notification modes for each template - which delivery methods are supported
const notificationModes: Record<string, { email: boolean; inApp: boolean; push: boolean }> = {
  'verification': { email: true, inApp: true, push: true },
  'verification-reminder': { email: true, inApp: false, push: false },
  'welcome': { email: true, inApp: true, push: true },
  'password-reset': { email: true, inApp: true, push: true },
  'generic-notification': { email: true, inApp: true, push: true },
  'payout-setup-reminder': { email: true, inApp: true, push: true },
  'payout-processed': { email: true, inApp: true, push: true },
  'subscription-confirmation': { email: true, inApp: true, push: true },
  'weekly-digest': { email: true, inApp: true, push: true },
  'new-follower': { email: true, inApp: true, push: true },
  'page-linked': { email: true, inApp: true, push: true },
  'account-security': { email: true, inApp: true, push: true },
  'choose-username': { email: true, inApp: true, push: true },
  'reactivation': { email: true, inApp: true, push: true },
  'broadcast': { email: true, inApp: true, push: true },
  'product-update': { email: true, inApp: true, push: true },
};

// Trigger status for each template - which ones are actually wired up
const triggerStatus: Record<string, { status: 'active' | 'partial' | 'not-implemented' | 'disabled'; description: string }> = {
  'verification': {
    status: 'active',
    description: 'Handled by Firebase Auth. Custom template available via API.'
  },
  'verification-reminder': {
    status: 'active',
    description: 'Fully implemented. Daily cron job at 4pm UTC for users who signed up 3-7 days ago and haven\'t verified.'
  },
  'welcome': { 
    status: 'active', 
    description: 'Fully implemented. Sent via /api/email/send endpoint.'
  },
  'password-reset': { 
    status: 'active', 
    description: 'Fully implemented via /api/auth/reset-password with Firebase.'
  },
  'generic-notification': { 
    status: 'active', 
    description: 'Fully implemented. Sent via /api/email/send endpoint.'
  },
  'payout-setup-reminder': { 
    status: 'active', 
    description: 'Fully implemented. Daily cron job at 3pm UTC for users with pending earnings.'
  },
  'payout-processed': { 
    status: 'active', 
    description: 'Fully implemented. Auto-triggered after successful payout in payoutServiceUnified.ts.'
  },
  'subscription-confirmation': { 
    status: 'active', 
    description: 'Fully implemented. Triggered by Stripe webhook on successful subscription.'
  },
  'weekly-digest': { 
    status: 'active', 
    description: 'Fully implemented. Weekly cron job on Mondays at 10am UTC.'
  },
  'new-follower': { 
    status: 'active', 
    description: 'Fully implemented. Triggered in /api/follows/users when someone follows.'
  },
  'page-linked': { 
    status: 'active', 
    description: 'Fully implemented. Triggered when pages link to other pages.'
  },
  'account-security': { 
    status: 'disabled', 
    description: 'Disabled - was spammy and not working properly. Can be re-enabled later.'
  },
  'choose-username': {
    status: 'active',
    description: 'Fully implemented. Daily cron job at 2pm UTC for users without usernames.'
  },
  'reactivation': {
    status: 'not-implemented',
    description: 'Template ready. Needs cron job to detect inactive users and send emails.'
  },
  'broadcast': {
    status: 'active',
    description: 'Fully implemented. Admin can send to all users via /admin/broadcast.'
  },
  'product-update': {
    status: 'active',
    description: 'Fully implemented. Product updates and announcements for all users.'
  },
};

const categoryConfig = {
  authentication: {
    label: 'Authentication',
    icon: Shield,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  payments: {
    label: 'Payments',
    icon: DollarSign,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  engagement: {
    label: 'Engagement',
    icon: Sparkles,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  system: {
    label: 'System',
    icon: Settings,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
  notifications: {
    label: 'Notifications',
    icon: Bell,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Mock push notification preview
// NOTE: In production, push notifications should include:
// - icon: '/icons/icon-192x192.png' (WeWrite logo, 192x192px PNG)
// - badge: '/icons/icon-192x192.png' (small monochrome badge icon)
// These are already available in /public/icons/
function PushNotificationPreview({ templateId }: { templateId: string }) {
  const getPushData = () => {
    switch (templateId) {
      case 'verification':
        return {
          title: 'Verify Your Email',
          body: 'Click to verify your email address and complete setup',
          icon: '✉️'
        };
      case 'welcome':
        return {
          title: 'Welcome to WeWrite!',
          body: 'Start creating and sharing your pages',
          icon: '👋'
        };
      case 'password-reset':
        return {
          title: 'Password Reset',
          body: 'Click to reset your WeWrite password',
          icon: '🔐'
        };
      case 'generic-notification':
        return {
          title: 'WeWrite',
          body: 'You have a new notification',
          icon: '🔔'
        };
      case 'payout-setup-reminder':
        return {
          title: 'Set up payouts',
          body: 'You have $25.00 in earnings ready to claim',
          icon: '💵'
        };
      case 'payout-processed':
        return {
          title: 'Payout Completed',
          body: 'Your payout of $50.00 has been processed',
          icon: '💰'
        };
      case 'subscription-confirmation':
        return {
          title: 'Subscription Confirmed',
          body: 'Your WeWrite subscription is now active',
          icon: '🎉'
        };
      case 'weekly-digest':
        return {
          title: 'Your Weekly Digest',
          body: 'Check out the highlights from your week',
          icon: '📰'
        };
      case 'new-follower':
        return {
          title: 'New Follower',
          body: '@johndoe started following you',
          icon: '🔔'
        };
      case 'page-linked':
        return {
          title: 'Page Linked',
          body: '@janedoe linked to your page',
          icon: '🔗'
        };
      case 'account-security':
        return {
          title: 'Security Alert',
          body: 'New login detected on your account',
          icon: '🔒'
        };
      case 'choose-username':
        return {
          title: 'Choose Your Username',
          body: 'Pick a unique username for your WeWrite account',
          icon: '👤'
        };
      case 'broadcast':
        return {
          title: 'Important Announcement',
          body: 'We have an important update to share',
          icon: '📣'
        };
      case 'product-update':
        return {
          title: 'Product Update',
          body: 'Check out the latest features and improvements',
          icon: '✨'
        };
      case 'reactivation':
        return {
          title: 'We miss you!',
          body: 'Come back and start earning on WeWrite',
          icon: '👋'
        };
      default:
        return {
          title: 'WeWrite',
          body: 'This template does not support push notifications',
          icon: '📧'
        };
    }
  };

  const push = getPushData();
  const modes = notificationModes[templateId] || { email: false, inApp: false, push: false };

  if (!modes.push) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Smartphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">This notification does not support push delivery</p>
      </div>
    );
  }

  return (
    <div className="max-w-[360px] mx-auto">
      {/* iOS-style push notification with WeWrite app icon */}
      <div className="relative bg-card rounded-2xl shadow-2xl p-4 border border-border">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden">
            {/* WeWrite app icon - in production this is /icons/icon-192x192.png */}
            <img
              src="/icons/icon-192x192.png"
              alt="WeWrite"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {push.title}
              </p>
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                now
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
              {push.body}
            </p>
          </div>
        </div>
      </div>

      {/* Implementation note */}
      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>PWA Implementation:</strong> Use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">icon: '/icons/icon-192x192.png'</code> in your push notification payload
        </p>
      </div>
    </div>
  );
}

// Mock notification previews for each email template
function NotificationPreview({ templateId }: { templateId: string }) {
  const [showAsRead, setShowAsRead] = useState(false);

  // Mock notification data based on template
  const getNotificationData = () => {
    switch (templateId) {
      case 'verification':
        return {
          type: 'email_verification',
          title: 'Verify Your Email',
          message: 'Please verify your email address to access all WeWrite features.'
        };

      case 'welcome':
        return {
          type: 'welcome',
          title: 'Welcome to WeWrite!',
          message: 'Start creating and sharing your pages with the world.'
        };

      case 'password-reset':
        return {
          type: 'password_reset',
          title: 'Password Reset Request',
          message: 'You requested a password reset. Click to create a new password.'
        };

      case 'generic-notification':
        return {
          type: 'generic',
          title: 'Notification',
          message: 'You have a new notification from WeWrite.'
        };

      case 'payout-setup-reminder':
        return {
          type: 'payout_setup_reminder',
          title: 'Set up payouts',
          message: 'You have $25.00 in earnings ready to claim. Connect your bank account to receive payouts.',
          metadata: { amount: 25.00 }
        };

      case 'payout-processed':
        return {
          type: 'payout_completed',
          title: 'Payout Completed',
          message: 'Your payout of $50.00 has been successfully processed and sent to your bank account.',
          metadata: { amount: 50.00 }
        };

      case 'subscription-confirmation':
        return {
          type: 'subscription_confirmed',
          title: 'Subscription Confirmed',
          message: 'Your WeWrite subscription is now active. Thank you for supporting creators!'
        };

      case 'weekly-digest':
        return {
          type: 'weekly_digest',
          title: 'Your Weekly Digest',
          message: 'Here are the highlights from your week on WeWrite.'
        };

      case 'new-follower':
        return {
          type: 'follow',
          title: 'New Follower',
          message: '@johndoe started following you',
          sourceUserId: 'demo',
          sourceUsername: 'johndoe'
        };

      case 'page-linked':
        return {
          type: 'link',
          title: 'Page Linked',
          message: '@janedoe linked to your page "My Awesome Page" from their page "Links Collection"',
          sourceUserId: 'demo',
          sourceUsername: 'janedoe',
          targetPageTitle: 'My Awesome Page',
          sourcePageTitle: 'Links Collection'
        };

      case 'account-security':
        return {
          type: 'security_alert',
          title: 'Security Alert',
          message: 'New login detected on your account from a new device.'
        };

      case 'choose-username':
        return {
          type: 'username_reminder',
          title: 'Choose Your Username',
          message: 'Pick a unique username to personalize your WeWrite profile.'
        };

      case 'broadcast':
        return {
          type: 'announcement',
          title: 'Important Announcement',
          message: 'We have an important update to share with all WeWrite users.'
        };

      case 'product-update':
        return {
          type: 'product_update',
          title: 'New Features Available',
          message: 'We\'ve added exciting new features to WeWrite. Check out the latest improvements to your writing experience!'
        };

      case 'reactivation':
        return {
          type: 'reactivation',
          title: 'We miss you!',
          message: 'It\'s been a while since you\'ve been on WeWrite. Come back and start writing to earn real money from your content!'
        };

      default:
        return {
          type: 'system_announcement',
          title: 'System Notification',
          message: 'This email template does not have a corresponding in-app notification.'
        };
    }
  };

  const notification = getNotificationData();
  const modes = notificationModes[templateId] || { email: false, inApp: false, push: false };

  if (!modes.inApp) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">This notification does not support in-app delivery</p>
      </div>
    );
  }

  // Render a mock NotificationItem using the same component structure
  return (
    <div className="space-y-3">
      {/* Toggle for read/unread state */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAsRead(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              !showAsRead
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setShowAsRead(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              showAsRead
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Read
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {showAsRead ? 'Action buttons hidden' : 'Action buttons visible'}
        </span>
      </div>

      <div className={`relative rounded-xl border-theme-strong bg-card text-card-foreground shadow-sm p-4 ${!showAsRead ? 'ring-2 ring-primary/20' : ''}`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center flex-1">
            <div className="flex-shrink-0 mr-3 flex items-center h-full">
              {!showAsRead ? (
                <div className="w-2 h-2 bg-primary rounded-full" style={{ backgroundColor: '#1768FF' }}></div>
              ) : (
                <div className="w-2 h-2 bg-gray-300 rounded-full opacity-30"></div>
              )}
            </div>
            <div className="flex-1">
              {notification.type === 'allocation_threshold' ? (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1 text-foreground">
                  {notification.title}
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  {notification.message}
                </p>
                {notification.metadata && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span>Allocated: ${(notification.metadata.allocatedUsdCents / 100).toFixed(2)}</span>
                    <span>Total: ${(notification.metadata.totalUsdCents / 100).toFixed(2)}</span>
                    <span>Used: {notification.metadata.percentage}%</span>
                  </div>
                )}
                {!showAsRead && (
                  <div className="flex gap-2">
                    <button className="inline-flex items-center px-3 py-1.5 text-sm rounded-md transition-colors font-medium bg-primary text-primary-foreground hover:bg-primary/90">
                      Top off Account
                    </button>
                    <button className="inline-flex items-center px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors">
                      Manage Allocations
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1 text-foreground">
                  {notification.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {notification.message}
                </p>
              </div>
              )}
            </div>
          </div>
        </div>
        <div className="text-xs text-foreground opacity-70 whitespace-nowrap">
          2m ago
        </div>
      </div>
    </div>
  );
}

// Cron job schedule info for the Events tab
const cronSchedules = [
  {
    id: 'process-writer-earnings',
    name: 'Process Writer Earnings',
    path: '/api/usd/process-writer-earnings',
    schedule: '0 8 1 * *',
    description: 'Processes writer earnings on the 1st of each month at 8am UTC',
    nextRun: getNextCronRun('0 8 1 * *'),
  },
  {
    id: 'automated-payouts',
    name: 'Automated Payouts',
    path: '/api/cron/automated-payouts',
    schedule: '0 9 1 * *',
    description: 'Processes automated payouts on the 1st of each month at 9am UTC',
    nextRun: getNextCronRun('0 9 1 * *'),
  },
  {
    id: 'weekly-digest',
    name: 'Weekly Digest',
    path: '/api/cron/weekly-digest',
    schedule: '0 10 * * 1',
    description: 'Sends weekly digest emails every Monday at 10am UTC',
    nextRun: getNextCronRun('0 10 * * 1'),
  },
  {
    id: 'username-reminder',
    name: 'Username Reminder',
    path: '/api/cron/username-reminder',
    schedule: '0 14 * * *',
    description: 'Reminds users to set usernames daily at 2pm UTC',
    nextRun: getNextCronRun('0 14 * * *'),
  },
  {
    id: 'payout-setup-reminder',
    name: 'Payout Setup Reminder',
    path: '/api/cron/payout-setup-reminder',
    schedule: '0 15 * * *',
    description: 'Reminds users to set up payouts daily at 3pm UTC',
    nextRun: getNextCronRun('0 15 * * *'),
  },
  {
    id: 'email-verification-reminder',
    name: 'Email Verification Reminder',
    path: '/api/cron/email-verification-reminder',
    schedule: '0 16 * * *',
    description: 'Reminds unverified users to verify email daily at 4pm UTC',
    nextRun: getNextCronRun('0 16 * * *'),
  },
];

// Helper to calculate next cron run time (simplified version)
function getNextCronRun(schedule: string): Date {
  const now = new Date();
  const parts = schedule.split(' ');
  const minute = parseInt(parts[0]);
  const hour = parseInt(parts[1]);
  const dayOfMonth = parts[2];
  const dayOfWeek = parts[4];

  const next = new Date(now);
  next.setMinutes(minute);
  next.setSeconds(0);
  next.setMilliseconds(0);

  if (dayOfMonth !== '*') {
    // Monthly cron
    next.setDate(parseInt(dayOfMonth));
    next.setHours(hour);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
  } else if (dayOfWeek !== '*') {
    // Weekly cron
    const targetDay = parseInt(dayOfWeek);
    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0 && (now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute))) {
      daysUntil = 7;
    }
    next.setDate(now.getDate() + daysUntil);
    next.setHours(hour);
  } else {
    // Daily cron
    next.setHours(hour);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

function formatTimeUntil(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `in ${days}d ${hours % 24}h`;
  }
  return `in ${hours}h`;
}

function AdminEmailsPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Tab state from URL
  const tabParam = searchParams.get('tab');
  const activeTab = (tabParam === 'events' ? 'events' : 'templates') as 'templates' | 'events';

  // Function to change tab with URL update
  const setActiveTab = (tab: 'templates' | 'events') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`/admin/notifications?${params.toString()}`, { scroll: false });
  };

  // Templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [grouped, setGrouped] = useState<GroupedTemplates | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(true);

  // Events state
  const [allEmailLogs, setAllEmailLogs] = useState<EmailLogEntry[]>([]);
  const [allLogsLoading, setAllLogsLoading] = useState(false);

  // Expandable scheduled notifications state
  const [expandedCrons, setExpandedCrons] = useState<Set<string>>(new Set());
  const [cronRecipients, setCronRecipients] = useState<Record<string, { loading: boolean; recipients: any[] }>>({});
  const [recipientGrouping, setRecipientGrouping] = useState<'type' | 'user'>('type');

  // Check admin access
  useEffect(() => {
    if (!authLoading && user) {
      if (!isAdmin(user.email)) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/emails');
    }
  }, [user, authLoading, router]);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/admin/email-templates');
        const data = await response.json();
        
        if (data.success) {
          setTemplates(data.templates);
          setGrouped(data.grouped);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
        toast({
          title: 'Error',
          description: 'Failed to load email templates',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    if (user && !authLoading) {
      loadTemplates();
    }
  }, [user, authLoading, toast]);

  // Load events data when Events tab is active
  useEffect(() => {
    const loadEventsData = async () => {
      if (activeTab !== 'events' || !user || authLoading) return;

      setAllLogsLoading(true);
      try {
        const logsRes = await fetch('/api/admin/email-logs?limit=100');
        const logsData = await logsRes.json();

        if (logsData.success) {
          setAllEmailLogs(logsData.logs || []);
        }
      } catch (error) {
        console.error('Failed to load events data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load notification events',
          variant: 'destructive',
        });
      } finally {
        setAllLogsLoading(false);
      }
    };

    loadEventsData();
  }, [activeTab, user, authLoading, toast]);

  // Toggle expanded cron and fetch recipients
  const toggleCronExpand = async (cronId: string) => {
    const newExpanded = new Set(expandedCrons);
    if (newExpanded.has(cronId)) {
      newExpanded.delete(cronId);
    } else {
      newExpanded.add(cronId);
      // Fetch recipients if not already loaded
      if (!cronRecipients[cronId]) {
        setCronRecipients(prev => ({ ...prev, [cronId]: { loading: true, recipients: [] } }));
        try {
          const res = await fetch(`/api/admin/cron-recipients?cronId=${cronId}`);
          const data = await res.json();
          setCronRecipients(prev => ({
            ...prev,
            [cronId]: { loading: false, recipients: data.recipients || [] }
          }));
        } catch (error) {
          console.error('Failed to fetch recipients:', error);
          setCronRecipients(prev => ({
            ...prev,
            [cronId]: { loading: false, recipients: [] }
          }));
        }
      }
    }
    setExpandedCrons(newExpanded);
  };

  // Load template preview and logs
  const loadPreview = async (templateId: string) => {
    setSelectedTemplate(templateId);
    setPreviewLoading(true);
    setPreviewHtml(null);
    setShowCode(false);
    setEmailLogs([]);
    
    try {
      // Load preview and logs in parallel
      const [previewRes, logsRes] = await Promise.all([
        fetch(`/api/admin/email-templates?id=${templateId}&html=true`),
        fetch(`/api/admin/email-logs?templateId=${templateId}&limit=20`),
      ]);
      
      const previewData = await previewRes.json();
      const logsData = await logsRes.json();
      
      if (previewData.success) {
        setPreviewHtml(previewData.template.html);
      }
      
      if (logsData.success) {
        setEmailLogs(logsData.logs || []);
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email preview',
        variant: 'destructive',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const copyHtml = async () => {
    if (previewHtml) {
      await navigator.clipboard.writeText(previewHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'HTML copied to clipboard',
      });
    }
  };

  // Filter templates by search
  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);
  const selectedTriggerStatus = selectedTemplate ? triggerStatus[selectedTemplate] : null;

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin(user.email)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  // Helper to render recipients grouped by type or user
  const renderRecipients = (cronId: string) => {
    const data = cronRecipients[cronId];
    if (!data) return null;

    if (data.loading) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading recipients...</span>
        </div>
      );
    }

    if (data.recipients.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recipients found for this notification</p>
        </div>
      );
    }

    if (recipientGrouping === 'type') {
      // Group by notification type/reason
      const grouped = data.recipients.reduce((acc: Record<string, any[]>, recipient) => {
        const type = recipient.type || 'default';
        if (!acc[type]) acc[type] = [];
        acc[type].push(recipient);
        return acc;
      }, {});

      return (
        <div className="space-y-3">
          {Object.entries(grouped).map(([type, recipients]) => (
            <div key={type} className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium capitalize">{type.replace(/-/g, ' ')}</span>
                <Badge variant="secondary" className="text-xs">{recipients.length}</Badge>
              </div>
              <div className="divide-y divide-border">
                {recipients.slice(0, 10).map((recipient: any, idx: number) => (
                  <div key={idx} className="px-3 py-2 flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {recipient.username ? (
                      <Link href={`/u/${recipient.username}`} className="text-primary hover:underline">
                        @{recipient.username}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{recipient.email}</span>
                    )}
                    {recipient.reason && (
                      <span className="text-xs text-muted-foreground ml-auto">{recipient.reason}</span>
                    )}
                  </div>
                ))}
                {recipients.length > 10 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                    +{recipients.length - 10} more recipients
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      // Group by user - show all recipients with their notification types
      return (
        <div className="space-y-2">
          {data.recipients.slice(0, 20).map((recipient: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {recipient.username ? (
                  <Link href={`/u/${recipient.username}`} className="text-sm text-primary hover:underline">
                    @{recipient.username}
                  </Link>
                ) : (
                  <span className="text-sm">{recipient.email}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {recipient.type && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {recipient.type.replace(/-/g, ' ')}
                  </Badge>
                )}
                {recipient.reason && (
                  <span className="text-xs text-muted-foreground">{recipient.reason}</span>
                )}
              </div>
            </div>
          ))}
          {data.recipients.length > 20 && (
            <div className="text-xs text-muted-foreground text-center py-2">
              +{data.recipients.length - 20} more recipients
            </div>
          )}
        </div>
      );
    }
  };

  // Render Events tab content
  const renderEventsTab = () => {
    if (allLogsLoading) {
      return (
        <div className="flex justify-center items-center py-16">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    // Sort crons by next run time
    const sortedCrons = [...cronSchedules].sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());

    return (
      <div className="space-y-8">
        {/* Upcoming Scheduled Notifications */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Upcoming Scheduled Notifications</h3>
            </div>
            {/* Grouping toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setRecipientGrouping('type')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  recipientGrouping === 'type'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="h-3.5 w-3.5 inline-block mr-1" />
                By Type
              </button>
              <button
                onClick={() => setRecipientGrouping('user')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  recipientGrouping === 'user'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <User className="h-3.5 w-3.5 inline-block mr-1" />
                By User
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {sortedCrons.map((cron) => {
              const isExpanded = expandedCrons.has(cron.id);
              return (
                <div key={cron.id} className="wewrite-card overflow-hidden">
                  <button
                    onClick={() => toggleCronExpand(cron.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{cron.name}</p>
                          <Badge variant="outline" className="text-xs">
                            <Mail className="h-3 w-3 mr-1" />
                            Email
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{cron.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Badge variant="secondary" className="text-xs">
                          {formatTimeUntil(cron.nextRun)}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {cron.nextRun.toLocaleDateString()} at {cron.nextRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="p-4 border-t border-border bg-muted/20">
                      {renderRecipients(cron.id)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Notification Events */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Recent Notification Events</h3>
            <Badge variant="secondary" className="ml-2">
              {allEmailLogs.length} emails
            </Badge>
          </div>

          {allEmailLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No notification events found</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {allEmailLogs.map((log) => (
                <div
                  key={log.id}
                  className="wewrite-card p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {log.status === 'sent' || log.status === 'delivered' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="text-xs">
                            <Mail className="h-3 w-3 mr-1" />
                            Email
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {log.templateName || log.templateId}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {log.recipientUsername ? (
                            <Link
                              href={`/u/${log.recipientUsername}`}
                              className="font-medium text-sm text-primary hover:underline"
                            >
                              @{log.recipientUsername}
                            </Link>
                          ) : (
                            <span className="font-medium text-sm">
                              {log.recipientEmail}
                            </span>
                          )}
                          <span className="text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(log.sentAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {log.subject}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={log.status === 'sent' || log.status === 'delivered' ? 'default' : 'destructive'}
                      className="text-xs flex-shrink-0"
                    >
                      {log.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-7xl">
        {/* Regular Header (not floating) */}
        <header className="border-b bg-background px-4 py-3 mb-6 flex items-start justify-between gap-3 lg:px-0 lg:py-4 lg:border-b-0">
          <div>
            <button
              className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => router.push('/admin')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Admin
            </button>
            <h1 className="text-2xl font-semibold leading-tight flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Notifications
            </h1>
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
              Email, in-app, and push notifications
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                Powered by Resend
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://resend.com/emails"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Resend Dashboard
            </a>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.push('/')}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'templates'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mail className="h-4 w-4 inline-block mr-2" />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'events'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="h-4 w-4 inline-block mr-2" />
            Events
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'events' ? (
          renderEventsTab()
        ) : (
          <>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Template List */}
            <div className="w-full lg:w-1/3 space-y-4">
              {/* Search */}
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />

              {/* Template Categories */}
              <div className="space-y-6">
                {grouped && Object.entries(categoryConfig).map(([category, config]) => {
                  const categoryTemplates = (grouped as any)[category] || [];
                  const filteredCategoryTemplates = categoryTemplates.filter((t: EmailTemplate) =>
                    filteredTemplates.some(ft => ft.id === t.id)
                  );
                  
                  if (filteredCategoryTemplates.length === 0) return null;
                  
                  const Icon = config.icon;
                  
                  return (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </h3>
                      <div className="space-y-2">
                        {filteredCategoryTemplates.map((template: EmailTemplate) => {
                          const status = triggerStatus[template.id];
                          const modes = notificationModes[template.id] || { email: false, inApp: false, push: false };
                          return (
                            <button
                              key={template.id}
                              onClick={() => loadPreview(template.id)}
                              className={`w-full text-left p-3 rounded-lg border transition-all ${
                                selectedTemplate === template.id
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">{template.name}</p>
                                    {status?.status === 'active' && (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                    )}
                                    {status?.status === 'partial' && (
                                      <AlertCircle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                                    )}
                                    {status?.status === 'not-implemented' && (
                                      <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                                    )}
                                    {status?.status === 'disabled' && (
                                      <XCircle className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {template.subject}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Mail className={`h-3.5 w-3.5 ${modes.email ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}`} title={modes.email ? 'Email enabled' : 'Email disabled'} />
                                  <Bell className={`h-3.5 w-3.5 ${modes.inApp ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600'}`} title={modes.inApp ? 'In-app enabled' : 'In-app disabled'} />
                                  <Smartphone className={`h-3.5 w-3.5 ${modes.push ? 'text-purple-500' : 'text-gray-300 dark:text-gray-600'}`} title={modes.push ? 'Push enabled' : 'Push disabled'} />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No templates found</p>
                </div>
              )}
            </div>

            {/* Preview Panel */}
            <div className="w-full lg:w-2/3">
              {selectedTemplate && selectedTemplateData ? (
                <div className="space-y-4">
                  {/* Template Info */}
                  <div className="wewrite-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h2 className="text-xl font-bold">{selectedTemplateData.name}</h2>
                          <Badge className={categoryConfig[selectedTemplateData.category].color}>
                            {categoryConfig[selectedTemplateData.category].label}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">{selectedTemplateData.description}</p>
                        <p className="text-sm mt-2">
                          <span className="text-muted-foreground">Subject:</span>{' '}
                          <span className="font-medium">{selectedTemplateData.subject}</span>
                        </p>

                        {/* Notification Modes */}
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-xs text-muted-foreground">Delivery:</span>
                          {notificationModes[selectedTemplate]?.email && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Mail className="h-3 w-3 text-blue-500" />
                              Email
                            </Badge>
                          )}
                          {notificationModes[selectedTemplate]?.inApp && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Bell className="h-3 w-3 text-orange-500" />
                              In-App
                            </Badge>
                          )}
                          {notificationModes[selectedTemplate]?.push && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Smartphone className="h-3 w-3 text-purple-500" />
                              Push
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCode(!showCode)}
                          className="gap-1"
                        >
                          <Code className="h-4 w-4" />
                          {showCode ? 'Preview' : 'HTML'}
                        </Button>
                        {showCode && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyHtml}
                            className="gap-1"
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied ? 'Copied' : 'Copy'}
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Trigger Status */}
                    {selectedTriggerStatus && (
                      <div className={`mt-4 p-3 rounded-lg border ${
                        selectedTriggerStatus.status === 'active' 
                          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                          : selectedTriggerStatus.status === 'partial'
                          ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                          : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                      }`}>
                        <div className="flex items-start gap-2">
                          {selectedTriggerStatus.status === 'active' && (
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          )}
                          {selectedTriggerStatus.status === 'partial' && (
                            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                          )}
                          {selectedTriggerStatus.status === 'not-implemented' && (
                            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className={`font-medium text-sm ${
                              selectedTriggerStatus.status === 'active' 
                                ? 'text-green-800 dark:text-green-200'
                                : selectedTriggerStatus.status === 'partial'
                                ? 'text-yellow-800 dark:text-yellow-200'
                                : 'text-red-800 dark:text-red-200'
                            }`}>
                              {selectedTriggerStatus.status === 'active' && 'Trigger Active'}
                              {selectedTriggerStatus.status === 'partial' && 'Partially Implemented'}
                              {selectedTriggerStatus.status === 'not-implemented' && 'Not Yet Implemented'}
                            </p>
                            <p className={`text-xs mt-0.5 ${
                              selectedTriggerStatus.status === 'active' 
                                ? 'text-green-700 dark:text-green-300'
                                : selectedTriggerStatus.status === 'partial'
                                ? 'text-yellow-700 dark:text-yellow-300'
                                : 'text-red-700 dark:text-red-300'
                            }`}>
                              {selectedTriggerStatus.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Email Preview Frame */}
                  <div className="wewrite-card p-0 overflow-hidden">
                    <div className="p-4 border-b border-border bg-muted/30">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        Email Preview
                      </h3>
                    </div>
                    {previewLoading ? (
                      <div className="flex items-center justify-center h-96">
                        <Loader className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : showCode ? (
                      <pre className="p-4 overflow-auto max-h-[600px] text-xs bg-muted/30">
                        <code>{previewHtml}</code>
                      </pre>
                    ) : (
                      <div className="bg-gray-100 dark:bg-gray-900 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden max-w-[600px] mx-auto">
                          <iframe
                            srcDoc={previewHtml || ''}
                            className="w-full h-[500px] border-0"
                            title="Email Preview"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* In-App Notification Preview */}
                  {!showCode && (
                    <div className="wewrite-card">
                      <div className="mb-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Bell className="h-5 w-5 text-muted-foreground" />
                          In-App Notification Preview
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          How this notification appears in the app
                        </p>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
                        <div className="max-w-[600px] mx-auto">
                          <NotificationPreview templateId={selectedTemplate} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Push Notification Preview */}
                  {!showCode && (
                    <div className="wewrite-card">
                      <div className="mb-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Smartphone className="h-5 w-5 text-muted-foreground" />
                          Push Notification Preview
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          How this notification appears on mobile devices
                        </p>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
                        <PushNotificationPreview templateId={selectedTemplate} />
                      </div>
                    </div>
                  )}

                  {/* Audit Log */}
                  <div className="wewrite-card">
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">Send History</h3>
                        <Badge variant="secondary" className="ml-2">
                          {emailLogs.length} {emailLogs.length === 1 ? 'email' : 'emails'}
                        </Badge>
                      </div>
                      {showLogs ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {showLogs && (
                      <div className="mt-4">
                        {emailLogs.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No emails sent with this template yet</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {emailLogs.map((log) => (
                              <div
                                key={log.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {log.status === 'sent' || log.status === 'delivered' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      {log.recipientUsername ? (
                                        <Link
                                          href={`/u/${log.recipientUsername}`}
                                          className="font-medium text-sm text-primary hover:underline truncate"
                                        >
                                          @{log.recipientUsername}
                                        </Link>
                                      ) : (
                                        <span className="font-medium text-sm truncate">
                                          {log.recipientEmail}
                                        </span>
                                      )}
                                    </div>
                                    {log.recipientUsername && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {log.recipientEmail}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <Badge 
                                    variant={log.status === 'sent' || log.status === 'delivered' ? 'default' : 'destructive'}
                                    className="text-xs"
                                  >
                                    {log.status}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatRelativeTime(log.sentAt)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Template Location */}
                  <div className="wewrite-card">
                    <h3 className="font-semibold mb-3">Template Location</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      To edit this template, modify the code in:
                    </p>
                    <code className="text-sm bg-muted px-3 py-2 rounded block">
                      app/lib/emailTemplates.ts
                    </code>
                    <p className="text-xs text-muted-foreground mt-3">
                      Look for <code className="bg-muted px-1 rounded">{selectedTemplateData.id}EmailTemplate</code> or search for the template ID.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="wewrite-card flex flex-col items-center justify-center h-96 text-center">
                  <Mail className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Template</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Choose an email template from the list to preview its design and see the send history.
                  </p>
                  
                  {/* Legends */}
                  <div className="mt-6 space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground">Status Indicators</div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        <span>Active</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                        <span>Partial</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                        <span>Not Implemented</span>
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-muted-foreground mt-4">Notification Modes</div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-blue-500" />
                        <span>Email</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Bell className="h-3.5 w-3.5 text-orange-500" />
                        <span>In-App</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Smartphone className="h-3.5 w-3.5 text-purple-500" />
                        <span>Push</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Email Unsubscribe System Documentation */}
          <div className="mt-8 wewrite-card">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Email Unsubscribe System</h3>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Users can manage their email preferences without logging in using token-based authentication.
            </p>

            <div className="space-y-4">
              {/* How it works */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">How it works</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">1</span>
                    <span>Each user has a unique <code className="bg-muted px-1 rounded">emailSettingsToken</code> stored in their user document</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">2</span>
                    <span>Email footers include token-based links for "Manage preferences" and "Unsubscribe"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">3</span>
                    <span>Users can view and modify preferences at <code className="bg-muted px-1 rounded">/email-preferences/[token]</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">4</span>
                    <span>One-click unsubscribe available via <code className="bg-muted px-1 rounded">/api/email/unsubscribe?token=xxx&type=xxx</code></span>
                  </li>
                </ul>
              </div>

              {/* Email Types */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Email Type Identifiers</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Pass <code className="bg-muted px-1 rounded">emailSettingsToken</code> to templates to enable unsubscribe links.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-1.5 py-0.5 rounded">weekly-digest</code>
                    <span className="text-muted-foreground">Weekly Digest</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-1.5 py-0.5 rounded">new-follower</code>
                    <span className="text-muted-foreground">New Followers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-1.5 py-0.5 rounded">page-linked</code>
                    <span className="text-muted-foreground">Page Links</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-1.5 py-0.5 rounded">payout-reminder</code>
                    <span className="text-muted-foreground">Payout Reminders</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-1.5 py-0.5 rounded">payout-processed</code>
                    <span className="text-muted-foreground">Payment Receipts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-1.5 py-0.5 rounded">product-update</code>
                    <span className="text-muted-foreground">Product Updates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-1.5 py-0.5 rounded">earnings-summary</code>
                    <span className="text-muted-foreground">Earnings Summary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-1.5 py-0.5 rounded">all</code>
                    <span className="text-muted-foreground">All Non-Essential</span>
                  </div>
                </div>
              </div>

              {/* Key Files */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Key Files</h4>
                <ul className="text-xs space-y-1.5 text-muted-foreground font-mono">
                  <li><code className="text-foreground">app/services/emailSettingsTokenService.ts</code> - Token generation & validation</li>
                  <li><code className="text-foreground">app/email-preferences/[token]/page.tsx</code> - No-login preferences UI</li>
                  <li><code className="text-foreground">app/api/email/preferences/route.ts</code> - Token-based preferences API</li>
                  <li><code className="text-foreground">app/api/email/unsubscribe/route.ts</code> - One-click unsubscribe endpoint</li>
                  <li><code className="text-foreground">app/lib/emailTemplates.ts</code> - Templates with unsubscribe support</li>
                </ul>
              </div>
            </div>
          </div>
        </>
        )}
      </div>
    </div>
  );
}

export default function AdminEmailsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <AdminEmailsPageContent />
    </Suspense>
  );
}
