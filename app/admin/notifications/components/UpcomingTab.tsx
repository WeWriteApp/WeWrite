import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../../components/ui/badge';
import { UsernameBadge } from '../../../components/ui/UsernameBadge';

interface UpcomingTabProps {
  quotaLoading: boolean;
  quotaData: {
    today: { totalSent: number; remaining: number; percentUsed: number; byPriority: Record<number, number> };
    thisMonth: { totalSent: number; remaining: number; percentUsed: number };
    limits: { DAILY: number; MONTHLY: number };
    scheduledBatches: Array<{ scheduledFor: string; count: number; templateBreakdown: Record<string, number> }>;
    priorityLabels: Record<number, string>;
  } | null;
  cronSchedules: Array<{ id: string; name: string; description: string; schedule: string; nextRun: Date; isSystemJob?: boolean }>;
  cronRecipients: Record<string, { loading: boolean; recipients: any[] }>;
  upcomingNotificationsLimit: number;
  setUpcomingNotificationsLimit: React.Dispatch<React.SetStateAction<number>>;
  expandedBatches: Set<string>;
  setExpandedBatches: React.Dispatch<React.SetStateAction<Set<string>>>;
  onRefreshRecipients: () => Promise<void>;
  onEmailPreview: (templateId: string, templateName: string, userId?: string, username?: string, triggerReason?: string) => void;
  onUserDetails: (userId?: string, username?: string) => void;
  formatTimeUntil: (date: Date) => string;
}

export function UpcomingTab({
  quotaLoading,
  quotaData,
  cronSchedules,
  cronRecipients,
  upcomingNotificationsLimit,
  setUpcomingNotificationsLimit,
  expandedBatches,
  setExpandedBatches,
  onRefreshRecipients,
  onEmailPreview,
  onUserDetails,
  formatTimeUntil,
}: UpcomingTabProps) {
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

  // Toggle batch expansion
  const toggleBatch = (batchDate: string) => {
    setExpandedBatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(batchDate)) {
        newSet.delete(batchDate);
      } else {
        newSet.add(batchDate);
      }
      return newSet;
    });
  };

  // Format date for display
  const formatBatchDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const upcomingNotifications = buildUpcomingNotificationsList();
  const isLoadingRecipients = sortedEmailCrons.some(cron => cronRecipients[cron.id]?.loading);

  return (
    <div className="space-y-6">
      {/* Email Quota Status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Gauge" size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">Email Quota Status</h3>
          <Badge variant="outline" className="text-xs">
            Resend Free Tier
          </Badge>
        </div>

        {quotaLoading ? (
          <div className="flex items-center justify-center py-4">
            <Icon name="Loader" className="text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Loading quota data...</span>
          </div>
        ) : quotaData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily Usage */}
            <div className="wewrite-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Daily Usage</span>
                <span className={`text-xs font-medium ${quotaData.today.percentUsed >= 90 ? 'text-red-500' : quotaData.today.percentUsed >= 70 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {quotaData.today.totalSent} / {quotaData.limits.DAILY}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all ${quotaData.today.percentUsed >= 90 ? 'bg-red-500' : quotaData.today.percentUsed >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(quotaData.today.percentUsed, 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {quotaData.today.remaining} remaining today
              </div>
            </div>

            {/* Monthly Usage */}
            <div className="wewrite-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Monthly Usage</span>
                <span className={`text-xs font-medium ${quotaData.thisMonth.percentUsed >= 90 ? 'text-red-500' : quotaData.thisMonth.percentUsed >= 70 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {quotaData.thisMonth.totalSent} / {quotaData.limits.MONTHLY}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all ${quotaData.thisMonth.percentUsed >= 90 ? 'bg-red-500' : quotaData.thisMonth.percentUsed >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(quotaData.thisMonth.percentUsed, 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {quotaData.thisMonth.remaining} remaining this month
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Unable to load quota data
          </div>
        )}
      </div>

      {/* Scheduled Batches (emails scheduled for future via Resend) */}
      {quotaData && quotaData.scheduledBatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Layers" size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">Scheduled Email Batches</h3>
            <Badge variant="secondary" className="text-xs">
              {quotaData.scheduledBatches.reduce((sum, b) => sum + b.count, 0)} emails
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Emails scheduled via Resend for future delivery (to stay under daily limits).
          </p>

          <div className="wewrite-card p-0 overflow-hidden">
            {quotaData.scheduledBatches.map((batch) => {
              const isExpanded = expandedBatches.has(batch.scheduledFor);
              const templateEntries = Object.entries(batch.templateBreakdown);

              return (
                <div key={batch.scheduledFor} className="border-b border-border last:border-b-0">
                  <button
                    onClick={() => toggleBatch(batch.scheduledFor)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        name={isExpanded ? 'ChevronDown' : 'ChevronRight'}
                        size={16}
                        className="text-muted-foreground"
                      />
                      <div className="text-left">
                        <div className="font-medium text-sm">{formatBatchDate(batch.scheduledFor)}</div>
                        <div className="text-xs text-muted-foreground">{batch.scheduledFor}</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {batch.count} {batch.count === 1 ? 'email' : 'emails'}
                    </Badge>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 bg-muted/10">
                      <div className="space-y-1">
                        {templateEntries.map(([templateId, count]) => (
                          <div
                            key={templateId}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/20"
                          >
                            <span className="text-muted-foreground">{templateId}</span>
                            <Badge variant="outline" className="text-xs">
                              {count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Scheduled Notifications (from cron recipients) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Calendar" size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">Upcoming Cron Recipients</h3>
          {!isLoadingRecipients && (
            <Badge variant="secondary" className="text-xs">
              {upcomingNotifications.length}
            </Badge>
          )}
          <button
            onClick={onRefreshRecipients}
            disabled={isLoadingRecipients}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Refresh upcoming notifications"
          >
            <Icon name="RefreshCw" size={14} className={isLoadingRecipients ? 'animate-spin' : ''} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Users who will receive emails when cron jobs next run.
        </p>

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
                        onClick={() => onEmailPreview(notif.cronId, notif.cronName, notif.recipient.userId, notif.recipient.username, notif.recipient.reason)}
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
                            onUserDetails(notif.recipient.userId, notif.recipient.username);
                          }}
                        />
                      ) : notif.recipient.username ? (
                        <button
                          onClick={() => onUserDetails(notif.recipient.userId, notif.recipient.username)}
                          className="text-primary hover:underline cursor-pointer text-sm"
                        >
                          @{notif.recipient.username}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px] hidden sm:table-cell">
                      {notif.recipient.email}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs max-w-[200px]">
                      {notif.recipient.reason || '--'}
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
}
