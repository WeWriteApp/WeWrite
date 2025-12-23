'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { notificationModes } from '../config';

interface NotificationPreviewProps {
  templateId: string;
}

export function NotificationPreview({ templateId }: NotificationPreviewProps) {
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
        <Icon name="Bell" size={48} className="mx-auto mb-3 opacity-50" />
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
                {notification.metadata && 'allocatedUsdCents' in notification.metadata && (
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
