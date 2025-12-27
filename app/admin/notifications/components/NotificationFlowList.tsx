"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../../components/ui/badge';
import {
  getFlowByStage,
  stageConfig,
  type NotificationFlowItem,
} from '../config';
import { notificationModes, triggerStatus, templateToCronMap, formatTimeUntil } from '../config';
import type { CronSchedule, CronRecipientsState } from '../types';

interface NotificationFlowListProps {
  searchQuery: string;
  selectedTemplate: string | null;
  cronSchedules: CronSchedule[];
  cronRecipients: Record<string, CronRecipientsState>;
  onSelectTemplate: (templateId: string) => void;
}

/**
 * Renders the notification flow as a visual journey showing:
 * - Stages (Onboarding, Activation, Engagement, Monetization, Retention)
 * - Order within stages
 * - Requirements and blocking conditions
 * - Upcoming scheduled count for automated notifications
 */
export function NotificationFlowList({
  searchQuery,
  selectedTemplate,
  cronSchedules,
  cronRecipients,
  onSelectTemplate,
}: NotificationFlowListProps) {
  const flowByStage = getFlowByStage();
  const stages = ['onboarding', 'activation', 'engagement', 'monetization', 'retention'] as const;

  // Filter flow items by search
  const matchesSearch = (item: NotificationFlowItem): boolean => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query)
    );
  };

  // Format requirement for display
  const formatRequirement = (req: string): string => {
    const labels: Record<string, string> = {
      email_verified: 'Email verified',
      has_username: 'Has username',
      has_first_page: 'Has written a page',
      is_active: 'Active (last 30 days)',
      is_inactive: 'Inactive (30-90 days)',
      has_earnings: 'Has any earnings',
      has_pending_earnings: 'Has $25+ pending',
      has_payout_setup: 'Stripe connected',
      has_subscription: 'Has subscription',
    };
    return labels[req] || req;
  };

  return (
    <div className="space-y-6">
      {stages.map((stage) => {
        const items = flowByStage[stage].filter(matchesSearch);
        if (items.length === 0) return null;

        const config = stageConfig[stage];
        const IconComponent = Icon;

        return (
          <div key={stage} className="relative">
            {/* Stage Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-1.5 rounded-md bg-muted ${config.color}`}>
                <IconComponent name={config.icon as any} size={14} />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide">
                  {config.label}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {config.description}
                </p>
              </div>
            </div>

            {/* Flow Items with connecting line */}
            <div className="relative pl-4 border-l-2 border-border ml-2.5 space-y-1">
              {items.map((item, index) => {
                const status = triggerStatus[item.id];
                const modes = notificationModes[item.id] || { email: false, inApp: false, push: false };
                const cronId = item.cronId || templateToCronMap[item.id];
                const upcomingCount = cronId && cronRecipients[cronId]?.recipients?.length || 0;
                const cronData = cronId && cronSchedules.find(c => c.id === cronId);
                const isSelected = selectedTemplate === item.id;

                return (
                  <div key={item.id} className="relative">
                    {/* Connection dot */}
                    <div
                      className={`absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full border-2 ${
                        status?.status === 'active'
                          ? 'bg-green-500 border-green-500'
                          : status?.status === 'partial'
                          ? 'bg-yellow-500 border-yellow-500'
                          : status?.status === 'not-implemented'
                          ? 'bg-red-400 border-red-400'
                          : 'bg-gray-400 border-gray-400'
                      }`}
                    />

                    <button
                      onClick={() => onSelectTemplate(item.id)}
                      className={`w-full text-left p-2.5 rounded-lg transition-all ${
                        isSelected
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted/50 border border-transparent'
                      }`}
                    >
                      {/* Title row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs text-muted-foreground font-mono w-5">
                            {item.order}.
                          </span>
                          <span className={`text-sm truncate ${isSelected ? 'font-medium' : ''}`}>
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Upcoming badge */}
                          {upcomingCount > 0 && cronData && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 font-medium"
                              title={`${upcomingCount} scheduled for ${formatTimeUntil(cronData.nextRun)}`}
                            >
                              {upcomingCount}
                            </span>
                          )}
                          {/* Automated badge */}
                          {item.isAutomated && (
                            <span title="Automated (cron)">
                              <Icon name="Clock" size={11} className="text-blue-500" />
                            </span>
                          )}
                          {/* Mode icons */}
                          <Icon
                            name="Mail"
                            size={11}
                            className={modes.email ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}
                          />
                          <Icon
                            name="Bell"
                            size={11}
                            className={modes.inApp ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600'}
                          />
                          <Icon
                            name="Smartphone"
                            size={11}
                            className={modes.push ? 'text-purple-500' : 'text-gray-300 dark:text-gray-600'}
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-muted-foreground mt-1 ml-5 line-clamp-2">
                        {item.description}
                      </p>

                      {/* Requirements / Blocking conditions */}
                      {(item.requires?.length || item.blockedBy?.length) && (
                        <div className="flex flex-wrap gap-1 mt-2 ml-5">
                          {item.requires?.map((req) => (
                            <span
                              key={req}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 flex items-center gap-0.5"
                              title={`Requires: ${formatRequirement(req)}`}
                            >
                              <Icon name="Check" size={8} />
                              {formatRequirement(req)}
                            </span>
                          ))}
                          {item.blockedBy?.map((req) => (
                            <span
                              key={req}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-0.5"
                              title={`Blocked if: ${formatRequirement(req)}`}
                            >
                              <Icon name="Ban" size={8} />
                              {formatRequirement(req)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Trigger info */}
                      {item.triggerEvent && !item.isAutomated && (
                        <div className="flex items-center gap-1 mt-1.5 ml-5">
                          <Icon name="Zap" size={10} className="text-amber-500" />
                          <span className="text-[10px] text-muted-foreground">
                            Trigger: {item.triggerEvent}
                          </span>
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* No results */}
      {stages.every(stage => flowByStage[stage].filter(matchesSearch).length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          <Icon name="Mail" size={48} className="mx-auto mb-3 opacity-50" />
          <p>No templates found</p>
        </div>
      )}
    </div>
  );
}
