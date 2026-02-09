"use client";

import React from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock, DocsNote } from './shared';
import { cn } from '../../lib/utils';

// Mock notification data for design system demos
const MOCK_NOTIFICATIONS = {
  link: {
    type: 'link',
    sourceUsername: 'jamie',
    sourceUserId: 'mock-user-1',
    targetPageTitle: 'Nick Land',
    sourcePageTitle: 'Competition',
    createdAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
    read: false,
  },
  follow: {
    type: 'follow',
    sourceUsername: 'FRANTZ',
    sourceUserId: 'mock-user-2',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    read: false,
  },
  append: {
    type: 'append',
    sourceUsername: 'writer123',
    sourceUserId: 'mock-user-3',
    sourcePageTitle: 'My New Essay',
    targetPageTitle: 'Philosophy Notes',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
  payment_failed: {
    type: 'payment_failed',
    title: 'Payment Failed',
    message: 'Your subscription payment of $9.99 failed.',
    metadata: { amount: 9.99, failureCount: 1 },
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    read: false,
  },
  allocation_threshold: {
    type: 'allocation_threshold',
    title: '90% of monthly funds allocated',
    message: "You've allocated $9.00 of $10.00. Top off your account or adjust allocations.",
    metadata: { percentage: 90, allocatedUsdCents: 900, totalUsdCents: 1000 },
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    read: false,
  },
  payout_completed: {
    type: 'payout_completed',
    title: 'Payout Completed',
    message: 'Your payout of $25.00 has been deposited to your bank account.',
    metadata: { amountCents: 2500, completedAt: new Date().toISOString() },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
  system_announcement: {
    type: 'system_announcement',
    title: 'New Feature: Groups',
    message: 'Collaborate with others using our new Groups feature. Create a group to start sharing.',
    metadata: { actionUrl: '/groups', actionLabel: 'Try Groups' },
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    read: false,
  },
  email_verification: {
    type: 'email_verification',
    title: 'Verify your email address',
    message: 'Please verify your email to access all features and ensure your account is secure.',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    read: false,
  },
};

// Notification type icon mapping (same as NotificationItem)
function getNotificationTypeIcon(type: string): { icon: IconName; color: string } {
  switch (type) {
    case 'follow':
      return { icon: 'UserPlus', color: 'text-blue-500' };
    case 'link':
      return { icon: 'Link', color: 'text-purple-500' };
    case 'append':
      return { icon: 'FileText', color: 'text-green-500' };
    case 'email_verification':
      return { icon: 'Mail', color: 'text-orange-500' };
    case 'allocation_threshold':
      return { icon: 'Percent', color: 'text-amber-500' };
    case 'payment_failed':
    case 'payment_failed_warning':
    case 'payment_failed_final':
      return { icon: 'CreditCard', color: 'text-red-500' };
    case 'payout_completed':
      return { icon: 'CheckCircle', color: 'text-green-500' };
    case 'payout_failed':
      return { icon: 'AlertTriangle', color: 'text-red-500' };
    case 'system_announcement':
      return { icon: 'Megaphone', color: 'text-primary' };
    default:
      return { icon: 'Bell', color: 'text-muted-foreground' };
  }
}

// Demo notification card component for design system
function DemoNotificationCard({
  notification,
  showAnatomy = false
}: {
  notification: any;
  showAnatomy?: boolean;
}) {
  const isUnread = !notification.read;
  const { icon, color } = getNotificationTypeIcon(notification.type);

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  // Render content based on notification type
  const renderContent = () => {
    switch (notification.type) {
      case 'link':
        return (
          <>
            <span className="font-medium text-primary">{notification.sourceUsername}</span>
            <span className="text-foreground"> linked to your page </span>
            <span className="font-medium">{notification.targetPageTitle}</span>
            {notification.sourcePageTitle && (
              <span className="text-foreground"> from <span className="font-medium">{notification.sourcePageTitle}</span></span>
            )}
          </>
        );
      case 'follow':
        return (
          <>
            <span className="font-medium text-primary">{notification.sourceUsername}</span>
            <span className="text-foreground"> started following you</span>
          </>
        );
      case 'append':
        return (
          <>
            <span className="font-medium text-primary">{notification.sourceUsername}</span>
            <span className="text-foreground"> added your page </span>
            <span className="font-medium">{notification.sourcePageTitle}</span>
            <span className="text-foreground"> to </span>
            <span className="font-medium">{notification.targetPageTitle}</span>
          </>
        );
      case 'payment_failed':
        return (
          <>
            <span className="font-medium text-foreground">{notification.title}</span>
            <br />
            <span className="text-muted-foreground text-xs">{notification.message}</span>
          </>
        );
      case 'allocation_threshold':
        return (
          <>
            <span className="font-medium text-foreground">{notification.title}</span>
            <br />
            <span className="text-muted-foreground text-xs">{notification.message}</span>
          </>
        );
      case 'payout_completed':
        return (
          <>
            <span className="font-medium text-green-600 dark:text-green-500">{notification.title}</span>
            <br />
            <span className="text-muted-foreground text-xs">{notification.message}</span>
          </>
        );
      case 'system_announcement':
        return (
          <>
            <span className="font-medium text-primary">{notification.title}</span>
            <br />
            <span className="text-muted-foreground text-xs">{notification.message}</span>
          </>
        );
      case 'email_verification':
        return (
          <>
            <span className="font-medium text-foreground">{notification.title}</span>
            <br />
            <span className="text-muted-foreground text-xs">{notification.message}</span>
          </>
        );
      default:
        return <span className="text-foreground">Unknown notification type</span>;
    }
  };

  return (
    <div
      className={cn(
        "wewrite-card cursor-pointer group transition-all",
        isUnread && "ring-2 ring-primary/20"
      )}
    >
      <div className="flex gap-3">
        {/* Icon with unread indicator */}
        <div className="flex-shrink-0 relative">
          {showAnatomy && (
            <span className="absolute -top-2 -left-1 text-[8px] bg-blue-500 text-white px-1 rounded">Icon</span>
          )}
          <Icon name={icon} size={20} className={cn(color, !isUnread && 'opacity-50')} />
          {isUnread && (
            <div
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background"
              style={{ backgroundColor: '#1768FF' }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {showAnatomy && (
            <span className="absolute -top-2 left-10 text-[8px] bg-green-500 text-white px-1 rounded">Content</span>
          )}
          <p className="text-sm leading-relaxed">
            {renderContent()}
          </p>
        </div>

        {/* Timestamp and menu */}
        <div className="flex-shrink-0 flex items-start gap-2">
          {showAnatomy && (
            <span className="absolute -top-2 right-8 text-[8px] bg-purple-500 text-white px-1 rounded">Time</span>
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(notification.createdAt)}
          </span>
          <button className="p-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity">
            <Icon name="MoreVertical" size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationCardSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Notification Card"
      path="app/components/utils/NotificationItem.tsx"
      description="Displays various types of notifications with read/unread states, type icons, and action buttons."
    >
      {/* Card Anatomy */}
      <StateDemo label="Card Anatomy">
        <div className="w-full max-w-lg">
          <div className="wewrite-card p-3 relative">
            {/* Anatomy labels */}
            <div className="flex gap-3 items-start">
              <div className="p-2 border border-dashed border-blue-500/50 rounded relative">
                <span className="absolute -top-2 left-1 text-[8px] bg-background text-blue-500 px-1 font-medium">Type Icon</span>
                <div className="relative">
                  <Icon name="Link" size={20} className="text-purple-500" />
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border border-background" />
                </div>
              </div>

              <div className="flex-1 p-2 border border-dashed border-green-500/50 rounded relative">
                <span className="absolute -top-2 left-1 text-[8px] bg-background text-green-500 px-1 font-medium">Content Area</span>
                <p className="text-sm">
                  <span className="font-medium text-primary">username</span>
                  <span> linked to your page </span>
                  <span className="font-medium">Page Title</span>
                </p>
              </div>

              <div className="flex gap-2 items-start">
                <div className="p-2 border border-dashed border-purple-500/50 rounded relative">
                  <span className="absolute -top-2 left-1 text-[8px] bg-background text-purple-500 px-1 font-medium">Timestamp</span>
                  <span className="text-xs text-muted-foreground">13 days ago</span>
                </div>
                <div className="p-2 border border-dashed border-amber-500/50 rounded relative">
                  <span className="absolute -top-2 left-1 text-[8px] bg-background text-amber-500 px-1 font-medium">Menu</span>
                  <Icon name="MoreVertical" size={16} className="text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Read States */}
      <StateDemo label="Read States">
        <div className="w-full space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Unread (ring + full opacity icon + dot)</p>
            <div className="max-w-lg">
              <DemoNotificationCard notification={{ ...MOCK_NOTIFICATIONS.link, read: false }} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Read (no ring + faded icon + no dot)</p>
            <div className="max-w-lg">
              <DemoNotificationCard notification={{ ...MOCK_NOTIFICATIONS.link, read: true }} />
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Notification Types */}
      <StateDemo label="Notification Types">
        <div className="w-full space-y-3">
          {/* Social notifications */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Social</p>
            <div className="space-y-2 max-w-lg">
              <DemoNotificationCard notification={MOCK_NOTIFICATIONS.link} />
              <DemoNotificationCard notification={MOCK_NOTIFICATIONS.follow} />
              <DemoNotificationCard notification={MOCK_NOTIFICATIONS.append} />
            </div>
          </div>

          {/* Payment notifications */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Payments & Billing</p>
            <div className="space-y-2 max-w-lg">
              <DemoNotificationCard notification={MOCK_NOTIFICATIONS.payment_failed} />
              <DemoNotificationCard notification={MOCK_NOTIFICATIONS.allocation_threshold} />
              <DemoNotificationCard notification={MOCK_NOTIFICATIONS.payout_completed} />
            </div>
          </div>

          {/* System notifications */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">System</p>
            <div className="space-y-2 max-w-lg">
              <DemoNotificationCard notification={MOCK_NOTIFICATIONS.system_announcement} />
              <DemoNotificationCard notification={MOCK_NOTIFICATIONS.email_verification} />
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Type Icons Reference */}
      <StateDemo label="Type Icons Reference">
        <div className="flex flex-wrap gap-4">
          {[
            { type: 'follow', label: 'Follow' },
            { type: 'link', label: 'Link' },
            { type: 'append', label: 'Append' },
            { type: 'email_verification', label: 'Email' },
            { type: 'allocation_threshold', label: 'Allocation' },
            { type: 'payment_failed', label: 'Payment' },
            { type: 'payout_completed', label: 'Payout Success' },
            { type: 'payout_failed', label: 'Payout Failed' },
            { type: 'system_announcement', label: 'System' },
          ].map(({ type, label }) => {
            const { icon, color } = getNotificationTypeIcon(type);
            return (
              <div key={type} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
                <Icon name={icon} size={16} className={color} />
                <span className="text-xs">{label}</span>
              </div>
            );
          })}
        </div>
      </StateDemo>

      <CollapsibleDocs type="notes" title="Design Guidelines">
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>
            <strong className="text-foreground">Unread indicator:</strong> Blue dot on icon + ring around card + full opacity icon. All three elements reinforce unread state.
          </li>
          <li>
            <strong className="text-foreground">Read state:</strong> No ring, faded icon (50% opacity), no dot. Subtle but clearly different from unread.
          </li>
          <li>
            <strong className="text-foreground">Icon colors:</strong> Each notification type has a distinct color for quick scanning. Colors match semantic meaning (green = positive, red = error, etc).
          </li>
          <li>
            <strong className="text-foreground">Content hierarchy:</strong> Username/title is emphasized with font-weight or color. Supporting text uses muted-foreground.
          </li>
          <li>
            <strong className="text-foreground">Menu button:</strong> Hidden by default, appears on hover (desktop) or always visible (mobile).
          </li>
        </ul>
      </CollapsibleDocs>

      <CollapsibleDocs type="usage">
        <DocsCodeBlock label="Basic Usage">
{`<NotificationItem
  notification={{
    id: "notif-123",
    type: "link",
    sourceUserId: "user-456",
    targetPageTitle: "My Page",
    sourcePageTitle: "Their Page",
    createdAt: "2024-01-15T10:30:00Z",
    read: false,
  }}
/>`}
        </DocsCodeBlock>

        <DocsNote variant="info" title="Notification Types">
          Supported types: follow, link, append, email_verification, allocation_threshold,
          payment_failed, payment_failed_warning, payment_failed_final, payout_initiated,
          payout_processing, payout_completed, payout_failed, system_announcement
        </DocsNote>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
