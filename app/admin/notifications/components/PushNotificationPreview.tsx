import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { notificationModes } from '../config';

interface PushNotificationPreviewProps {
  templateId: string;
}

export function PushNotificationPreview({ templateId }: PushNotificationPreviewProps) {
  const getPushData = () => {
    switch (templateId) {
      case 'verification':
        return {
          title: 'Verify Your Email',
          body: 'Click to verify your email address and complete setup',
          icon: '✉️'
        };
      case 'welcome':
        return {
          title: 'Welcome to WeWrite!',
          body: 'Start creating and sharing your pages',
          icon: '👋'
        };
      case 'password-reset':
        return {
          title: 'Password Reset',
          body: 'Click to reset your WeWrite password',
          icon: '🔐'
        };
      case 'generic-notification':
        return {
          title: 'WeWrite',
          body: 'You have a new notification',
          icon: '🔔'
        };
      case 'payout-setup-reminder':
        return {
          title: 'Set up payouts',
          body: 'You have $25.00 in earnings ready to claim',
          icon: '💵'
        };
      case 'payout-processed':
        return {
          title: 'Payout Completed',
          body: 'Your payout of $50.00 has been processed',
          icon: '💰'
        };
      case 'subscription-confirmation':
        return {
          title: 'Subscription Confirmed',
          body: 'Your WeWrite subscription is now active',
          icon: '🎉'
        };
      case 'weekly-digest':
        return {
          title: 'Your Weekly Digest',
          body: 'Check out the highlights from your week',
          icon: '📰'
        };
      case 'new-follower':
        return {
          title: 'New Follower',
          body: '@johndoe started following you',
          icon: '🔔'
        };
      case 'page-linked':
        return {
          title: 'Page Linked',
          body: '@janedoe linked to your page',
          icon: '🔗'
        };
      case 'account-security':
        return {
          title: 'Security Alert',
          body: 'New login detected on your account',
          icon: '🔒'
        };
      case 'choose-username':
        return {
          title: 'Choose Your Username',
          body: 'Pick a unique username for your WeWrite account',
          icon: '👤'
        };
      case 'broadcast':
        return {
          title: 'Important Announcement',
          body: 'We have an important update to share',
          icon: '📣'
        };
      case 'product-update':
        return {
          title: 'Product Update',
          body: 'Check out the latest features and improvements',
          icon: '✨'
        };
      case 'reactivation':
        return {
          title: 'We miss you!',
          body: 'Come back and start earning on WeWrite',
          icon: '👋'
        };
      default:
        return {
          title: 'WeWrite',
          body: 'This template does not support push notifications',
          icon: '📧'
        };
    }
  };

  const push = getPushData();
  const modes = notificationModes[templateId] || { email: false, inApp: false, push: false };

  if (!modes.push) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Icon name="Smartphone" size={48} className="mx-auto mb-3 opacity-50" />
        <p className="text-sm">This notification does not support push delivery</p>
      </div>
    );
  }

  return (
    <div className="max-w-[360px] mx-auto">
      {/* iOS-style push notification with WeWrite app icon */}
      <div className="relative bg-card rounded-2xl shadow-2xl p-4 border border-border">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden">
            {/* WeWrite app icon - in production this is /icons/icon-192x192.png */}
            <img
              src="/icons/icon-192x192.png"
              alt="WeWrite"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {push.title}
              </p>
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                now
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
              {push.body}
            </p>
          </div>
        </div>
      </div>

      {/* Implementation note */}
      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>PWA Implementation:</strong> Use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">icon: '/icons/icon-192x192.png'</code> in your push notification payload
        </p>
      </div>
    </div>
  );
}
