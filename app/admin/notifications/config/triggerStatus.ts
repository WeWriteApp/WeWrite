import { TriggerStatusInfo } from '../types';

/**
 * Trigger status for each template - which ones are actually wired up
 */
export const triggerStatus: Record<string, TriggerStatusInfo> = {
  'verification': {
    status: 'active',
    description: 'Handled by Firebase Auth. Custom template available via API.'
  },
  'verification-reminder': {
    status: 'active',
    description: 'Fully implemented. Daily cron job at 4pm UTC for users who signed up 3-7 days ago and haven\'t verified.'
  },
  'welcome': {
    status: 'active',
    description: 'Fully implemented. Sent via /api/email/send endpoint.'
  },
  'password-reset': {
    status: 'active',
    description: 'Fully implemented via /api/auth/reset-password with Firebase.'
  },
  'generic-notification': {
    status: 'active',
    description: 'Fully implemented. Sent via /api/email/send endpoint.'
  },
  'payout-setup-reminder': {
    status: 'active',
    description: 'Fully implemented. Daily cron job at 3pm UTC for users with pending earnings.'
  },
  'payout-processed': {
    status: 'active',
    description: 'Fully implemented. Auto-triggered after successful payout in payoutServiceUnified.ts.'
  },
  'subscription-confirmation': {
    status: 'active',
    description: 'Fully implemented. Triggered by Stripe webhook on successful subscription.'
  },
  'weekly-digest': {
    status: 'active',
    description: 'Fully implemented. Weekly cron job on Mondays at 10am UTC.'
  },
  'new-follower': {
    status: 'active',
    description: 'Fully implemented. Triggered in /api/follows/users when someone follows.'
  },
  'page-linked': {
    status: 'active',
    description: 'Fully implemented. Triggered when pages link to other pages.'
  },
  'account-security': {
    status: 'disabled',
    description: 'Disabled - was spammy and not working properly. Can be re-enabled later.'
  },
  'choose-username': {
    status: 'active',
    description: 'Fully implemented. Daily cron job at 2pm UTC for users without usernames.'
  },
  'first-page-activation': {
    status: 'active',
    description: 'Fully implemented. Daily cron job at 1pm UTC for users 2-7 days old who haven\'t created a page.'
  },
  'reactivation': {
    status: 'active',
    description: 'Fully implemented. Weekly cron job on Mondays at 4pm UTC for users inactive 30-90 days.'
  },
  'broadcast': {
    status: 'active',
    description: 'Fully implemented. Admin can send to all users via /admin/broadcast.'
  },
  'product-update': {
    status: 'active',
    description: 'Fully implemented. Product updates and announcements for all users.'
  },
};
