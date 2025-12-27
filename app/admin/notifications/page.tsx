"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { Icon } from '@/components/ui/Icon';
import { UsernameBadge } from '../../components/ui/UsernameBadge';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  SideDrawer,
  SideDrawerContent,
  SideDrawerHeader,
  SideDrawerBody,
  SideDrawerFooter,
  SideDrawerTitle,
  SideDrawerDescription,
} from '../../components/ui/side-drawer';
import { isAdmin } from '../../utils/isAdmin';
import { useToast } from '../../components/ui/use-toast';
import { useAdminData } from '../../providers/AdminDataProvider';
import { UserDetailsDrawer } from '../../components/admin/UserDetailsDrawer';
import { useTheme } from '../../providers/ThemeProvider';

// Import types from extracted module
import type { EmailTemplate, EmailLogEntry, GroupedTemplates, UserDetails, UserFinancialInfo, CronRecipientsState } from './types';

// Import config from extracted modules
import { notificationModes, triggerStatus, categoryConfig, getCronSchedules, formatTimeUntil, templateToCronMap, getUserFacingFlow, stageConfig, getFlowItem } from './config';

// Import utility functions
import { splitEngagementTemplates, formatRelativeTime, formatUserDateTime } from './utils';

// Import extracted components
import { PushNotificationPreview, NotificationPreview, NotificationFlowList } from './components';

// Get cron schedules (regenerates nextRun each time)
const cronSchedules = getCronSchedules();

/**
 * Transform email HTML for dark mode preview by replacing inline style values
 * This is necessary because inline styles override CSS rules (even with !important)
 */
function transformEmailForDarkMode(html: string): string {
  let transformed = html;

  // Replace inline background colors
  transformed = transformed.replace(/style="([^"]*?)background:\s*#f9f9f9([^"]*?)"/g, 'style="$1background: #262626$2"');
  transformed = transformed.replace(/style="([^"]*?)background:\s*#fff([^"]*?)"/g, 'style="$1background: #333333$2"');
  transformed = transformed.replace(/style="([^"]*?)background:\s*#ffffff([^"]*?)"/g, 'style="$1background: #333333$2"');
  transformed = transformed.replace(/style="([^"]*?)background:\s*#f5f5f5([^"]*?)"/g, 'style="$1background: #333333$2"');
  transformed = transformed.replace(/style="([^"]*?)background:\s*#e5e7eb([^"]*?)"/g, 'style="$1background: #404040$2"');
  transformed = transformed.replace(/style="([^"]*?)background:\s*#fff4f4([^"]*?)"/g, 'style="$1background: #2a1a1a$2"');

  // Replace inline text colors
  transformed = transformed.replace(/style="([^"]*?)color:\s*#333([^"]*?)"/g, 'style="$1color: #e5e5e5$2"');
  transformed = transformed.replace(/style="([^"]*?)color:\s*#666([^"]*?)"/g, 'style="$1color: #a3a3a3$2"');
  transformed = transformed.replace(/style="([^"]*?)color:\s*#999([^"]*?)"/g, 'style="$1color: #737373$2"');
  transformed = transformed.replace(/style="([^"]*?)color:\s*#000([^"]*?)"/g, 'style="$1color: #ffffff$2"');

  // Replace inline border colors
  transformed = transformed.replace(/style="([^"]*?)border:\s*1px solid #eee([^"]*?)"/g, 'style="$1border: 1px solid #404040$2"');
  transformed = transformed.replace(/style="([^"]*?)border:\s*1px solid #ddd([^"]*?)"/g, 'style="$1border: 1px solid #404040$2"');
  transformed = transformed.replace(/style="([^"]*?)border:\s*1px solid #e5e7eb([^"]*?)"/g, 'style="$1border: 1px solid #404040$2"');
  transformed = transformed.replace(/style="([^"]*?)border:\s*1px solid #ffcccc([^"]*?)"/g, 'style="$1border: 1px solid #4a2020$2"');
  transformed = transformed.replace(/style="([^"]*?)border-color:\s*#eee([^"]*?)"/g, 'style="$1border-color: #404040$2"');

  // Add dark mode CSS for any remaining elements
  transformed = transformed.replace(
    '</head>',
    `<style>
      .email-body { background-color: #1a1a1a !important; }
      .dark-text { color: #e5e5e5 !important; }
      .dark-text-muted { color: #a3a3a3 !important; }
      .dark-text-heading { color: #ffffff !important; }
      .dark-card { background-color: #262626 !important; }
      .dark-card-inner { background-color: #333333 !important; border-color: #404040 !important; }
      .dark-footer { color: #737373 !important; }
      .dark-footer a { color: #737373 !important; }
      .dark-link { color: #60a5fa !important; }
      .dark-stat-box { background-color: #333333 !important; border-color: #404040 !important; }
      .dark-alert-security { background-color: #2a1a1a !important; border-color: #4a2020 !important; }
    </style></head>`
  );

  return transformed;
}

function AdminEmailsPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const { adminFetch } = useAdminData();

  // Tab state from URL
  const tabParam = searchParams.get('tab');
  const validTabs = ['templates', 'upcoming', 'sent'] as const;
  type TabType = typeof validTabs[number];
  const activeTab: TabType = validTabs.includes(tabParam as TabType) ? (tabParam as TabType) : 'templates';

  // Function to change tab with URL update
  const setActiveTab = (tab: TabType) => {
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

  // Scheduled notifications state
  const [cronRecipients, setCronRecipients] = useState<Record<string, { loading: boolean; recipients: any[] }>>({});

  // Email preview side drawer state
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewTemplateId, setEmailPreviewTemplateId] = useState<string | null>(null);
  const [emailPreviewTemplateName, setEmailPreviewTemplateName] = useState<string | null>(null);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [emailPreviewUserId, setEmailPreviewUserId] = useState<string | null>(null);
  const [emailPreviewUsername, setEmailPreviewUsername] = useState<string | null>(null);
  const [emailPreviewIsPersonalized, setEmailPreviewIsPersonalized] = useState(false);
  const [emailPreviewError, setEmailPreviewError] = useState<string | null>(null);
  const [emailPreviewTriggerReason, setEmailPreviewTriggerReason] = useState<string | null>(null);

  // User details drawer state (simplified - using shared component)
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [userDetailsUserId, setUserDetailsUserId] = useState<string | null>(null);
  const [userDetailsUsername, setUserDetailsUsername] = useState<string | null>(null);

  // Cron scheduling control state
  const [selectedCronForAction, setSelectedCronForAction] = useState<string | null>(null);
  const [cronActionLoading, setCronActionLoading] = useState(false);
  const [scheduleInputValue, setScheduleInputValue] = useState('');
  const [showScheduleInput, setShowScheduleInput] = useState(false);

  // Create notification modal state
  const [createNotificationOpen, setCreateNotificationOpen] = useState(false);
  const [createNotifUsername, setCreateNotifUsername] = useState('');
  const [createNotifTemplateId, setCreateNotifTemplateId] = useState('');
  const [createNotifScheduledAt, setCreateNotifScheduledAt] = useState('');
  const [createNotifLoading, setCreateNotifLoading] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<Array<{ uid: string; username: string; email: string }>>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Pagination state for upcoming notifications
  const [upcomingNotificationsLimit, setUpcomingNotificationsLimit] = useState(50);

  // Expanded template upcoming list (for inline expansion in templates table)
  const [expandedTemplateUpcoming, setExpandedTemplateUpcoming] = useState<string | null>(null);
  const [expandedTemplateLimit, setExpandedTemplateLimit] = useState<Record<string, number>>({});
  const [bulkRescheduleInput, setBulkRescheduleInput] = useState<string>('');
  const [showBulkReschedule, setShowBulkReschedule] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Template details drawer state
  const [templateDetailsOpen, setTemplateDetailsOpen] = useState(false);
  const [templateDetailsId, setTemplateDetailsId] = useState<string | null>(null);
  const [templateDetailsHtml, setTemplateDetailsHtml] = useState<string | null>(null);
  const [templateDetailsLoading, setTemplateDetailsLoading] = useState(false);
  const [templateDetailsLogs, setTemplateDetailsLogs] = useState<EmailLogEntry[]>([]);
  const [templateDetailsShowCode, setTemplateDetailsShowCode] = useState(false);
  const [templateDetailsLogsOpen, setTemplateDetailsLogsOpen] = useState(false);

  // Check admin access - use user.isAdmin from auth context for consistency
  useEffect(() => {
    if (!authLoading && user) {
      if (!user.isAdmin) {
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
        const response = await adminFetch('/api/admin/email-templates');
        const data = await response.json();
        
        if (data.success) {
          setTemplates(data.templates);
          // Split engagement templates into active vs inactive user categories
          const { active, inactive } = splitEngagementTemplates(data.grouped.engagement || []);
          setGrouped({
            ...data.grouped,
            engagementActive: active,
            engagementInactive: inactive,
          });
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

  // Load sent emails data when Sent tab is active
  useEffect(() => {
    const loadSentData = async () => {
      if (activeTab !== 'sent' || !user || authLoading) return;

      setAllLogsLoading(true);
      try {
        const logsRes = await adminFetch('/api/admin/email-logs?limit=100');
        const logsData = await logsRes.json();

        if (logsData.success) {
          setAllEmailLogs(logsData.logs || []);
        }
      } catch (error) {
        console.error('Failed to load sent emails:', error);
        toast({
          title: 'Error',
          description: 'Failed to load sent emails',
          variant: 'destructive',
        });
      } finally {
        setAllLogsLoading(false);
      }
    };

    loadSentData();
  }, [activeTab, user, authLoading, toast]);

  // Load all cron recipients for both tabs (templates shows "upcoming" counts, events shows list)
  // Skip system jobs (backend processing jobs that don't send user-facing emails)
  useEffect(() => {
    const loadAllCronRecipients = async () => {
      for (const cron of cronSchedules) {
        // Skip loading recipients for system jobs - they don't send user-facing emails
        if (cron.isSystemJob) continue;

        if (!cronRecipients[cron.id]) {
          setCronRecipients(prev => ({ ...prev, [cron.id]: { loading: true, recipients: [] } }));
          try {
            const res = await adminFetch(`/api/admin/cron-recipients?cronId=${cron.id}`);
            const data = await res.json();
            setCronRecipients(prev => ({
              ...prev,
              [cron.id]: { loading: false, recipients: data.recipients || [] }
            }));
          } catch (error) {
            console.error('Failed to fetch recipients:', error);
            setCronRecipients(prev => ({
              ...prev,
              [cron.id]: { loading: false, recipients: [] }
            }));
          }
        }
      }
    };

    if (user && !authLoading) {
      loadAllCronRecipients();
    }
  }, [user, authLoading]);

  // Function to refresh all cron recipients (force reload)
  const refreshAllCronRecipients = async () => {
    // Set all to loading
    const loadingState: Record<string, { loading: boolean; recipients: any[] }> = {};
    for (const cron of cronSchedules) {
      if (!cron.isSystemJob) {
        loadingState[cron.id] = { loading: true, recipients: [] };
      }
    }
    setCronRecipients(loadingState);

    // Reload all
    for (const cron of cronSchedules) {
      if (cron.isSystemJob) continue;
      try {
        const res = await adminFetch(`/api/admin/cron-recipients?cronId=${cron.id}`);
        const data = await res.json();
        setCronRecipients(prev => ({
          ...prev,
          [cron.id]: { loading: false, recipients: data.recipients || [] }
        }));
      } catch (error) {
        console.error('Failed to fetch recipients:', error);
        setCronRecipients(prev => ({
          ...prev,
          [cron.id]: { loading: false, recipients: [] }
        }));
      }
    }
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

  // Open template details drawer
  const openTemplateDetails = async (templateId: string) => {
    setTemplateDetailsId(templateId);
    setTemplateDetailsOpen(true);
    setTemplateDetailsLoading(true);
    setTemplateDetailsHtml(null);
    setTemplateDetailsLogs([]);
    setTemplateDetailsShowCode(false);
    setTemplateDetailsLogsOpen(false);

    try {
      const [previewRes, logsRes] = await Promise.all([
        adminFetch(`/api/admin/email-templates?id=${templateId}&html=true`),
        adminFetch(`/api/admin/email-logs?templateId=${templateId}&limit=20`),
      ]);

      const previewData = await previewRes.json();
      const logsData = await logsRes.json();

      if (previewData.success) {
        setTemplateDetailsHtml(previewData.template.html);
      }

      if (logsData.success) {
        setTemplateDetailsLogs(logsData.logs || []);
      }
    } catch (error) {
      console.error('Failed to load template details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load template details',
        variant: 'destructive',
      });
    } finally {
      setTemplateDetailsLoading(false);
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

  // Open email preview side drawer
  const openEmailPreview = async (templateId: string, templateName: string, userId?: string, username?: string, triggerReason?: string, storedMetadata?: Record<string, any>) => {
    setEmailPreviewTemplateId(templateId);
    setEmailPreviewTemplateName(templateName);
    setEmailPreviewUserId(userId || null);
    setEmailPreviewUsername(username || null);
    setEmailPreviewTriggerReason(triggerReason || null);
    setEmailPreviewOpen(true);
    setEmailPreviewLoading(true);
    setEmailPreviewHtml(null);
    setEmailPreviewIsPersonalized(false);
    setEmailPreviewError(null);

    try {
      // Build URL with optional userId for personalized preview
      let url = `/api/admin/email-templates?id=${templateId}&html=true`;
      if (userId) {
        url += `&userId=${userId}`;
      }
      // If stored metadata is provided (from sent email logs), pass it to regenerate with original data
      if (storedMetadata) {
        url += `&metadata=${encodeURIComponent(JSON.stringify(storedMetadata))}`;
      }

      const response = await adminFetch(url);
      const data = await response.json();

      if (data.success) {
        setEmailPreviewHtml(data.template.html);
        setEmailPreviewIsPersonalized(data.template.isPersonalized || false);
        setEmailPreviewError(null);
      } else {
        const errorDetails = JSON.stringify({
          templateId,
          userId,
          url,
          status: response.status,
          error: data.error || 'Unknown error',
          data
        }, null, 2);
        setEmailPreviewError(errorDetails);
        toast({
          title: 'Error',
          description: data.error || 'Failed to load email preview',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load email preview:', error);
      const errorDetails = JSON.stringify({
        templateId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, null, 2);
      setEmailPreviewError(errorDetails);
      toast({
        title: 'Error',
        description: 'Failed to load email preview',
        variant: 'destructive',
      });
    } finally {
      setEmailPreviewLoading(false);
    }
  };

  // Open user details drawer
  const openUserDetails = (userId?: string, username?: string) => {
    if (!userId && !username) return;
    setUserDetailsUserId(userId || null);
    setUserDetailsUsername(username || null);
    setUserDetailsOpen(true);
  };

  // Trigger cron job with optional scheduling
  const triggerCron = async (cronId: string, scheduledAt?: string) => {
    setCronActionLoading(true);
    try {
      const response = await adminFetch('/api/admin/trigger-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cronId,
          scheduledAt,
          limit: 50,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: scheduledAt ? 'Scheduled!' : 'Triggered!',
          description: `${data.cronId}: ${data.summary.sent} sent, ${data.summary.skipped} skipped`,
        });
        // Reset state
        setSelectedCronForAction(null);
        setShowScheduleInput(false);
        setScheduleInputValue('');
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to trigger cron job',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to trigger cron:', error);
      toast({
        title: 'Error',
        description: 'Failed to trigger cron job',
        variant: 'destructive',
      });
    } finally {
      setCronActionLoading(false);
    }
  };

  // Trigger cron job for a specific user
  const triggerCronForUser = async (templateId: string, userId: string, scheduledAt?: string) => {
    setCronActionLoading(true);
    try {
      const response = await adminFetch('/api/admin/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          userId,
          scheduledAt,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: scheduledAt ? 'Scheduled!' : 'Sent!',
          description: `Notification ${scheduledAt ? 'scheduled' : 'sent'} to @${emailPreviewUsername || userId}`,
        });
        setShowScheduleInput(false);
        setScheduleInputValue('');
        setEmailPreviewOpen(false);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send notification',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to send notification',
        variant: 'destructive',
      });
    } finally {
      setCronActionLoading(false);
    }
  };

  // Search users by username
  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setUserSearchResults([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const response = await adminFetch(`/api/admin/users?search=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();
      if (data.users) {
        setUserSearchResults(data.users.map((u: any) => ({
          uid: u.uid,
          username: u.username || '',
          email: u.email,
        })));
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setUserSearchLoading(false);
    }
  };

  // Handle create notification
  const handleCreateNotification = async () => {
    if (!selectedUserId || !createNotifTemplateId) {
      toast({
        title: 'Missing fields',
        description: 'Please select a user and notification type',
        variant: 'destructive',
      });
      return;
    }

    setCreateNotifLoading(true);
    try {
      const response = await adminFetch('/api/admin/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: createNotifTemplateId,
          userId: selectedUserId,
          scheduledAt: createNotifScheduledAt || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: createNotifScheduledAt ? 'Scheduled!' : 'Sent!',
          description: `Notification ${createNotifScheduledAt ? 'scheduled' : 'sent'} to ${data.username || data.email}`,
        });
        // Reset form
        setCreateNotificationOpen(false);
        setCreateNotifUsername('');
        setCreateNotifTemplateId('');
        setCreateNotifScheduledAt('');
        setSelectedUserId(null);
        setUserSearchResults([]);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send notification',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to create notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to send notification',
        variant: 'destructive',
      });
    } finally {
      setCreateNotifLoading(false);
    }
  };

  // Get default schedule description for a cron
  const getCronDefaultSchedule = (cronId: string): string => {
    const cron = cronSchedules.find(c => c.id === cronId);
    if (!cron) return 'Unknown';

    // Parse schedule and return human-readable description
    const parts = cron.schedule.split(' ');
    const hour = parseInt(parts[1]);
    const dayOfWeek = parts[4];
    const dayOfMonth = parts[2];

    const time12h = hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`;

    if (dayOfMonth !== '*') {
      return `Monthly on the ${dayOfMonth}${dayOfMonth === '1' ? 'st' : 'th'} at ${time12h} UTC`;
    }
    if (dayOfWeek !== '*') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `Weekly on ${days[parseInt(dayOfWeek)]} at ${time12h} UTC`;
    }
    return `Daily at ${time12h} UTC`;
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
          <Icon name="Loader" className="text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  // Render the Upcoming tab content
  const renderUpcomingTab = () => {
    // Separate email-sending crons from system (backend) jobs
    const emailCrons = cronSchedules.filter(c => !c.isSystemJob);
    const systemCrons = cronSchedules.filter(c => c.isSystemJob);

    // Sort email crons by next run time
    const sortedEmailCrons = [...emailCrons].sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());
    const sortedSystemCrons = [...systemCrons].sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());

    // Build a flat list of all upcoming notifications with their scheduled time
    const buildUpcomingNotificationsList = () => {
      const notifications: Array<{
        cronId: string;
        cronName: string;
        nextRun: Date;
        recipient: any;
      }> = [];

      for (const cron of sortedEmailCrons) {
        const data = cronRecipients[cron.id];
        if (data && !data.loading && data.recipients.length > 0) {
          for (const recipient of data.recipients) {
            notifications.push({
              cronId: cron.id,
              cronName: cron.name,
              nextRun: cron.nextRun,
              recipient,
            });
          }
        }
      }

      notifications.sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());
      return notifications;
    };

    const upcomingNotifications = buildUpcomingNotificationsList();
    const isLoadingRecipients = sortedEmailCrons.some(cron => cronRecipients[cron.id]?.loading);

    return (
      <div className="space-y-6">
        {/* Upcoming Scheduled Notifications */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Calendar" size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">Scheduled Notifications</h3>
            {!isLoadingRecipients && (
              <Badge variant="secondary" className="text-xs">
                {upcomingNotifications.length}
              </Badge>
            )}
            <button
              onClick={refreshAllCronRecipients}
              disabled={isLoadingRecipients}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Refresh upcoming notifications"
            >
              <Icon name="RefreshCw" size={14} className={isLoadingRecipients ? 'animate-spin' : ''} />
            </button>
          </div>

          {isLoadingRecipients ? (
            <div className="flex items-center justify-center py-8">
              <Icon name="Loader" className="text-primary mr-2" />
              <span className="text-sm text-muted-foreground">Loading upcoming notifications...</span>
            </div>
          ) : upcomingNotifications.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Icon name="Calendar" size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming notifications scheduled</p>
            </div>
          ) : (
            <div className="wewrite-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Username</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Trigger Reason</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Scheduled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {upcomingNotifications.slice(0, upcomingNotificationsLimit).map((notif, idx) => (
                    <tr key={`${notif.cronId}-${notif.recipient.userId || notif.recipient.email}-${idx}`} className="hover:bg-muted/20">
                      <td className="px-3 py-2 text-left">
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 transition-colors"
                          onClick={() => openEmailPreview(notif.cronId, notif.cronName, notif.recipient.userId, notif.recipient.username, notif.recipient.reason)}
                        >
                          <Icon name="Eye" size={12} className="text-primary" />
                          {notif.cronName}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        {notif.recipient.userId && notif.recipient.username ? (
                          <UsernameBadge
                            userId={notif.recipient.userId}
                            username={notif.recipient.username}
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              openUserDetails(notif.recipient.userId, notif.recipient.username);
                            }}
                          />
                        ) : notif.recipient.username ? (
                          <button
                            onClick={() => openUserDetails(notif.recipient.userId, notif.recipient.username)}
                            className="text-primary hover:underline cursor-pointer text-sm"
                          >
                            @{notif.recipient.username}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px] hidden sm:table-cell">
                        {notif.recipient.email}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs max-w-[200px]">
                        {notif.recipient.reason || '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                        {formatTimeUntil(notif.nextRun)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {upcomingNotifications.length > upcomingNotificationsLimit && (
                <button
                  onClick={() => setUpcomingNotificationsLimit(prev => prev + 50)}
                  className="w-full px-3 py-2 text-xs text-primary hover:text-primary/80 text-center border-t border-border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  +{upcomingNotifications.length - upcomingNotificationsLimit} more notifications
                </button>
              )}
            </div>
          )}
        </div>

        {/* System Jobs Section (backend processing, no user emails) */}
        {sortedSystemCrons.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="Settings" size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground">System Jobs</h3>
              <Badge variant="outline" className="text-xs">
                Backend Only
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              These are backend processing jobs that don't send user-facing emails directly.
            </p>
            <div className="wewrite-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Job</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Next Run</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedSystemCrons.map((cron) => (
                    <tr key={cron.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Icon name="Settings" size={24} className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{cron.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs max-w-[300px]">
                        {cron.description}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                        {formatTimeUntil(cron.nextRun)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render the Sent tab content
  const renderSentTab = () => {
    return (
      <div className="space-y-6">
        {/* Recent Sent Emails */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Send" size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">Sent Emails</h3>
            <Badge variant="secondary" className="text-xs">
              {allEmailLogs.length}
            </Badge>
          </div>

          {allLogsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Icon name="Loader" className="text-primary mr-2 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading sent emails...</span>
            </div>
          ) : allEmailLogs.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Icon name="Mail" size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No sent emails found</p>
            </div>
          ) : (
            <div className="wewrite-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Template</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Username</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allEmailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 text-left">
                        {(() => {
                          // Build tooltip content
                          const tooltipParts: string[] = [`Status: ${log.status}`];
                          if (log.errorMessage) tooltipParts.push(`Error: ${log.errorMessage}`);
                          if (log.bounceReason) tooltipParts.push(`Bounce: ${log.bounceReason}`);
                          if (log.resendId) tooltipParts.push(`Resend ID: ${log.resendId}`);
                          if (log.metadata?.scheduledAt) tooltipParts.push(`Scheduled for: ${new Date(log.metadata.scheduledAt).toLocaleString()}`);
                          if (log.openedAt) tooltipParts.push(`Opened: ${new Date(log.openedAt).toLocaleString()}`);
                          if (log.clickedAt) tooltipParts.push(`Clicked: ${new Date(log.clickedAt).toLocaleString()}`);
                          if (log.lastWebhookEvent) tooltipParts.push(`Last event: ${log.lastWebhookEvent}`);
                          const tooltip = tooltipParts.join('\n');

                          const statusConfig: Record<string, { icon: string; color: string }> = {
                            delivered: { icon: 'CheckCircle2', color: 'text-green-500' },
                            sent: { icon: 'Send', color: 'text-blue-500' },
                            scheduled: { icon: 'Clock', color: 'text-blue-400' },
                            opened: { icon: 'Eye', color: 'text-purple-500' },
                            clicked: { icon: 'MousePointerClick', color: 'text-indigo-500' },
                            bounced: { icon: 'MailWarning', color: 'text-orange-500' },
                            complained: { icon: 'Flag', color: 'text-red-400' },
                            delayed: { icon: 'Timer', color: 'text-yellow-500' },
                            failed: { icon: 'XCircle', color: 'text-red-500' },
                          };

                          const config = statusConfig[log.status] || statusConfig.failed;

                          return (
                            <span title={tooltip} className="cursor-help">
                              <Icon
                                name={config.icon as any}
                                size={14}
                                className={`${config.color} flex-shrink-0`}
                              />
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 transition-colors"
                          onClick={() => openEmailPreview(log.templateId, log.templateName || log.templateId, log.recipientUserId, log.recipientUsername, undefined, log.metadata)}
                        >
                          <Icon name="Eye" size={12} className="text-primary" />
                          {log.templateName || log.templateId}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        {log.recipientUserId && log.recipientUsername ? (
                          <UsernameBadge
                            userId={log.recipientUserId}
                            username={log.recipientUsername}
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              openUserDetails(log.recipientUserId, log.recipientUsername);
                            }}
                          />
                        ) : log.recipientUsername ? (
                          <button
                            onClick={() => openUserDetails(log.recipientUserId, log.recipientUsername)}
                            className="text-primary hover:underline cursor-pointer text-sm"
                          >
                            @{log.recipientUsername}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px] hidden sm:table-cell">
                        {log.recipientEmail}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(log.sentAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-7xl">
        {/* Desktop Header - hidden on mobile (drawer handles navigation) */}
        <header className="hidden lg:flex border-b bg-background px-4 py-3 mb-6 items-start justify-between gap-3 lg:px-0 lg:py-4 lg:border-b-0">
          <div>
            <h1 className="text-2xl font-semibold leading-tight flex items-center gap-2">
              <Icon name="Bell" size={24} />
              Notifications
            </h1>
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
              Email, in-app, and push notifications
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                Powered by Resend
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="default"
              size="sm"
              onClick={() => setCreateNotificationOpen(true)}
              className="gap-1"
            >
              <Icon name="Plus" size={16} />
              New Notification
            </Button>
            <a
              href="https://resend.com/emails"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="ExternalLink" size={16} />
              Resend Dashboard
            </a>
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
            <Icon name="Mail" size={16} className="inline-block mr-2" />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'upcoming'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="Calendar" size={16} className="inline-block mr-2" />
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'sent'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="Send" size={16} className="inline-block mr-2" />
            Sent
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'upcoming' ? (
          renderUpcomingTab()
        ) : activeTab === 'sent' ? (
          renderSentTab()
        ) : (
          <div className="space-y-4">
            {/* Search */}
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Icon name="Search" size={16} />}
              className="max-w-sm"
            />

            {/* Dense Template Table - Ordered by User Journey */}
            <div className="wewrite-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8">#</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Template</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Stage</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Trigger</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden xl:table-cell">Blocked By</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-24">Channels</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Status</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24 hidden sm:table-cell">Upcoming</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {getUserFacingFlow()
                    .filter(item => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        item.name.toLowerCase().includes(query) ||
                        item.description.toLowerCase().includes(query) ||
                        item.id.toLowerCase().includes(query)
                      );
                    })
                    .map((item) => {
                      const status = triggerStatus[item.id];
                      const modes = notificationModes[item.id] || { email: false, inApp: false, push: false };
                      const cronId = item.cronId || templateToCronMap[item.id];
                      const upcomingCount = cronId && cronRecipients[cronId]?.recipients?.length || 0;
                      const upcomingRecipients = cronId && cronRecipients[cronId]?.recipients || [];
                      const cronData = cronId && cronSchedules.find(c => c.id === cronId);
                      const config = stageConfig[item.stage];
                      const isExpanded = expandedTemplateUpcoming === item.id;

                      return (
                        <React.Fragment key={item.id}>
                          <tr
                            className={`hover:bg-muted/20 cursor-pointer transition-colors ${isExpanded ? 'bg-muted/10' : ''}`}
                            onClick={() => openTemplateDetails(item.id)}
                          >
                            {/* Order Number */}
                            <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                              {item.order}
                            </td>

                            {/* Template Name & Description */}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.name}</span>
                                {item.isAutomated && (
                                  <Icon name="Clock" size={12} className="text-blue-500" title="Automated (cron)" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {item.description}
                              </p>
                            </td>

                            {/* Stage */}
                            <td className="px-3 py-2 hidden md:table-cell">
                              <span className={`text-xs font-medium ${config.color}`}>
                                {config.label}
                              </span>
                            </td>

                            {/* Trigger */}
                            <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell">
                              {item.isAutomated ? (
                                <span className="flex items-center gap-1">
                                  <Icon name="RefreshCw" size={10} />
                                  Cron
                                </span>
                              ) : item.triggerEvent ? (
                                <span className="flex items-center gap-1">
                                  <Icon name="Zap" size={10} className="text-amber-500" />
                                  {item.triggerEvent}
                                </span>
                              ) : '—'}
                            </td>

                            {/* Blocked By */}
                            <td className="px-3 py-2 text-xs hidden xl:table-cell">
                              {item.blockedBy && item.blockedBy.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {item.blockedBy.map((blocker) => (
                                    <span
                                      key={blocker}
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                      title={`Blocked when user ${blocker.replace(/_/g, ' ')}`}
                                    >
                                      <Icon name="Ban" size={10} />
                                      {blocker.replace(/^has_/, '').replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              ) : item.requires && item.requires.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {item.requires.map((req) => (
                                    <span
                                      key={req}
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                      title={`Requires ${req.replace(/_/g, ' ')}`}
                                    >
                                      <Icon name="Check" size={10} />
                                      {req.replace(/^has_|^is_|^email_/g, '').replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>

                            {/* Channels */}
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1.5">
                                <Icon
                                  name="Mail"
                                  size={14}
                                  className={modes.email ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}
                                />
                                <Icon
                                  name="Bell"
                                  size={14}
                                  className={modes.inApp ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600'}
                                />
                                <Icon
                                  name="Smartphone"
                                  size={14}
                                  className={modes.push ? 'text-purple-500' : 'text-gray-300 dark:text-gray-600'}
                                />
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-3 py-2 text-center">
                              {status?.status === 'active' && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 text-xs">
                                  Active
                                </Badge>
                              )}
                              {status?.status === 'partial' && (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800 text-xs">
                                  Partial
                                </Badge>
                              )}
                              {status?.status === 'not-implemented' && (
                                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 text-xs">
                                  Not Impl
                                </Badge>
                              )}
                              {!status && (
                                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 text-xs">
                                  Unknown
                                </Badge>
                              )}
                            </td>

                            {/* Upcoming */}
                            <td className="px-3 py-2 text-right hidden sm:table-cell">
                              {upcomingCount > 0 && cronData ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedTemplateUpcoming(isExpanded ? null : item.id);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 font-medium hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors cursor-pointer"
                                  title={`Scheduled for ${formatTimeUntil(cronData.nextRun)} - Click to expand`}
                                >
                                  {upcomingCount}
                                  <Icon
                                    name={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                                    size={12}
                                  />
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded upcoming recipients sub-table */}
                          {isExpanded && upcomingRecipients.length > 0 && (() => {
                            const currentLimit = expandedTemplateLimit[item.id] || 10;
                            const displayedRecipients = upcomingRecipients.slice(0, currentLimit);
                            const hasMore = upcomingRecipients.length > currentLimit;
                            const remainingCount = upcomingRecipients.length - currentLimit;

                            return (
                              <tr className="bg-muted/5">
                                <td colSpan={8} className="px-0 py-0">
                                  <div className="border-l-4 border-orange-400 dark:border-orange-600 ml-3 my-2">
                                    <div className="px-4 py-2">
                                      {/* Header with schedule info and bulk actions */}
                                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-2">
                                            <Icon name="Calendar" size={14} className="text-orange-500" />
                                            <span className="text-xs font-medium text-muted-foreground">
                                              Upcoming Recipients ({upcomingRecipients.length})
                                            </span>
                                          </div>
                                          {cronData && (
                                            <Badge variant="outline" className="text-xs gap-1">
                                              <Icon name="Clock" size={10} />
                                              {formatTimeUntil(cronData.nextRun)}
                                            </Badge>
                                          )}
                                        </div>

                                        {/* Bulk action buttons */}
                                        <div className="flex items-center gap-2">
                                          {showBulkReschedule && expandedTemplateUpcoming === item.id ? (
                                            <div className="flex items-center gap-2">
                                              <Input
                                                placeholder="e.g., 'in 2 hours' or 'tomorrow 9am'"
                                                value={bulkRescheduleInput}
                                                onChange={(e) => setBulkRescheduleInput(e.target.value)}
                                                className="h-7 text-xs w-48"
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                              <Button
                                                variant="default"
                                                size="sm"
                                                className="h-7 text-xs gap-1"
                                                disabled={bulkActionLoading || !bulkRescheduleInput.trim()}
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  setBulkActionLoading(true);
                                                  try {
                                                    const response = await adminFetch('/api/admin/trigger-cron', {
                                                      method: 'POST',
                                                      headers: { 'Content-Type': 'application/json' },
                                                      body: JSON.stringify({
                                                        cronId: cronId,
                                                        scheduledAt: bulkRescheduleInput,
                                                        limit: upcomingRecipients.length,
                                                      }),
                                                    });
                                                    const data = await response.json();
                                                    if (data.success) {
                                                      toast({
                                                        title: 'Scheduled!',
                                                        description: `${data.summary.sent} notifications scheduled for ${bulkRescheduleInput}`,
                                                      });
                                                      setShowBulkReschedule(false);
                                                      setBulkRescheduleInput('');
                                                    } else {
                                                      toast({
                                                        title: 'Error',
                                                        description: data.error || 'Failed to schedule notifications',
                                                        variant: 'destructive',
                                                      });
                                                    }
                                                  } catch (error) {
                                                    toast({
                                                      title: 'Error',
                                                      description: 'Failed to schedule notifications',
                                                      variant: 'destructive',
                                                    });
                                                  } finally {
                                                    setBulkActionLoading(false);
                                                  }
                                                }}
                                              >
                                                {bulkActionLoading ? (
                                                  <Icon name="Loader" size={12} className="animate-spin" />
                                                ) : (
                                                  <Icon name="Calendar" size={12} />
                                                )}
                                                Schedule
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setShowBulkReschedule(false);
                                                  setBulkRescheduleInput('');
                                                }}
                                              >
                                                Cancel
                                              </Button>
                                            </div>
                                          ) : (
                                            <>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs gap-1"
                                                disabled={bulkActionLoading}
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  setBulkActionLoading(true);
                                                  try {
                                                    const response = await adminFetch('/api/admin/trigger-cron', {
                                                      method: 'POST',
                                                      headers: { 'Content-Type': 'application/json' },
                                                      body: JSON.stringify({
                                                        cronId: cronId,
                                                        limit: upcomingRecipients.length,
                                                      }),
                                                    });
                                                    const data = await response.json();
                                                    if (data.success) {
                                                      toast({
                                                        title: 'Sent!',
                                                        description: `${data.summary.sent} sent, ${data.summary.skipped} skipped, ${data.summary.failed} failed`,
                                                      });
                                                      // Refresh recipients
                                                      setCronRecipients(prev => ({
                                                        ...prev,
                                                        [cronId!]: { loading: true, recipients: [] }
                                                      }));
                                                      const res = await adminFetch(`/api/admin/cron-recipients?cronId=${cronId}`);
                                                      const recipientsData = await res.json();
                                                      setCronRecipients(prev => ({
                                                        ...prev,
                                                        [cronId!]: { loading: false, recipients: recipientsData.recipients || [] }
                                                      }));
                                                    } else {
                                                      toast({
                                                        title: 'Error',
                                                        description: data.error || 'Failed to send notifications',
                                                        variant: 'destructive',
                                                      });
                                                    }
                                                  } catch (error) {
                                                    toast({
                                                      title: 'Error',
                                                      description: 'Failed to send notifications',
                                                      variant: 'destructive',
                                                    });
                                                  } finally {
                                                    setBulkActionLoading(false);
                                                  }
                                                }}
                                              >
                                                {bulkActionLoading ? (
                                                  <Icon name="Loader" size={12} className="animate-spin" />
                                                ) : (
                                                  <Icon name="Send" size={12} />
                                                )}
                                                Send All Now
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs gap-1"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setShowBulkReschedule(true);
                                                }}
                                              >
                                                <Icon name="Clock" size={12} />
                                                Reschedule All
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      {/* Recipients table */}
                                      <div className="bg-background rounded border border-border overflow-hidden">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="border-b border-border bg-muted/30">
                                              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">User</th>
                                              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                                              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Reason</th>
                                              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground w-20">Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border">
                                            {displayedRecipients.map((recipient: any, idx: number) => (
                                              <tr key={recipient.userId || recipient.email || idx} className="hover:bg-muted/20">
                                                <td className="px-3 py-1.5">
                                                  {recipient.userId && recipient.username ? (
                                                    <UsernameBadge
                                                      userId={recipient.userId}
                                                      username={recipient.username}
                                                      size="sm"
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        openUserDetails(recipient.userId, recipient.username);
                                                      }}
                                                    />
                                                  ) : recipient.username ? (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openUserDetails(recipient.userId, recipient.username);
                                                      }}
                                                      className="text-primary hover:underline cursor-pointer text-xs"
                                                    >
                                                      @{recipient.username}
                                                    </button>
                                                  ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                  )}
                                                </td>
                                                <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[180px] hidden sm:table-cell">
                                                  {recipient.email}
                                                </td>
                                                <td className="px-3 py-1.5 text-muted-foreground max-w-[200px]">
                                                  {recipient.reason || '—'}
                                                </td>
                                                <td className="px-3 py-1.5 text-right">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      openEmailPreview(item.id, item.name, recipient.userId, recipient.username, recipient.reason);
                                                    }}
                                                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
                                                  >
                                                    <Icon name="Eye" size={12} />
                                                    Preview
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>

                                        {/* Pagination / Load more */}
                                        {hasMore && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedTemplateLimit(prev => ({
                                                ...prev,
                                                [item.id]: currentLimit + 20
                                              }));
                                            }}
                                            className="w-full px-3 py-2 text-xs text-primary hover:text-primary/80 text-center border-t border-border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <Icon name="ChevronDown" size={12} />
                                            Load {Math.min(remainingCount, 20)} more ({remainingCount} remaining)
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })()}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>

              {/* Empty state */}
              {getUserFacingFlow().filter(item => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return (
                  item.name.toLowerCase().includes(query) ||
                  item.description.toLowerCase().includes(query) ||
                  item.id.toLowerCase().includes(query)
                );
              }).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="Mail" size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No templates found</p>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="font-medium">Status:</span>
                <div className="flex items-center gap-1">
                  <Icon name="CheckCircle2" size={14} className="text-green-500" />
                  <span>Active</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="AlertCircle" size={14} className="text-yellow-500" />
                  <span>Partial</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="XCircle" size={14} className="text-red-400" />
                  <span>Not Implemented</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium">Channels:</span>
                <div className="flex items-center gap-1">
                  <Icon name="Mail" size={14} className="text-blue-500" />
                  <span>Email</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="Bell" size={14} className="text-orange-500" />
                  <span>In-App</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="Smartphone" size={14} className="text-purple-500" />
                  <span>Push</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email Preview Side Drawer */}
      <SideDrawer
        open={emailPreviewOpen}
        onOpenChange={setEmailPreviewOpen}
        hashId="email-preview"
      >
        <SideDrawerContent side="right" size="xl">
          <SideDrawerHeader sticky showClose>
            <SideDrawerTitle className="flex items-center gap-2">
              <Icon name="Mail" size={20} />
              Email Preview
              {emailPreviewIsPersonalized && (
                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                  Personalized
                </span>
              )}
            </SideDrawerTitle>
            <SideDrawerDescription>
              {emailPreviewTemplateName || emailPreviewTemplateId}
              {emailPreviewIsPersonalized && emailPreviewUsername && (
                <span className="text-xs ml-2">
                  for <span className="font-medium">@{emailPreviewUsername}</span>
                </span>
              )}
            </SideDrawerDescription>
          </SideDrawerHeader>

          <SideDrawerBody>
            {/* Trigger Reason Box */}
            {emailPreviewTriggerReason && (
              <div className="mb-4 p-3 rounded-lg border bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <Icon name="Lightbulb" size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-amber-800 dark:text-amber-200">
                      Why this notification is triggered
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                      {emailPreviewTriggerReason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {emailPreviewLoading ? (
              <div className="flex items-center justify-center h-64">
                <Icon name="Loader" className="text-primary" />
              </div>
            ) : emailPreviewHtml ? (
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                <div className={`rounded-lg shadow-lg overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <iframe
                    srcDoc={isDarkMode
                      ? transformEmailForDarkMode(emailPreviewHtml)
                      : emailPreviewHtml
                    }
                    className="w-full h-[600px] border-0"
                    title="Email Preview"
                  />
                </div>
              </div>
            ) : emailPreviewError ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-destructive">
                  <Icon name="AlertCircle" size={20} />
                  <span className="font-medium">Failed to load email preview</span>
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-destructive">Error Details</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={async () => {
                        await navigator.clipboard.writeText(emailPreviewError);
                        toast({
                          title: 'Copied!',
                          description: 'Error details copied to clipboard',
                        });
                      }}
                    >
                      <Icon name="Copy" size={12} className="mr-1" />
                      Copy Error
                    </Button>
                  </div>
                  <pre className="text-xs text-muted-foreground overflow-auto max-h-[400px] whitespace-pre-wrap bg-muted/50 p-3 rounded">
                    {emailPreviewError}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="Mail" size={48} className="mx-auto mb-3 opacity-50" />
                <p>No preview available</p>
              </div>
            )}
          </SideDrawerBody>

          <SideDrawerFooter sticky>
            <div className="flex flex-col gap-3 w-full">
              {/* Send Now / Schedule buttons - only show if we have a specific user */}
              {emailPreviewUserId && emailPreviewTemplateId && (
                <div className="flex gap-2 w-full">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={cronActionLoading}
                    onClick={() => {
                      // Trigger for this specific user
                      triggerCronForUser(emailPreviewTemplateId, emailPreviewUserId);
                    }}
                    className="gap-1 flex-1"
                  >
                    {cronActionLoading ? (
                      <Icon name="Loader" size={14} className="animate-spin" />
                    ) : (
                      <Icon name="Send" size={14} />
                    )}
                    Send Now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cronActionLoading}
                    onClick={() => setShowScheduleInput(!showScheduleInput)}
                    className="gap-1"
                  >
                    <Icon name="Clock" size={14} />
                    Schedule
                  </Button>
                </div>
              )}

              {/* Schedule input */}
              {showScheduleInput && emailPreviewUserId && emailPreviewTemplateId && (
                <div className="flex gap-2 items-start w-full">
                  <div className="flex-1">
                    <Input
                      placeholder="e.g., 'in 20 minutes' or ISO date"
                      value={scheduleInputValue}
                      onChange={(e) => setScheduleInputValue(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={cronActionLoading || !scheduleInputValue.trim()}
                    onClick={() => triggerCronForUser(emailPreviewTemplateId!, emailPreviewUserId!, scheduleInputValue)}
                    className="gap-1"
                  >
                    {cronActionLoading ? (
                      <Icon name="Loader" size={14} className="animate-spin" />
                    ) : (
                      <Icon name="Send" size={14} />
                    )}
                    Schedule
                  </Button>
                </div>
              )}

              {/* Bottom row with template ID and view details */}
              <div className="flex items-center justify-between w-full">
                <p className="text-xs text-muted-foreground">
                  Template ID: <code className="bg-muted px-1 rounded">{emailPreviewTemplateId}</code>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEmailPreviewOpen(false);
                    setShowScheduleInput(false);
                    setScheduleInputValue('');
                    // Switch to Templates tab and select this template
                    setActiveTab('templates');
                    if (emailPreviewTemplateId) {
                      loadPreview(emailPreviewTemplateId);
                    }
                  }}
                >
                  <Icon name="ExternalLink" size={16} className="mr-2" />
                  View Full Details
                </Button>
              </div>
            </div>
          </SideDrawerFooter>
        </SideDrawerContent>
      </SideDrawer>

      {/* User Details Drawer - Using Shared Component */}
      <UserDetailsDrawer
        open={userDetailsOpen}
        onOpenChange={setUserDetailsOpen}
        userId={userDetailsUserId}
        username={userDetailsUsername}
        cronRecipients={cronRecipients}
        cronSchedules={cronSchedules}
        onEmailPreview={openEmailPreview}
        onUserClick={openUserDetails}
      />

      {/* Create Notification Drawer */}
      <SideDrawer
        open={createNotificationOpen}
        onOpenChange={(open) => {
          setCreateNotificationOpen(open);
          if (!open) {
            setCreateNotifUsername('');
            setCreateNotifTemplateId('');
            setCreateNotifScheduledAt('');
            setSelectedUserId(null);
            setUserSearchResults([]);
          }
        }}
        hashId="create-notification"
      >
        <SideDrawerContent side="right" size="md">
          <SideDrawerHeader sticky showClose>
            <SideDrawerTitle className="flex items-center gap-2">
              <Icon name="Plus" size={20} />
              New Notification
            </SideDrawerTitle>
            <SideDrawerDescription>
              Send a notification to a specific user
            </SideDrawerDescription>
          </SideDrawerHeader>

          <SideDrawerBody>
            <div className="space-y-4">
              {/* User Search */}
              <div>
                <label className="block text-sm font-medium mb-2">Recipient</label>
                {selectedUserId ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                    <Icon name="User" size={16} className="text-muted-foreground" />
                    <span className="font-medium">@{createNotifUsername}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7"
                      onClick={() => {
                        setSelectedUserId(null);
                        setCreateNotifUsername('');
                        setUserSearchResults([]);
                      }}
                    >
                      <Icon name="X" size={14} />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Search by username or email..."
                      value={createNotifUsername}
                      onChange={(e) => {
                        setCreateNotifUsername(e.target.value);
                        searchUsers(e.target.value);
                      }}
                      leftIcon={userSearchLoading ? <Icon name="Loader" size={16} className="animate-spin" /> : <Icon name="Search" size={16} />}
                    />
                    {userSearchResults.length > 0 && (
                      <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {userSearchResults.map((user) => (
                          <button
                            key={user.uid}
                            className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center gap-2 text-sm"
                            onClick={() => {
                              setSelectedUserId(user.uid);
                              setCreateNotifUsername(user.username || user.email);
                              setUserSearchResults([]);
                            }}
                          >
                            <Icon name="User" size={14} className="text-muted-foreground" />
                            <span className="font-medium">{user.username ? `@${user.username}` : user.email}</span>
                            {user.username && (
                              <span className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notification Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Notification Type</label>
                <select
                  value={createNotifTemplateId}
                  onChange={(e) => setCreateNotifTemplateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select notification type...</option>
                  <optgroup label="Email Verification">
                    <option value="verification-reminder">Email Verification Reminder</option>
                  </optgroup>
                  <optgroup label="Engagement">
                    <option value="choose-username">Choose Username Reminder</option>
                    <option value="first-page-activation">First Page Activation</option>
                    <option value="weekly-digest">Weekly Digest</option>
                    <option value="reactivation">Re-activation</option>
                  </optgroup>
                  <optgroup label="Payments">
                    <option value="payout-setup-reminder">Payout Setup Reminder</option>
                  </optgroup>
                </select>
              </div>

              {/* Schedule (optional) */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Schedule (optional)
                </label>
                <Input
                  placeholder="e.g., 'in 20 minutes', 'tomorrow at 3pm', or leave blank to send now"
                  value={createNotifScheduledAt}
                  onChange={(e) => setCreateNotifScheduledAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to send immediately
                </p>
              </div>
            </div>
          </SideDrawerBody>

          <SideDrawerFooter sticky>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCreateNotificationOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                className="flex-1 gap-1"
                disabled={createNotifLoading || !selectedUserId || !createNotifTemplateId}
                onClick={handleCreateNotification}
              >
                {createNotifLoading ? (
                  <Icon name="Loader" size={16} className="animate-spin" />
                ) : (
                  <Icon name="Send" size={16} />
                )}
                {createNotifScheduledAt ? 'Schedule' : 'Send Now'}
              </Button>
            </div>
          </SideDrawerFooter>
        </SideDrawerContent>
      </SideDrawer>

      {/* Template Details Drawer */}
      <SideDrawer
        open={templateDetailsOpen}
        onOpenChange={setTemplateDetailsOpen}
        hashId="template-details"
      >
        <SideDrawerContent side="right" size="xl">
          <SideDrawerHeader sticky showClose>
            <SideDrawerTitle className="flex items-center gap-2">
              <Icon name="Mail" size={20} />
              {templateDetailsId && getFlowItem(templateDetailsId)?.name || 'Template Details'}
            </SideDrawerTitle>
            <SideDrawerDescription>
              {templateDetailsId && getFlowItem(templateDetailsId)?.description}
            </SideDrawerDescription>
          </SideDrawerHeader>

          <SideDrawerBody>
            {templateDetailsLoading ? (
              <div className="flex items-center justify-center h-64">
                <Icon name="Loader" className="text-primary" />
              </div>
            ) : templateDetailsId ? (
              <div className="space-y-6">
                {/* Template Info */}
                {(() => {
                  const flowItem = getFlowItem(templateDetailsId);
                  const status = triggerStatus[templateDetailsId];
                  const modes = notificationModes[templateDetailsId] || { email: false, inApp: false, push: false };
                  const config = flowItem ? stageConfig[flowItem.stage] : null;

                  return (
                    <>
                      {/* Stage & Delivery Info */}
                      <div className="flex flex-wrap items-center gap-2">
                        {config && (
                          <Badge variant="outline" className={`${config.color} border-current`}>
                            <Icon name={config.icon as any} size={12} className="mr-1" />
                            {config.label}
                          </Badge>
                        )}
                        {modes.email && (
                          <Badge variant="secondary" className="gap-1">
                            <Icon name="Mail" size={12} className="text-blue-500" />
                            Email
                          </Badge>
                        )}
                        {modes.inApp && (
                          <Badge variant="secondary" className="gap-1">
                            <Icon name="Bell" size={12} className="text-orange-500" />
                            In-App
                          </Badge>
                        )}
                        {modes.push && (
                          <Badge variant="secondary" className="gap-1">
                            <Icon name="Smartphone" size={12} className="text-purple-500" />
                            Push
                          </Badge>
                        )}
                        {flowItem?.isAutomated && (
                          <Badge variant="secondary" className="gap-1">
                            <Icon name="Clock" size={12} className="text-blue-500" />
                            Automated
                          </Badge>
                        )}
                      </div>

                      {/* Trigger Status */}
                      {status && (
                        <div className={`p-3 rounded-lg border ${
                          status.status === 'active'
                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                            : status.status === 'partial'
                            ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                            : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                        }`}>
                          <div className="flex items-start gap-2">
                            {status.status === 'active' && (
                              <Icon name="CheckCircle2" size={18} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            )}
                            {status.status === 'partial' && (
                              <Icon name="AlertCircle" size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                            )}
                            {status.status === 'not-implemented' && (
                              <Icon name="XCircle" size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                              <p className={`font-medium text-sm ${
                                status.status === 'active'
                                  ? 'text-green-800 dark:text-green-200'
                                  : status.status === 'partial'
                                  ? 'text-yellow-800 dark:text-yellow-200'
                                  : 'text-red-800 dark:text-red-200'
                              }`}>
                                {status.status === 'active' && 'Trigger Active'}
                                {status.status === 'partial' && 'Partially Implemented'}
                                {status.status === 'not-implemented' && 'Not Yet Implemented'}
                              </p>
                              <p className={`text-xs mt-0.5 ${
                                status.status === 'active'
                                  ? 'text-green-700 dark:text-green-300'
                                  : status.status === 'partial'
                                  ? 'text-yellow-700 dark:text-yellow-300'
                                  : 'text-red-700 dark:text-red-300'
                              }`}>
                                {status.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Email Preview */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Icon name="Mail" size={18} className="text-muted-foreground" />
                            Email Preview
                          </h3>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setTemplateDetailsShowCode(!templateDetailsShowCode)}
                              className="gap-1 h-7"
                            >
                              <Icon name="Code" size={14} />
                              {templateDetailsShowCode ? 'Preview' : 'HTML'}
                            </Button>
                            {templateDetailsShowCode && templateDetailsHtml && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(templateDetailsHtml);
                                  toast({
                                    title: 'Copied!',
                                    description: 'HTML copied to clipboard',
                                  });
                                }}
                                className="gap-1 h-7"
                              >
                                <Icon name="Copy" size={14} />
                                Copy
                              </Button>
                            )}
                          </div>
                        </div>
                        {templateDetailsShowCode ? (
                          <pre className="p-4 overflow-auto max-h-[400px] text-xs bg-muted/30 rounded-lg border">
                            <code>{templateDetailsHtml}</code>
                          </pre>
                        ) : (
                          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                            <div className={`rounded-lg shadow-lg overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                              <iframe
                                srcDoc={isDarkMode && templateDetailsHtml
                                  ? transformEmailForDarkMode(templateDetailsHtml)
                                  : (templateDetailsHtml || '')
                                }
                                className="w-full h-[400px] border-0"
                                title="Email Preview"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* In-App Notification Preview */}
                      {!templateDetailsShowCode && (
                        <div>
                          <h3 className="font-semibold flex items-center gap-2 mb-3">
                            <Icon name="Bell" size={18} className="text-muted-foreground" />
                            In-App Notification Preview
                          </h3>
                          <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
                            <NotificationPreview templateId={templateDetailsId} />
                          </div>
                        </div>
                      )}

                      {/* Push Notification Preview */}
                      {!templateDetailsShowCode && (
                        <div>
                          <h3 className="font-semibold flex items-center gap-2 mb-3">
                            <Icon name="Smartphone" size={18} className="text-muted-foreground" />
                            Push Notification Preview
                          </h3>
                          <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
                            <PushNotificationPreview templateId={templateDetailsId} />
                          </div>
                        </div>
                      )}

                      {/* Send History */}
                      <div>
                        <button
                          onClick={() => setTemplateDetailsLogsOpen(!templateDetailsLogsOpen)}
                          className="w-full flex items-center justify-between py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Icon name="History" size={18} className="text-muted-foreground" />
                            <h3 className="font-semibold">Send History</h3>
                            <Badge variant="secondary">
                              {templateDetailsLogs.length}
                            </Badge>
                          </div>
                          {templateDetailsLogsOpen ? (
                            <Icon name="ChevronUp" size={18} className="text-muted-foreground" />
                          ) : (
                            <Icon name="ChevronDown" size={18} className="text-muted-foreground" />
                          )}
                        </button>

                        {templateDetailsLogsOpen && (
                          <div className="mt-2">
                            {templateDetailsLogs.length === 0 ? (
                              <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-lg">
                                <Icon name="Clock" size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No emails sent with this template yet</p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {templateDetailsLogs.map((log) => (
                                  <div
                                    key={log.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      {log.status === 'sent' || log.status === 'delivered' ? (
                                        <Icon name="CheckCircle2" size={16} className="text-green-500 flex-shrink-0" />
                                      ) : (
                                        <Icon name="XCircle" size={16} className="text-red-500 flex-shrink-0" />
                                      )}
                                      <div className="min-w-0">
                                        {log.recipientUsername ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openUserDetails(log.recipientUserId, log.recipientUsername);
                                            }}
                                            className="font-medium text-sm text-primary hover:underline truncate cursor-pointer"
                                          >
                                            @{log.recipientUsername}
                                          </button>
                                        ) : (
                                          <span className="font-medium text-sm truncate">
                                            {log.recipientEmail}
                                          </span>
                                        )}
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
                      <div className="bg-muted/30 rounded-lg p-4">
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <Icon name="FileCode" size={16} className="text-muted-foreground" />
                          Template Location
                        </h3>
                        <code className="text-sm bg-muted px-3 py-2 rounded block">
                          app/lib/emailTemplates.ts
                        </code>
                        <p className="text-xs text-muted-foreground mt-2">
                          Look for <code className="bg-muted px-1 rounded">{templateDetailsId}EmailTemplate</code>
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}
          </SideDrawerBody>

          <SideDrawerFooter sticky>
            <p className="text-xs text-muted-foreground">
              Template ID: <code className="bg-muted px-1 rounded">{templateDetailsId}</code>
            </p>
          </SideDrawerFooter>
        </SideDrawerContent>
      </SideDrawer>
    </div>
  );
}

export default function AdminEmailsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Icon name="Loader" className="text-muted-foreground" /></div>}>
      <AdminEmailsPageContent />
    </Suspense>
  );
}
