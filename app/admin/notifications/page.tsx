"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { isAdmin } from '../../utils/isAdmin';
import { useToast } from '../../components/ui/use-toast';
import { useAdminData } from '../../providers/AdminDataProvider';
import { UserDetailsDrawer } from '../../components/admin/UserDetailsDrawer';
import { useTheme } from '../../providers/ThemeProvider';

// Import types from extracted module
import type { EmailTemplate, EmailLogEntry, GroupedTemplates } from './types';

// Import config from extracted modules
import { notificationModes, triggerStatus, getCronSchedules, formatTimeUntil, templateToCronMap, getUserFacingFlow, stageConfig, getFlowItem } from './config';

// Import utility functions
import { splitEngagementTemplates, formatRelativeTime, transformEmailForDarkMode } from './utils';

// Import extracted components
import {
  TemplatesTab,
  UpcomingTab,
  SentTab,
  EmailPreviewDrawer,
  CreateNotificationDrawer,
  TemplateDetailsDrawer,
} from './components';

// Get cron schedules (regenerates nextRun each time)
const cronSchedules = getCronSchedules();

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

  // Sent emails state
  const [allEmailLogs, setAllEmailLogs] = useState<EmailLogEntry[]>([]);
  const [allLogsLoading, setAllLogsLoading] = useState(false);

  // Cron recipients state
  const [cronRecipients, setCronRecipients] = useState<Record<string, { loading: boolean; recipients: any[] }>>({});

  // Email preview drawer state
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

  // User details drawer state
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [userDetailsUserId, setUserDetailsUserId] = useState<string | null>(null);
  const [userDetailsUsername, setUserDetailsUsername] = useState<string | null>(null);

  // Cron scheduling control state
  const [cronActionLoading, setCronActionLoading] = useState(false);
  const [scheduleInputValue, setScheduleInputValue] = useState('');
  const [showScheduleInput, setShowScheduleInput] = useState(false);

  // Create notification drawer state
  const [createNotificationOpen, setCreateNotificationOpen] = useState(false);
  const [createNotifUsername, setCreateNotifUsername] = useState('');
  const [createNotifTemplateId, setCreateNotifTemplateId] = useState('');
  const [createNotifScheduledAt, setCreateNotifScheduledAt] = useState('');
  const [createNotifLoading, setCreateNotifLoading] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<Array<{ uid: string; username: string; email: string }>>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Upcoming tab state
  const [upcomingNotificationsLimit, setUpcomingNotificationsLimit] = useState(50);
  const [expandedTemplateUpcoming, setExpandedTemplateUpcoming] = useState<string | null>(null);
  const [expandedTemplateLimit, setExpandedTemplateLimit] = useState<Record<string, number>>({});
  const [bulkRescheduleInput, setBulkRescheduleInput] = useState<string>('');
  const [showBulkReschedule, setShowBulkReschedule] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Quota state
  const [quotaData, setQuotaData] = useState<{
    today: { totalSent: number; remaining: number; percentUsed: number; byPriority: Record<number, number> };
    thisMonth: { totalSent: number; remaining: number; percentUsed: number };
    limits: { DAILY: number; MONTHLY: number };
    scheduledBatches: Array<{ scheduledFor: string; count: number; templateBreakdown: Record<string, number> }>;
    priorityLabels: Record<number, string>;
  } | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  // Template details drawer state
  const [templateDetailsOpen, setTemplateDetailsOpen] = useState(false);
  const [templateDetailsId, setTemplateDetailsId] = useState<string | null>(null);
  const [templateDetailsHtml, setTemplateDetailsHtml] = useState<string | null>(null);
  const [templateDetailsLoading, setTemplateDetailsLoading] = useState(false);
  const [templateDetailsLogs, setTemplateDetailsLogs] = useState<EmailLogEntry[]>([]);
  const [templateDetailsShowCode, setTemplateDetailsShowCode] = useState(false);
  const [templateDetailsLogsOpen, setTemplateDetailsLogsOpen] = useState(false);

  // Check admin access
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

  // Load email quota data when Upcoming tab is active
  useEffect(() => {
    const loadQuotaData = async () => {
      if (activeTab !== 'upcoming' || !user || authLoading) return;

      setQuotaLoading(true);
      try {
        const res = await adminFetch('/api/admin/email-quota');
        const data = await res.json();

        if (data.success) {
          setQuotaData(data);
        }
      } catch (error) {
        console.error('Failed to load email quota:', error);
      } finally {
        setQuotaLoading(false);
      }
    };

    loadQuotaData();
  }, [activeTab, user, authLoading]);

  // Load all cron recipients (skip system jobs)
  useEffect(() => {
    const loadAllCronRecipients = async () => {
      for (const cron of cronSchedules) {
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

  // Refresh all cron recipients
  const refreshAllCronRecipients = async () => {
    const loadingState: Record<string, { loading: boolean; recipients: any[] }> = {};
    for (const cron of cronSchedules) {
      if (!cron.isSystemJob) {
        loadingState[cron.id] = { loading: true, recipients: [] };
      }
    }
    setCronRecipients(loadingState);

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
      let url = `/api/admin/email-templates?id=${templateId}&html=true`;
      if (userId) {
        url += `&userId=${userId}`;
      }
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

  // Loading / access denied states
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

  return (
    <div className="min-h-screen bg-background">
      <div className="py-3 md:py-6 px-2 md:px-4 container mx-auto max-w-7xl">
        {/* Desktop Header */}
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
        <div className="flex gap-1 mb-4 md:mb-6 border-b border-border overflow-x-auto mobile-scroll-hide">
          {(['templates', 'upcoming', 'sent'] as const).map(tab => {
            const icons = { templates: 'Mail', upcoming: 'Calendar', sent: 'Send' } as const;
            const labels = { templates: 'Templates', upcoming: 'Upcoming', sent: 'Sent' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 md:px-4 py-2.5 md:py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={icons[tab]} size={16} className="inline-block mr-2" />
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'templates' && (
          <TemplatesTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            cronSchedules={cronSchedules}
            cronRecipients={cronRecipients}
            expandedTemplateUpcoming={expandedTemplateUpcoming}
            setExpandedTemplateUpcoming={setExpandedTemplateUpcoming}
            expandedTemplateLimit={expandedTemplateLimit}
            setExpandedTemplateLimit={setExpandedTemplateLimit}
            showBulkReschedule={showBulkReschedule}
            setShowBulkReschedule={setShowBulkReschedule}
            bulkRescheduleInput={bulkRescheduleInput}
            setBulkRescheduleInput={setBulkRescheduleInput}
            bulkActionLoading={bulkActionLoading}
            setBulkActionLoading={setBulkActionLoading}
            setCronRecipients={setCronRecipients}
            onTemplateDetails={openTemplateDetails}
            onEmailPreview={openEmailPreview}
            onUserDetails={openUserDetails}
            adminFetch={adminFetch}
            toast={toast}
            getUserFacingFlow={getUserFacingFlow}
            triggerStatus={triggerStatus}
            notificationModes={notificationModes}
            templateToCronMap={templateToCronMap}
            stageConfig={stageConfig}
            formatTimeUntil={formatTimeUntil}
          />
        )}

        {activeTab === 'upcoming' && (
          <UpcomingTab
            quotaLoading={quotaLoading}
            quotaData={quotaData}
            cronSchedules={cronSchedules}
            cronRecipients={cronRecipients}
            upcomingNotificationsLimit={upcomingNotificationsLimit}
            setUpcomingNotificationsLimit={setUpcomingNotificationsLimit}
            expandedBatches={expandedBatches}
            setExpandedBatches={setExpandedBatches}
            onRefreshRecipients={refreshAllCronRecipients}
            onEmailPreview={openEmailPreview}
            onUserDetails={openUserDetails}
            formatTimeUntil={formatTimeUntil}
          />
        )}

        {activeTab === 'sent' && (
          <SentTab
            allEmailLogs={allEmailLogs}
            allLogsLoading={allLogsLoading}
            onEmailPreview={openEmailPreview}
            onUserDetails={openUserDetails}
            formatRelativeTime={formatRelativeTime}
          />
        )}
      </div>

      {/* Email Preview Drawer */}
      <EmailPreviewDrawer
        open={emailPreviewOpen}
        onOpenChange={setEmailPreviewOpen}
        templateId={emailPreviewTemplateId}
        templateName={emailPreviewTemplateName}
        html={emailPreviewHtml}
        loading={emailPreviewLoading}
        isPersonalized={emailPreviewIsPersonalized}
        error={emailPreviewError}
        triggerReason={emailPreviewTriggerReason}
        userId={emailPreviewUserId}
        username={emailPreviewUsername}
        isDarkMode={isDarkMode}
        cronActionLoading={cronActionLoading}
        showScheduleInput={showScheduleInput}
        setShowScheduleInput={setShowScheduleInput}
        scheduleInputValue={scheduleInputValue}
        setScheduleInputValue={setScheduleInputValue}
        onTriggerCronForUser={triggerCronForUser}
        onViewFullDetails={() => {
          setEmailPreviewOpen(false);
          setShowScheduleInput(false);
          setScheduleInputValue('');
          setActiveTab('templates');
          if (emailPreviewTemplateId) {
            openTemplateDetails(emailPreviewTemplateId);
          }
        }}
        transformEmailForDarkMode={transformEmailForDarkMode}
        toast={toast}
      />

      {/* Create Notification Drawer */}
      <CreateNotificationDrawer
        open={createNotificationOpen}
        onOpenChange={setCreateNotificationOpen}
        createNotifUsername={createNotifUsername}
        setCreateNotifUsername={setCreateNotifUsername}
        createNotifTemplateId={createNotifTemplateId}
        setCreateNotifTemplateId={setCreateNotifTemplateId}
        createNotifScheduledAt={createNotifScheduledAt}
        setCreateNotifScheduledAt={setCreateNotifScheduledAt}
        createNotifLoading={createNotifLoading}
        selectedUserId={selectedUserId}
        setSelectedUserId={setSelectedUserId}
        userSearchResults={userSearchResults}
        setUserSearchResults={setUserSearchResults}
        userSearchLoading={userSearchLoading}
        onSearchUsers={searchUsers}
        onCreateNotification={handleCreateNotification}
      />

      {/* Template Details Drawer */}
      <TemplateDetailsDrawer
        open={templateDetailsOpen}
        onOpenChange={setTemplateDetailsOpen}
        templateId={templateDetailsId}
        html={templateDetailsHtml}
        loading={templateDetailsLoading}
        logs={templateDetailsLogs}
        showCode={templateDetailsShowCode}
        setShowCode={setTemplateDetailsShowCode}
        logsOpen={templateDetailsLogsOpen}
        setLogsOpen={setTemplateDetailsLogsOpen}
        isDarkMode={isDarkMode}
        transformEmailForDarkMode={transformEmailForDarkMode}
        onUserDetails={openUserDetails}
        toast={toast}
        getFlowItem={getFlowItem}
        triggerStatus={triggerStatus}
        notificationModes={notificationModes}
        stageConfig={stageConfig}
        formatRelativeTime={formatRelativeTime}
      />

      {/* User Details Drawer */}
      <UserDetailsDrawer
        open={userDetailsOpen}
        onOpenChange={(open) => {
          setUserDetailsOpen(open);
          if (!open) {
            setUserDetailsUserId(null);
            setUserDetailsUsername(null);
          }
        }}
        userId={userDetailsUserId || undefined}
        username={userDetailsUsername || undefined}
      />
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
