"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { Icon } from '@/components/ui/Icon';
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
import { adminFetch } from '../../utils/adminFetch';

// Import types from extracted module
import type { EmailTemplate, EmailLogEntry, GroupedTemplates, UserDetails, UserFinancialInfo, CronRecipientsState } from './types';

// Import config from extracted modules
import { notificationModes, triggerStatus, categoryConfig, getCronSchedules, formatTimeUntil } from './config';

// Import utility functions
import { splitEngagementTemplates, formatRelativeTime, formatUserDateTime } from './utils';

// Import extracted components
import { PushNotificationPreview, NotificationPreview } from './components';

// Get cron schedules (regenerates nextRun each time)
const cronSchedules = getCronSchedules();

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

  // User details drawer state
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserDetails | null>(null);
  const [adminToggleLoading, setAdminToggleLoading] = useState(false);
  const [verificationEmailLoading, setVerificationEmailLoading] = useState(false);

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

  // Load events data when Events tab is active
  useEffect(() => {
    const loadEventsData = async () => {
      if (activeTab !== 'events' || !user || authLoading) return;

      setAllLogsLoading(true);
      try {
        const logsRes = await adminFetch('/api/admin/email-logs?limit=100');
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

  // Load all cron recipients when Events tab is active
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

    if (activeTab === 'events' && user && !authLoading) {
      loadAllCronRecipients();
    }
  }, [activeTab, user, authLoading]);

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

  // Open email preview side drawer
  const openEmailPreview = async (templateId: string, templateName: string, userId?: string, username?: string) => {
    setEmailPreviewTemplateId(templateId);
    setEmailPreviewTemplateName(templateName);
    setEmailPreviewUserId(userId || null);
    setEmailPreviewUsername(username || null);
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
  const openUserDetails = async (userId?: string, username?: string) => {
    if (!userId && !username) return;

    setUserDetailsOpen(true);
    setUserDetailsLoading(true);
    setSelectedUserDetails(null);

    try {
      // Fetch all users with financial data and find the matching one
      const response = await adminFetch('/api/admin/users?includeFinancial=true&limit=300');
      const data = await response.json();

      if (data.users) {
        // Find user by uid or username
        const foundUser = data.users.find((u: UserDetails) =>
          (userId && u.uid === userId) || (username && u.username === username)
        );

        if (foundUser) {
          setSelectedUserDetails(foundUser);
        } else {
          toast({
            title: 'User not found',
            description: `Could not find user ${username || userId}`,
            variant: 'destructive',
          });
          setUserDetailsOpen(false);
        }
      }
    } catch (error) {
      console.error('Failed to load user details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user details',
        variant: 'destructive',
      });
      setUserDetailsOpen(false);
    } finally {
      setUserDetailsLoading(false);
    }
  };

  // Toggle admin status for a user
  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    if (!selectedUserDetails) return;

    setAdminToggleLoading(true);
    try {
      const response = await adminFetch('/api/admin/set-admin-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: userId,
          isAdmin: !currentIsAdmin,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state to reflect the change
        setSelectedUserDetails({
          ...selectedUserDetails,
          isAdmin: !currentIsAdmin,
        });
        toast({
          title: 'Admin status updated',
          description: `${selectedUserDetails.username || selectedUserDetails.email} is ${!currentIsAdmin ? 'now an admin' : 'no longer an admin'}`,
        });
      } else {
        toast({
          title: 'Failed to update admin status',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to toggle admin status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update admin status',
        variant: 'destructive',
      });
    } finally {
      setAdminToggleLoading(false);
    }
  };

  // Send verification email to a user
  const handleSendVerificationEmail = async (userId: string, email: string, username?: string) => {
    setVerificationEmailLoading(true);
    try {
      const response = await adminFetch('/api/email/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email,
          username,
          idToken: 'admin-bypass',
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Verification email sent',
          description: `Sent to ${email}`,
        });
      } else {
        toast({
          title: 'Failed to send verification email',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to send verification email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send verification email',
        variant: 'destructive',
      });
    } finally {
      setVerificationEmailLoading(false);
    }
  };

  // Helper function to format date/time
  const formatUserDateTime = (dateValue: any): string => {
    if (!dateValue) return '—';
    try {
      const date = dateValue?.toDate?.() ||
        (dateValue?._seconds ? new Date(dateValue._seconds * 1000) : new Date(dateValue));
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  // Render subscription badge
  const renderSubscription = (financial?: UserFinancialInfo) => {
    if (!financial?.hasSubscription) {
      return <Badge variant="outline-static">No subscription</Badge>;
    }
    const status = financial.subscriptionStatus || 'active';
    if (status === 'active') {
      return <Badge variant="success-secondary">Active</Badge>;
    }
    if (status === 'canceled') {
      return <Badge variant="destructive-secondary">Canceled</Badge>;
    }
    return <Badge variant="outline-static">{status}</Badge>;
  };

  // Render payout badge
  const renderPayout = (financial?: UserFinancialInfo, stripeId?: string | null) => {
    if (financial?.payoutsSetup || stripeId) {
      return <Badge variant="success-secondary">Connected</Badge>;
    }
    return <Badge variant="outline-static">Not connected</Badge>;
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

  // Render Events tab content
  const renderEventsTab = () => {
    // Separate email-sending crons from system (backend) jobs
    const emailCrons = cronSchedules.filter(c => !c.isSystemJob);
    const systemCrons = cronSchedules.filter(c => c.isSystemJob);

    // Sort email crons by next run time
    const sortedEmailCrons = [...emailCrons].sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());
    const sortedSystemCrons = [...systemCrons].sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());

    // Build a flat list of all upcoming notifications with their scheduled time
    // Only include email-sending crons (not system jobs)
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

      // Sort by next run time (soonest first)
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
            <h3 className="text-sm font-semibold">Upcoming Scheduled Notifications</h3>
            {!isLoadingRecipients && (
              <Badge variant="secondary" className="text-xs">
                {upcomingNotifications.length}
              </Badge>
            )}
          </div>

          {isLoadingRecipients ? (
            <div className="flex items-center justify-center py-8">
              <Icon name="Loader" className="text-primary mr-2" />
              <span className="text-sm text-muted-foreground">Loading upcoming notifications...</span>
            </div>
          ) : upcomingNotifications.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Icon name="Calendar" size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming notifications found</p>
            </div>
          ) : (
            <div className="wewrite-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Username</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Scheduled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {upcomingNotifications.slice(0, 50).map((notif, idx) => (
                    <tr key={`${notif.cronId}-${notif.recipient.userId || notif.recipient.email}-${idx}`} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <Badge
                          variant="secondary"
                          className="text-xs py-0 cursor-pointer hover:bg-primary/20 transition-colors"
                          onClick={() => openEmailPreview(notif.cronId, notif.cronName, notif.recipient.userId, notif.recipient.username)}
                        >
                          <Icon name="Eye" size={12} className="mr-1" />
                          {notif.cronName}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {notif.recipient.username ? (
                          <button
                            onClick={() => openUserDetails(notif.recipient.userId, notif.recipient.username)}
                            className="text-primary hover:underline cursor-pointer"
                          >
                            @{notif.recipient.username}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">
                        {notif.recipient.email}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                        {formatTimeUntil(notif.nextRun)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {upcomingNotifications.length > 50 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border bg-muted/20">
                  +{upcomingNotifications.length - 50} more notifications
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Notification Events */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="History" size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">Recent Notification Events</h3>
            <Badge variant="secondary" className="text-xs">
              {allEmailLogs.length}
            </Badge>
          </div>

          {allEmailLogs.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Icon name="Mail" size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notification events found</p>
            </div>
          ) : (
            <div className="wewrite-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Username</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border max-h-[500px] overflow-y-auto">
                  {allEmailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {log.status === 'sent' || log.status === 'delivered' ? (
                            <Icon name="CheckCircle2" size={24} className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                          ) : (
                            <Icon name="XCircle" size={24} className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                          )}
                          <Badge
                            variant="secondary"
                            className="text-xs py-0 cursor-pointer hover:bg-primary/20 transition-colors"
                            onClick={() => openEmailPreview(log.templateId, log.templateName || log.templateId, log.recipientUserId, log.recipientUsername)}
                          >
                            <Icon name="Eye" size={12} className="mr-1" />
                            {log.templateName || log.templateId}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {log.recipientUsername ? (
                          <button
                            onClick={() => openUserDetails(log.recipientUserId, log.recipientUsername)}
                            className="text-primary hover:underline cursor-pointer"
                          >
                            @{log.recipientUsername}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">
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
              <Icon name="ArrowLeft" size={16} className="mr-1" />
              Back to Admin
            </button>
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
          <div className="flex items-center gap-2">
            <a
              href="https://resend.com/emails"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="ExternalLink" size={16} />
              Resend Dashboard
            </a>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.push('/')}>
              <Icon name="X" size={20} />
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
            <Icon name="Mail" size={16} className="inline-block mr-2" />
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
            <Icon name="History" size={16} className="inline-block mr-2" />
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
                leftIcon={<Icon name="Search" size={16} />}
              />

              {/* Template Categories */}
              <div className="space-y-6">
                {grouped && Object.entries(categoryConfig).map(([category, config]) => {
                  // Skip the old engagement category - we now use engagementActive and engagementInactive
                  if (category === 'engagement') return null;

                  const categoryTemplates = (grouped as any)[category] || [];
                  const filteredCategoryTemplates = categoryTemplates.filter((t: EmailTemplate) =>
                    filteredTemplates.some(ft => ft.id === t.id)
                  );

                  if (filteredCategoryTemplates.length === 0) return null;

                  const CategoryIcon = config.icon;

                  return (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                        <CategoryIcon className="h-4 w-4" />
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
                                      <Icon name="CheckCircle2" size={24} className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                    )}
                                    {status?.status === 'partial' && (
                                      <Icon name="AlertCircle" size={24} className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                                    )}
                                    {status?.status === 'not-implemented' && (
                                      <Icon name="XCircle" size={24} className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                                    )}
                                    {status?.status === 'disabled' && (
                                      <Icon name="XCircle" size={24} className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {template.subject}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Icon name="Mail" size={14} className={`${modes.email ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}`} />
                                  <Icon name="Bell" size={14} className={`${modes.inApp ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600'}`} />
                                  <Icon name="Smartphone" size={14} className={`${modes.push ? 'text-purple-500' : 'text-gray-300 dark:text-gray-600'}`} />
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
                  <Icon name="Mail" size={48} className="mx-auto mb-3 opacity-50" />
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
                              <Icon name="Mail" size={12} className="text-blue-500" />
                              Email
                            </Badge>
                          )}
                          {notificationModes[selectedTemplate]?.inApp && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Icon name="Bell" size={12} className="text-orange-500" />
                              In-App
                            </Badge>
                          )}
                          {notificationModes[selectedTemplate]?.push && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Icon name="Smartphone" size={12} className="text-purple-500" />
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
                          <Icon name="Code" size={16} />
                          {showCode ? 'Preview' : 'HTML'}
                        </Button>
                        {showCode && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyHtml}
                            className="gap-1"
                          >
                            {copied ? <Icon name="Check" size={16} /> : <Icon name="Copy" size={16} />}
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
                            <Icon name="CheckCircle2" size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          )}
                          {selectedTriggerStatus.status === 'partial' && (
                            <Icon name="AlertCircle" size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                          )}
                          {selectedTriggerStatus.status === 'not-implemented' && (
                            <Icon name="XCircle" size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
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
                        <Icon name="Mail" size={20} className="text-muted-foreground" />
                        Email Preview
                      </h3>
                    </div>
                    {previewLoading ? (
                      <div className="flex items-center justify-center h-96">
                        <Icon name="Loader" className="text-primary" />
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
                          <Icon name="Bell" size={20} className="text-muted-foreground" />
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
                          <Icon name="Smartphone" size={20} className="text-muted-foreground" />
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
                        <Icon name="History" size={20} className="text-muted-foreground" />
                        <h3 className="font-semibold">Send History</h3>
                        <Badge variant="secondary" className="ml-2">
                          {emailLogs.length} {emailLogs.length === 1 ? 'email' : 'emails'}
                        </Badge>
                      </div>
                      {showLogs ? (
                        <Icon name="ChevronUp" size={20} className="text-muted-foreground" />
                      ) : (
                        <Icon name="ChevronDown" size={20} className="text-muted-foreground" />
                      )}
                    </button>
                    
                    {showLogs && (
                      <div className="mt-4">
                        {emailLogs.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <Icon name="Clock" size={32} className="mx-auto mb-2 opacity-50" />
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
                                    <Icon name="CheckCircle2" size={16} className="text-green-500 flex-shrink-0" />
                                  ) : (
                                    <Icon name="XCircle" size={16} className="text-red-500 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      {log.recipientUsername ? (
                                        <button
                                          onClick={() => openUserDetails(log.recipientUserId, log.recipientUsername)}
                                          className="font-medium text-sm text-primary hover:underline truncate cursor-pointer"
                                        >
                                          @{log.recipientUsername}
                                        </button>
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
                  <Icon name="Mail" size={64} className="text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Template</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Choose an email template from the list to preview its design and see the send history.
                  </p>
                  
                  {/* Legends */}
                  <div className="mt-6 space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground">Status Indicators</div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <Icon name="CheckCircle2" size={24} className="h-3.5 w-3.5 text-green-500" />
                        <span>Active</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="AlertCircle" size={24} className="h-3.5 w-3.5 text-yellow-500" />
                        <span>Partial</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="XCircle" size={24} className="h-3.5 w-3.5 text-red-400" />
                        <span>Not Implemented</span>
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-muted-foreground mt-4">Notification Modes</div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <Icon name="Mail" size={24} className="h-3.5 w-3.5 text-blue-500" />
                        <span>Email</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="Bell" size={24} className="h-3.5 w-3.5 text-orange-500" />
                        <span>In-App</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="Smartphone" size={24} className="h-3.5 w-3.5 text-purple-500" />
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
              <Icon name="Settings" size={20} className="text-primary" />
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
            {emailPreviewLoading ? (
              <div className="flex items-center justify-center h-64">
                <Icon name="Loader" className="text-primary" />
              </div>
            ) : emailPreviewHtml ? (
              <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                  <iframe
                    srcDoc={emailPreviewHtml}
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
            <div className="flex items-center justify-between w-full">
              <p className="text-xs text-muted-foreground">
                Template ID: <code className="bg-muted px-1 rounded">{emailPreviewTemplateId}</code>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmailPreviewOpen(false);
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
          </SideDrawerFooter>
        </SideDrawerContent>
      </SideDrawer>

      {/* User Details Drawer */}
      <SideDrawer open={userDetailsOpen} onOpenChange={(open) => !open && setUserDetailsOpen(false)}>
        <SideDrawerContent side="right" size="xl">
          <SideDrawerHeader>
            <SideDrawerTitle>User details</SideDrawerTitle>
            <SideDrawerDescription>
              View subscription, payout, and account metadata for {selectedUserDetails?.email || 'user'}.
            </SideDrawerDescription>
          </SideDrawerHeader>
          <SideDrawerBody>
            {userDetailsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader" className="text-muted-foreground" />
              </div>
            ) : selectedUserDetails ? (
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 grid-cols-2">
                  <div>
                    <div className="text-muted-foreground">Email</div>
                    <div className="font-medium break-all">{selectedUserDetails.email}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Username</div>
                    <div className="font-medium">{selectedUserDetails.username || '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Admin</div>
                    <div className="flex items-center gap-2">
                      {selectedUserDetails.isAdmin ? (
                        <Badge variant="success-secondary">Admin</Badge>
                      ) : (
                        <Badge variant="outline-static">Not admin</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handleToggleAdmin(selectedUserDetails.uid, selectedUserDetails.isAdmin || false)}
                        disabled={adminToggleLoading}
                      >
                        {adminToggleLoading ? (
                          <Icon name="Loader" />
                        ) : selectedUserDetails.isAdmin ? (
                          'Revoke'
                        ) : (
                          'Grant'
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Email verified</div>
                    <div className="flex items-center gap-2">
                      {selectedUserDetails.emailVerified ? (
                        <Badge variant="success-secondary">Verified</Badge>
                      ) : (
                        <>
                          <Badge variant="destructive-secondary">Unverified</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleSendVerificationEmail(
                              selectedUserDetails.uid,
                              selectedUserDetails.email,
                              selectedUserDetails.username
                            )}
                            disabled={verificationEmailLoading}
                          >
                            {verificationEmailLoading ? (
                              <Icon name="Loader" />
                            ) : (
                              <>
                                <Icon name="Mail" size={12} className="mr-1" />
                                Send
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Created</div>
                    <div className="font-medium">{formatUserDateTime(selectedUserDetails.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last login</div>
                    <div className="font-medium">{formatUserDateTime(selectedUserDetails.lastLogin)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total pages</div>
                    <div className="font-medium">{selectedUserDetails.totalPages ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Stripe account</div>
                    <div className="font-medium break-all text-xs">{selectedUserDetails.stripeConnectedAccountId || '—'}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="CreditCard" size={16} className="text-blue-400" />
                    <span className="font-medium">Subscription</span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {renderSubscription(selectedUserDetails.financial)}
                    {selectedUserDetails.financial?.subscriptionAmount ? (
                      <span className="text-muted-foreground text-xs">
                        ${selectedUserDetails.financial.subscriptionAmount.toFixed(2)} / mo
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Banknote" size={16} className="text-emerald-400" />
                    <span className="font-medium">Payouts</span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {renderPayout(selectedUserDetails.financial, selectedUserDetails.stripeConnectedAccountId)}
                    <span className="text-muted-foreground text-xs">
                      Available: {selectedUserDetails.financial?.availableEarningsUsd !== undefined
                        ? `$${selectedUserDetails.financial.availableEarningsUsd.toFixed(2)}`
                        : '—'}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Total: {selectedUserDetails.financial?.earningsTotalUsd !== undefined
                        ? `$${selectedUserDetails.financial.earningsTotalUsd.toFixed(2)}`
                        : '—'}
                    </span>
                  </div>
                </div>

                {selectedUserDetails.referredBy && (
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="Users" size={16} className="text-purple-400" />
                      <span className="font-medium">Referral</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Referred by: </span>
                      {selectedUserDetails.referredByUsername ? (
                        <button
                          onClick={() => openUserDetails(selectedUserDetails.referredBy, selectedUserDetails.referredByUsername)}
                          className="text-primary hover:underline"
                        >
                          @{selectedUserDetails.referredByUsername}
                        </button>
                      ) : (
                        <span className="font-mono text-xs">{selectedUserDetails.referredBy}</span>
                      )}
                      {selectedUserDetails.referralSource && (
                        <span className="text-muted-foreground ml-2">
                          via {selectedUserDetails.referralSource}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="User" size={48} className="mx-auto mb-3 opacity-50" />
                <p>No user selected</p>
              </div>
            )}
          </SideDrawerBody>
          <SideDrawerFooter>
            <div className="flex items-center justify-between w-full gap-2">
              <Button variant="outline" onClick={() => setUserDetailsOpen(false)}>
                Close
              </Button>
              {selectedUserDetails?.username && (
                <Button
                  variant="secondary"
                  onClick={() => window.open(`/u/${selectedUserDetails.username}`, '_blank')}
                >
                  <Icon name="ExternalLink" size={16} className="mr-2" />
                  View Public Profile
                </Button>
              )}
            </div>
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
