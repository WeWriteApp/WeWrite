"use client";

import { useState, useRef, useEffect } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';
import { useNotifications } from '../../providers/NotificationProvider';
import UserBadge from './UserBadge';
import { Button } from '../ui/button';
import { InlineError } from '../ui/InlineError';
import { dismissEmailVerificationNotifications } from '../../services/emailVerificationNotifications';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { updateNotificationCriticality, type NotificationCriticality } from '../../services/notificationsService';
import { auth } from '../../firebase/config';
import { useAuth } from '../../providers/AuthProvider';

/**
 * Get icon and color for each notification type
 */
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
    case 'group_invite':
      return { icon: 'Users', color: 'text-indigo-500' };
    case 'payout_initiated':
      return { icon: 'Send', color: 'text-blue-500' };
    case 'payout_processing':
      return { icon: 'Clock', color: 'text-amber-500' };
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

/**
 * NotificationItem Component
 *
 * Displays a single notification
 *
 * @param {Object} props
 * @param {Object} props.notification - The notification object
 */
export default function NotificationItem({ notification }) {
  const router = useRouter();
  const { markAsRead, markAsUnread } = useNotifications();
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [menuPosition, setMenuPosition] = useState('right-0');
  const menuRef = useRef(null);
  const { trackNotificationInteraction } = useWeWriteAnalytics();

  // Check if notification.read is actually unread
  const isUnread = notification.read === false || notification.read === 'false' || !notification.read;

  // Detect mobile screen size
  useEffect(() => {
    // Guard against server-side rendering
    if (typeof window === 'undefined') return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    // Guard against server-side rendering
    if (typeof document === 'undefined') return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClick = async () => {
    try {
      // Mark the notification as read if it's not already read
      if (!notification.read) {
        await markAsRead(notification.id);
      }
    } catch (error) {
      console.error(`Failed to mark notification as read:`, error);
      // Continue with navigation even if marking as read fails
    }

    // Navigate to the appropriate page
    if (notification.type === 'follow' && notification.targetPageId) {
      router.push(`/${notification.targetPageId}`);
    } else if (notification.type === 'link') {
      // Navigate to the source page (the page that contains the link), not the target page
      const sourcePageId = notification.metadata?.sourcePageId || notification.sourcePageId;
      if (sourcePageId) {
        router.push(`/${sourcePageId}`);
      }
    } else if (notification.type === 'append') {
      // For append notifications, navigate to the source page
      if (notification.sourcePageId) {
        router.push(`/${notification.sourcePageId}`);
      }
    } else if (notification.type === 'email_verification') {
      // For email verification notifications, navigate to settings
      router.push('/settings');
    } else if (notification.type === 'payment_failed' || notification.type === 'payment_failed_warning' || notification.type === 'payment_failed_final') {
      // For payment failure notifications, navigate to subscription settings
      router.push('/settings#subscription');
    } else if (notification.type === 'group_invite') {
      // For group invitations, navigate to the group page
      if (notification.groupId) {
        router.push(`/group/${notification.groupId}`);
      }
    } else if (notification.type === 'payout_initiated' || notification.type === 'payout_processing' || notification.type === 'payout_completed' || notification.type === 'payout_failed') {
      // For payout notifications, navigate to earnings page
      router.push('/settings/earnings');
    } else if (notification.type === 'allocation_threshold') {
      // For allocation threshold notifications, navigate to fund account page
      router.push('/settings/fund-account');
    } else if (notification.type === 'system_announcement') {
      // For system announcements, navigate to the action URL if provided
      if (notification.metadata?.actionUrl?.startsWith('/')) {
        router.push(notification.metadata.actionUrl);
      } else if (notification.metadata?.actionUrl) {
        window.open(notification.metadata.actionUrl, '_blank');
      }
    }
  };

  const handleMarkAsRead = async (e) => {
    e.stopPropagation();
    try {
      await markAsRead(notification.id);
      trackNotificationInteraction('read', notification.id, {
        notification_type: notification.type,
        source_user_id: notification.sourceUserId,
        target_page_id: notification.targetPageId
      });
      setShowMenu(false);
    } catch (error) {
      console.error(`Failed to mark notification as read:`, error);
    }
  };

  const handleMarkAsUnread = async (e) => {
    e.stopPropagation();
    try {
      await markAsUnread(notification.id);
      trackNotificationInteraction('unread', notification.id, {
        notification_type: notification.type,
        source_user_id: notification.sourceUserId,
        target_page_id: notification.targetPageId
      });
      setShowMenu(false);
    } catch (error) {
      console.error(`Failed to mark notification as unread:`, error);
    }
  };

  const handleCriticalityChange = async (e, newCriticality: NotificationCriticality) => {
    e.stopPropagation();
    e.preventDefault();
    setShowMenu(false);

    try {
      await updateNotificationCriticality(notification.id, newCriticality);
      trackNotificationInteraction('criticality_change', notification.type, {
        new_criticality: newCriticality,
        old_criticality: notification.criticality || 'normal'
      });

      // Refresh notifications to show updated criticality
      // The NotificationProvider will handle the state update
    } catch (error) {
      console.error('Error updating notification criticality:', error);
    }
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!showMenu) {
      trackNotificationInteraction('menu_opened', notification.id, {
        notification_type: notification.type,
        is_unread: isUnread
      });

      // Calculate menu position based on available space
      if (menuRef.current && typeof window !== 'undefined') {
        const buttonRect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const menuWidth = 180; // min-w-[180px]

        // Check if there's enough space on the right side
        const spaceOnRight = viewportWidth - buttonRect.right;

        if (spaceOnRight < menuWidth) {
          // Not enough space on right, position menu to the left
          setMenuPosition('right-0');
        } else {
          // Enough space on right, use default right alignment
          setMenuPosition('right-0');
        }
      }
    }
    setShowMenu(!showMenu);
  };

  // Format the notification message based on type
  const renderNotificationContent = () => {
    switch (notification.type) {
      case 'follow':
        return (
          <div className="flex-1 min-w-0">
            <div className="flex items-center mb-1">
              <UserBadge uid={notification.sourceUserId} showUsername={true} />
            </div>
            <p className="text-sm text-foreground">
              started following you
            </p>
          </div>
        );

      case 'link':
        return (
          <div className="flex-1 min-w-0">
            <div className="flex items-center mb-1">
              <UserBadge uid={notification.sourceUserId} showUsername={true} />
            </div>
            <p className="text-sm text-foreground">
              linked to your page{' '}
              <span className="font-medium">
                {notification.targetPageTitle || 'Untitled Page'}
              </span>
              {notification.sourcePageTitle && (
                <>
                  {' '}from{' '}
                  <span className="font-medium">
                    {notification.sourcePageTitle}
                  </span>
                </>
              )}
            </p>
          </div>
        );

      case 'append':
        return (
          <div className="flex-1 min-w-0">
            <div className="flex items-center mb-1">
              <UserBadge uid={notification.sourceUserId} showUsername={true} />
            </div>
            <p className="text-sm text-foreground">
              added your page{' '}
              <span className="font-medium">
                {notification.sourcePageTitle || 'Untitled Page'}
              </span>
              {' '}to{' '}
              <span className="font-medium">
                {notification.targetPageTitle || 'their page'}
              </span>
            </p>
          </div>
        );

      case 'email_verification':
        return (
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium mb-1">
              Verify your email address
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              Please verify your email to access all features and ensure your account is secure.
            </p>
            {!notification.read && (
              <div className="flex gap-2">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    try {
                      if (auth?.currentUser && user) {
                        const idToken = await auth.currentUser.getIdToken(true);
                        const response = await fetch('/api/email/send-verification', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: user.email,
                            userId: user.uid,
                            username: user.username,
                            idToken,
                          }),
                        });
                        if (response.ok) {
                          console.log('Verification email sent via Resend');
                        } else {
                          console.error('Failed to send verification email');
                        }
                      } else {
                        console.warn('No authenticated user to send verification email');
                      }
                    } catch (error) {
                      console.error('Error sending verification email:', error);
                    }
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  <Icon name="RefreshCw" size={12} className="mr-1" />
                  Resend Email
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    router.push('/settings');
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs border border-border rounded hover:bg-muted transition-colors"
                >
                  Go to Settings
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    try {
                      // Dismiss future email verification notifications
                      dismissEmailVerificationNotifications();
                      // Mark this notification as read
                      await markAsRead(notification.id);
                      console.log('Email verification notifications dismissed');
                    } catch (error) {
                      console.error('Error dismissing email verification notifications:', error);
                    }
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name="X" size={12} className="mr-1" />
                  Dismiss
                </button>
              </div>
            )}
          </div>
        );

      /**
       * Group Invitation Notification Component
       *
       * Displays group invitation notifications with interactive accept/reject buttons.
       * This replaces the previous direct member addition system with a consent-based
       * invitation flow that requires user approval.
       *
       * Features:
       * - Shows inviting user's information via UserBadge
       * - Displays group name prominently
       * - Two action buttons: "Join Group" (accept) and "Ignore Invite" (reject)
       * - Prevents event bubbling to avoid triggering parent click handlers
       * - Automatic navigation to group page on acceptance
       * - Uses WeWrite's standardized card styling and responsive design
       *
       * Database Operations:
       * - Accept: Adds user to group members in RTDB and marks notification as read
       * - Reject: Simply marks notification as read to remove from UI
       *
       * Error Handling:
       * - Graceful error handling with console logging
       * - Continues operation even if individual actions fail
       */
      case 'group_invite':
        // Groups functionality removed - group invitations no longer supported
        return null;

      case 'allocation_threshold':
        const percentage = notification.metadata?.percentage || 90;
        const allocatedFormatted = notification.metadata?.allocatedUsdCents
          ? `$${(notification.metadata.allocatedUsdCents / 100).toFixed(2)}`
          : '';
        const totalFormatted = notification.metadata?.totalUsdCents
          ? `$${(notification.metadata.totalUsdCents / 100).toFixed(2)}`
          : '';

        return (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-1 text-foreground">
              {notification.title || `${percentage}% of monthly funds allocated`}
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              {notification.message || `You've allocated ${allocatedFormatted} of ${totalFormatted}. Top off your account or adjust allocations to keep supporting pages.`}
            </p>
            {allocatedFormatted && totalFormatted && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <span>Allocated: {allocatedFormatted}</span>
                <span>Total: {totalFormatted}</span>
                <span>Used: {percentage}%</span>
              </div>
            )}
            {!notification.read && (
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    router.push('/settings/fund-account');
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-sm rounded-md transition-colors font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Top off Account
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    router.push('/settings/spend');
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
                >
                  Manage Allocations
                </button>
              </div>
            )}
          </div>
        );

      case 'payment_failed':
      case 'payment_failed_warning':
      case 'payment_failed_final':
        const amount = notification.metadata?.amount || 0;
        const failureCount = notification.metadata?.failureCount || 1;
        const isUrgent = notification.type === 'payment_failed_final';

        return (
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium mb-1 ${isUrgent ? 'text-destructive' : 'text-foreground'}`}>
              {notification.title || 'Payment Failed'}
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              {notification.message || `Your subscription payment of $${amount.toFixed(2)} failed.`}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
              <span>Amount: ${amount.toFixed(2)}</span>
              <span>Attempts: {failureCount}</span>
              {notification.metadata?.dueDate && (
                <span>Due: {new Date(notification.metadata.dueDate).toLocaleDateString()}</span>
              )}
            </div>
            {!notification.read && (
              <div className="flex gap-2">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    try {
                      const response = await fetch('/api/subscription/retry-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }});
                      const data = await response.json();
                      if (response.ok && data.success) {
                        // Mark notification as read on success
                        await markAsRead(notification.id);
                        console.log('Payment retry successful');
                      } else {
                        console.error('Payment retry failed:', data.error);
                      }
                    } catch (error) {
                      console.error('Error retrying payment:', error);
                    }
                  }}
                  className={`inline-flex items-center px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                    isUrgent
                      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  <Icon name="RefreshCw" size={12} className="mr-1" />
                  Retry Payment
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    router.push('/settings#subscription');
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
                >
                  Update Payment
                </button>
              </div>
            )}
            {isUrgent && (
              <InlineError
                variant="inline"
                size="sm"
                severity="warning"
                message="Your subscription may be cancelled if payment continues to fail."
                className="mt-2"
              />
            )}
          </div>
        );

      case 'payout_initiated':
        return (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-1 text-foreground">
              {notification.title || 'Payout Initiated'}
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              {notification.message || `Your payout of $${((notification.metadata?.amountCents || 0) / 100).toFixed(2)} has been initiated and is being processed.`}
            </p>
            {notification.metadata?.amountCents && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                <span>Amount: ${(notification.metadata.amountCents / 100).toFixed(2)}</span>
                {notification.metadata?.expectedArrival && (
                  <span>Expected: {new Date(notification.metadata.expectedArrival).toLocaleDateString()}</span>
                )}
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                router.push('/settings/earnings');
              }}
              className="inline-flex items-center px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              View Earnings
            </button>
          </div>
        );

      case 'payout_processing':
        return (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-1 text-foreground">
              {notification.title || 'Payout Processing'}
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              {notification.message || `Your payout of $${((notification.metadata?.amountCents || 0) / 100).toFixed(2)} is being processed by your bank.`}
            </p>
            {notification.metadata?.amountCents && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                <span>Amount: ${(notification.metadata.amountCents / 100).toFixed(2)}</span>
                {notification.metadata?.expectedArrival && (
                  <span>Expected: {new Date(notification.metadata.expectedArrival).toLocaleDateString()}</span>
                )}
              </div>
            )}
          </div>
        );

      case 'payout_completed':
        return (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-1 text-green-600 dark:text-green-500">
              {notification.title || 'Payout Completed'}
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              {notification.message || `Your payout of $${((notification.metadata?.amountCents || 0) / 100).toFixed(2)} has been deposited to your bank account.`}
            </p>
            {notification.metadata?.amountCents && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                <span>Amount: ${(notification.metadata.amountCents / 100).toFixed(2)}</span>
                {notification.metadata?.completedAt && (
                  <span>Completed: {new Date(notification.metadata.completedAt).toLocaleDateString()}</span>
                )}
              </div>
            )}
          </div>
        );

      case 'payout_failed':
        return (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-1 text-destructive">
              {notification.title || 'Payout Failed'}
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              {notification.message || `Your payout of $${((notification.metadata?.amountCents || 0) / 100).toFixed(2)} failed. Please check your bank account details.`}
            </p>
            {notification.metadata?.amountCents && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                <span>Amount: ${(notification.metadata.amountCents / 100).toFixed(2)}</span>
                {notification.metadata?.failureReason && (
                  <span>Reason: {notification.metadata.failureReason}</span>
                )}
              </div>
            )}
            {!notification.read && (
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    router.push('/settings/earnings');
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-sm rounded-md transition-colors font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Update Bank Details
                </button>
              </div>
            )}
          </div>
        );

      case 'system_announcement':
        return (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-1 text-primary">
              {notification.title || 'Announcement'}
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              {notification.message || 'New platform update available.'}
            </p>
            {notification.metadata?.actionUrl && !notification.read && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (notification.metadata?.actionUrl?.startsWith('/')) {
                    router.push(notification.metadata.actionUrl);
                  } else if (notification.metadata?.actionUrl) {
                    window.open(notification.metadata.actionUrl, '_blank');
                  }
                }}
                className="inline-flex items-center px-3 py-1.5 text-sm rounded-md transition-colors font-medium bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {notification.metadata?.actionLabel || 'Learn More'}
              </button>
            )}
          </div>
        );

      default:
        // For unknown notification types, provide more context based on available data
        return (
          <div className="flex-1 min-w-0">
            <div className="flex items-center mb-1">
              {notification.sourceUserId && (
                <UserBadge uid={notification.sourceUserId} showUsername={true} />
              )}
            </div>
            <p className="text-sm text-foreground">
              {notification.sourceUserId ? 'took an action on your page' : 'Activity on your account'}
              {notification.targetPageTitle && (
                <>
                  {' '}<span className="font-medium">
                    {notification.targetPageTitle}
                  </span>
                </>
              )}
              {notification.type && (
                <span className="text-xs ml-1 text-muted-foreground">
                  (Unknown notification type: {notification.type})
                </span>
              )}
            </p>
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        "wewrite-card relative cursor-pointer group",
        notification.read ? "" : "ring-2 ring-primary/20"
      )}
      onClick={(e) => {
        // Only handle click if it's not on the username link or menu (prevents double navigation)
        if (!e.defaultPrevented && !showMenu) {
          handleClick();
        }
      }}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center flex-1">
          {/* Notification type icon with unread indicator */}
          <div className="flex-shrink-0 mr-3 flex items-center h-full relative">
            {(() => {
              const { icon, color } = getNotificationTypeIcon(notification.type);
              return (
                <div className="relative">
                  <Icon name={icon} size={20} className={cn(color, isUnread ? 'opacity-100' : 'opacity-50')} />
                  {/* Unread dot overlay */}
                  {isUnread && (
                    <div
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background"
                      style={{ backgroundColor: '#1768FF' }}
                    />
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex-1">
            {renderNotificationContent()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-foreground opacity-70 whitespace-nowrap">
            {notification.createdAt && (() => {
              try {
                const date = new Date(notification.createdAt);
                if (isNaN(date.getTime())) return '';
                return formatDistanceToNow(date, { addSuffix: true }).replace('about ', '');
              } catch (error) {
                console.error('Error formatting notification time:', error);
                return '';
              }
            })()}
          </div>

          {/* Context Menu Button */}
          <div className="relative" ref={menuRef}>
            {isMobile ? (
              // Mobile: Always visible button
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMenu}
                className="h-8 w-8 p-0 opacity-70 hover:opacity-100"
              >
                <Icon name="MoreVertical" size={16} />
              </Button>
            ) : (
              // Desktop: Show on hover
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMenu}
                className={cn(
                  "h-8 w-8 p-0 transition-opacity",
                  showMenu ? "opacity-100" : "opacity-0 group-hover:opacity-70 hover:opacity-100"
                )}
              >
                <Icon name="MoreVertical" size={16} />
              </Button>
            )}

            {/* Dropdown Menu */}
            {showMenu && (
              <div className={cn(
                "absolute top-full mt-2 min-w-[180px] w-max bg-background border border-border rounded-lg shadow-lg z-50",
                menuPosition
              )}>
                <div className="py-2">
                  {!isUnread ? (
                    <button
                      onClick={handleMarkAsUnread}
                      className="flex items-center w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left whitespace-nowrap"
                    >
                      <Icon name="X" size={16} className="mr-3 flex-shrink-0" />
                      <span>Mark as unread</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleMarkAsRead}
                      className="flex items-center w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left whitespace-nowrap"
                    >
                      <Icon name="Check" size={16} className="mr-3 flex-shrink-0" />
                      <span>Mark as read</span>
                    </button>
                  )}

                  {/* Criticality Settings */}
                  <div className="border-t border-border my-2"></div>
                  <div className="px-4 py-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Notification Level
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleCriticalityChange(e, 'device')}
                    className={cn(
                      "flex items-center w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left whitespace-nowrap",
                      (notification.criticality || 'normal') === 'device' ? "bg-primary/10 text-primary" : "text-foreground"
                    )}
                  >
                    <Icon name="Smartphone" size={16} className="mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <span>Device notification</span>
                      <div className="text-xs text-muted-foreground">Most critical</div>
                    </div>
                  </button>

                  <button
                    onClick={(e) => handleCriticalityChange(e, 'normal')}
                    className={cn(
                      "flex items-center w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left whitespace-nowrap",
                      (notification.criticality || 'normal') === 'normal' ? "bg-primary/10 text-primary" : "text-foreground"
                    )}
                  >
                    <Icon name="Bell" size={16} className="mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <span>Show in notifications</span>
                      <div className="text-xs text-muted-foreground">Normal</div>
                    </div>
                  </button>

                  <button
                    onClick={(e) => handleCriticalityChange(e, 'hidden')}
                    className={cn(
                      "flex items-center w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left whitespace-nowrap",
                      (notification.criticality || 'normal') === 'hidden' ? "bg-primary/10 text-primary" : "text-foreground"
                    )}
                  >
                    <Icon name="EyeOff" size={16} className="mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <span>Hide notification</span>
                      <div className="text-xs text-muted-foreground">Not critical</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
