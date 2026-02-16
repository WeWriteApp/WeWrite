'use client';

import { EmailLogEntry } from '../types';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../../components/ui/badge';
import { UsernameBadge } from '../../../components/ui/UsernameBadge';

interface SentTabProps {
  allEmailLogs: EmailLogEntry[];
  allLogsLoading: boolean;
  onEmailPreview: (templateId: string, templateName: string, userId?: string, username?: string, triggerReason?: string, metadata?: Record<string, any>) => void;
  onUserDetails: (userId?: string, username?: string) => void;
  formatRelativeTime: (date: string | Date) => string;
}

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

const sourceConfig: Record<string, { icon: string; label: string; color: string }> = {
  cron: { icon: 'Clock', label: 'Cron', color: 'text-blue-500' },
  system: { icon: 'Zap', label: 'System', color: 'text-amber-500' },
  admin: { icon: 'Shield', label: 'Admin', color: 'text-purple-500' },
};

export function SentTab({
  allEmailLogs,
  allLogsLoading,
  onEmailPreview,
  onUserDetails,
  formatRelativeTime,
}: SentTabProps) {
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
            <Icon name="Loader" className="text-primary mr-2" />
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
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Source</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allEmailLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20">
                    {/* Status cell */}
                    <td className="px-3 py-2 text-left">
                      {(() => {
                        const tooltipParts: string[] = [`Status: ${log.status}`];
                        if (log.errorMessage) tooltipParts.push(`Error: ${log.errorMessage}`);
                        if (log.bounceReason) tooltipParts.push(`Bounce: ${log.bounceReason}`);
                        if (log.resendId) tooltipParts.push(`Resend ID: ${log.resendId}`);
                        if (log.metadata?.scheduledAt) tooltipParts.push(`Scheduled for: ${new Date(log.metadata.scheduledAt).toLocaleString()}`);
                        if (log.openedAt) tooltipParts.push(`Opened: ${new Date(log.openedAt).toLocaleString()}`);
                        if (log.clickedAt) tooltipParts.push(`Clicked: ${new Date(log.clickedAt).toLocaleString()}`);
                        if (log.lastWebhookEvent) tooltipParts.push(`Last event: ${log.lastWebhookEvent}`);
                        const tooltip = tooltipParts.join('\n');

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

                    {/* Template cell */}
                    <td className="px-3 py-2">
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 transition-colors"
                        onClick={() => onEmailPreview(log.templateId, log.templateName || log.templateId, log.recipientUserId, log.recipientUsername, undefined, log.metadata)}
                      >
                        <Icon name="Eye" size={12} className="text-primary" />
                        {log.templateName || log.templateId}
                      </button>
                    </td>

                    {/* Username cell */}
                    <td className="px-3 py-2">
                      {log.recipientUserId && log.recipientUsername ? (
                        <UsernameBadge
                          userId={log.recipientUserId}
                          username={log.recipientUsername}
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            onUserDetails(log.recipientUserId, log.recipientUsername);
                          }}
                        />
                      ) : log.recipientUsername ? (
                        <button
                          onClick={() => onUserDetails(log.recipientUserId, log.recipientUsername)}
                          className="text-primary hover:underline cursor-pointer text-sm"
                        >
                          @{log.recipientUsername}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Email cell */}
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px] hidden sm:table-cell">
                      {log.recipientEmail}
                    </td>

                    {/* Source cell */}
                    <td className="px-3 py-2 hidden md:table-cell">
                      {(() => {
                        const source = log.triggerSource;
                        const config = source ? sourceConfig[source] : null;

                        if (!config) {
                          return <span className="text-muted-foreground text-xs">—</span>;
                        }

                        return (
                          <span className={`inline-flex items-center gap-1 text-xs ${config.color}`}>
                            <Icon name={config.icon as any} size={12} />
                            {config.label}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Sent cell */}
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
}
