'use client';

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { UsernameBadge } from '../../../components/ui/UsernameBadge';
import type { NotificationFlowItem } from '../config/notificationFlow';

interface TemplatesTabProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  cronSchedules: Array<{ id: string; name: string; description: string; schedule: string; nextRun: Date; isSystemJob?: boolean }>;
  cronRecipients: Record<string, { loading: boolean; recipients: any[] }>;
  expandedTemplateUpcoming: string | null;
  setExpandedTemplateUpcoming: (id: string | null) => void;
  expandedTemplateLimit: Record<string, number>;
  setExpandedTemplateLimit: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  showBulkReschedule: boolean;
  setShowBulkReschedule: (v: boolean) => void;
  bulkRescheduleInput: string;
  setBulkRescheduleInput: (v: string) => void;
  bulkActionLoading: boolean;
  setBulkActionLoading: (v: boolean) => void;
  setCronRecipients: React.Dispatch<React.SetStateAction<Record<string, { loading: boolean; recipients: any[] }>>>;
  onTemplateDetails: (templateId: string) => void;
  onEmailPreview: (templateId: string, templateName: string, userId?: string, username?: string, triggerReason?: string) => void;
  onUserDetails: (userId?: string, username?: string) => void;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  toast: any;
  // Config access
  getUserFacingFlow: () => NotificationFlowItem[];
  triggerStatus: Record<string, any>;
  notificationModes: Record<string, any>;
  templateToCronMap: Record<string, string>;
  stageConfig: Record<string, any>;
  formatTimeUntil: (date: Date) => string;
}

/**
 * Templates tab content for the admin notifications page.
 *
 * Renders a dense table showing all notification templates ordered by user journey,
 * with inline expansion for upcoming recipients and bulk action controls.
 */
export function TemplatesTab({
  searchQuery,
  setSearchQuery,
  cronSchedules,
  cronRecipients,
  expandedTemplateUpcoming,
  setExpandedTemplateUpcoming,
  expandedTemplateLimit,
  setExpandedTemplateLimit,
  showBulkReschedule,
  setShowBulkReschedule,
  bulkRescheduleInput,
  setBulkRescheduleInput,
  bulkActionLoading,
  setBulkActionLoading,
  setCronRecipients,
  onTemplateDetails,
  onEmailPreview,
  onUserDetails,
  adminFetch,
  toast,
  getUserFacingFlow,
  triggerStatus,
  notificationModes,
  templateToCronMap,
  stageConfig,
  formatTimeUntil,
}: TemplatesTabProps) {
  const flowItems = getUserFacingFlow();

  const filteredItems = flowItems.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-3 md:space-y-4">
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
            {filteredItems.map((item) => {
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
                    onClick={() => onTemplateDetails(item.id)}
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
                                          <Icon name="Loader" size={12} />
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
                                          <Icon name="Loader" size={12} />
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
                                                onUserDetails(recipient.userId, recipient.username);
                                              }}
                                            />
                                          ) : recipient.username ? (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onUserDetails(recipient.userId, recipient.username);
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
                                              onEmailPreview(item.id, item.name, recipient.userId, recipient.username, recipient.reason);
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
        {filteredItems.length === 0 && (
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
  );
}
