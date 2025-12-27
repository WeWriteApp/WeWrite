/**
 * Notification Flow Configuration
 *
 * Defines the order in which users encounter notifications throughout their lifecycle,
 * and the blocking conditions that prevent certain notifications from being sent.
 *
 * This creates a cascading system where users must complete certain milestones
 * before receiving subsequent notifications.
 */

export type UserRequirement =
  | 'email_verified'        // User has verified their email
  | 'has_username'          // User has set a proper username (not user_xxx)
  | 'has_first_page'        // User has written at least one page
  | 'is_active'             // User has been active in the last 30 days
  | 'is_inactive'           // User has been inactive for 30-90 days
  | 'has_earnings'          // User has any earnings
  | 'has_pending_earnings'  // User has pending earnings above threshold
  | 'has_payout_setup'      // User has connected Stripe for payouts
  | 'has_subscription';     // User has an active subscription

export interface NotificationFlowItem {
  /** Template ID */
  id: string;
  /** Display name */
  name: string;
  /** Description of when this notification is sent */
  description: string;
  /** Stage in the user lifecycle */
  stage: 'onboarding' | 'activation' | 'engagement' | 'monetization' | 'retention';
  /** Order within the flow (lower = earlier in user journey) */
  order: number;
  /** Requirements that MUST be met for this notification to be sent */
  requires?: UserRequirement[];
  /** Requirements that BLOCK this notification if met */
  blockedBy?: UserRequirement[];
  /** Template IDs that block this notification until they've been sent */
  blockedByTemplates?: string[];
  /** Whether this is an automated cron-triggered notification */
  isAutomated: boolean;
  /** Cron schedule ID if automated */
  cronId?: string;
  /** Trigger description for manual/event-based notifications */
  triggerEvent?: string;
}

/**
 * The notification flow defines the order users encounter notifications.
 *
 * Flow visualization:
 *
 * ONBOARDING (New User)
 * ├─ 1. Email Verification (immediate)
 * ├─ 2. Welcome Email (after verification)
 * ├─ 3. Verification Reminder (if unverified + HAS username after 3-7 days)
 * ├─ 3.5 Verify to Choose Username (if unverified + NO username - combined email)
 * └─ 4. Choose Username (if verified + no proper username after 1-7 days)
 *
 * ACTIVATION (Getting Started)
 * └─ 5. First Page Activation (if no pages after 2-7 days)
 *
 * ENGAGEMENT (Active User)
 * ├─ 6. Weekly Digest (has pages, verified, active)
 * ├─ 7. New Follower (event-based)
 * └─ 8. Page Linked (event-based)
 *
 * MONETIZATION (Earning User)
 * ├─ 9. First Earnings (event-based)
 * ├─ 10. Halfway to Payout (event-based, $12.50+)
 * ├─ 11. Payout Setup Reminder (earnings ≥$25, no Stripe)
 * ├─ 12. Subscription Confirmation (event-based)
 * └─ 13. Payout Processed (event-based)
 *
 * RETENTION (Inactive User)
 * └─ 14. Reactivation (30-90 days inactive)
 */
export const notificationFlow: NotificationFlowItem[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // ONBOARDING STAGE - New user setup
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'verification',
    name: 'Email Verification',
    description: 'Sent immediately when user signs up to verify their email address',
    stage: 'onboarding',
    order: 1,
    isAutomated: false,
    triggerEvent: 'User signup',
  },
  {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Sent after user verifies their email address',
    stage: 'onboarding',
    order: 2,
    requires: ['email_verified'],
    isAutomated: false,
    triggerEvent: 'Email verified',
  },
  {
    id: 'verification-reminder',
    name: 'Verification Reminder',
    description: 'Reminds unverified users (who already have a username) to verify email',
    stage: 'onboarding',
    order: 3,
    requires: ['has_username'], // Only for users who HAVE a username already
    blockedBy: ['email_verified'],
    isAutomated: true,
    cronId: 'email-verification-reminder',
  },
  {
    id: 'verify-to-choose-username',
    name: 'Verify to Choose Username',
    description: 'For unverified users without a username - verify first, then choose username',
    stage: 'onboarding',
    order: 3.5,
    blockedBy: ['email_verified', 'has_username'], // Block if verified OR already has username
    isAutomated: true,
    cronId: 'verify-to-choose-username',
  },
  {
    id: 'choose-username',
    name: 'Choose Username',
    description: 'Reminds users to set a proper username (1-7 days after signup)',
    stage: 'onboarding',
    order: 4,
    requires: ['email_verified'], // Only for VERIFIED users without username
    blockedBy: ['has_username'],
    isAutomated: true,
    cronId: 'username-reminder',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVATION STAGE - Getting users to take first action
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'first-page-activation',
    name: 'First Page Activation',
    description: 'Encourages users to write their first page (2-7 days after signup)',
    stage: 'activation',
    order: 5,
    blockedBy: ['has_first_page'],
    isAutomated: true,
    cronId: 'first-page-activation',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ENGAGEMENT STAGE - Active user communications
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'weekly-digest',
    name: 'Weekly Digest',
    description: 'Weekly summary of activity, stats, and trending content',
    stage: 'engagement',
    order: 6,
    requires: ['email_verified', 'has_first_page', 'is_active'],
    isAutomated: true,
    cronId: 'weekly-digest',
  },
  {
    id: 'new-follower',
    name: 'New Follower',
    description: 'Notifies user when someone follows them',
    stage: 'engagement',
    order: 7,
    requires: ['email_verified'],
    isAutomated: false,
    triggerEvent: 'User gains a follower',
  },
  {
    id: 'page-linked',
    name: 'Page Linked',
    description: 'Notifies user when their page is linked from another page',
    stage: 'engagement',
    order: 8,
    requires: ['email_verified', 'has_first_page'],
    isAutomated: false,
    triggerEvent: 'Page receives a backlink',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MONETIZATION STAGE - Earnings and payouts
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'first-earnings',
    name: 'First Earnings',
    description: 'Celebrates user\'s first earnings from views',
    stage: 'monetization',
    order: 9,
    requires: ['has_earnings'],
    isAutomated: false,
    triggerEvent: 'User earns first money',
  },
  {
    id: 'halfway-to-payout',
    name: 'Halfway to Payout',
    description: 'Notifies user when they reach $12.50 (halfway to minimum payout)',
    stage: 'monetization',
    order: 10,
    requires: ['has_earnings'],
    blockedBy: ['has_payout_setup'],
    isAutomated: false,
    triggerEvent: 'Earnings reach $12.50',
  },
  {
    id: 'payout-setup-reminder',
    name: 'Payout Setup Reminder',
    description: 'Reminds users with $25+ earnings to connect Stripe for payouts',
    stage: 'monetization',
    order: 11,
    requires: ['has_pending_earnings'],
    blockedBy: ['has_payout_setup'],
    isAutomated: true,
    cronId: 'payout-setup-reminder',
  },
  {
    id: 'subscription-confirmation',
    name: 'Subscription Confirmation',
    description: 'Confirms when a user subscribes to support a writer',
    stage: 'monetization',
    order: 12,
    isAutomated: false,
    triggerEvent: 'User subscribes',
  },
  {
    id: 'payout-processed',
    name: 'Payout Processed',
    description: 'Confirms when a payout has been sent to user\'s bank',
    stage: 'monetization',
    order: 13,
    requires: ['has_payout_setup'],
    isAutomated: false,
    triggerEvent: 'Payout completed',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // RETENTION STAGE - Win-back inactive users
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'reactivation',
    name: 'Reactivation',
    description: 'Encourages inactive users to return (30-90 days since last activity)',
    stage: 'retention',
    order: 14,
    requires: ['is_inactive'],
    blockedBy: ['is_active'],
    isAutomated: true,
    cronId: 'reactivation',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SYSTEM - Admin and utility emails
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'password-reset',
    name: 'Password Reset',
    description: 'Sent when user requests a password reset',
    stage: 'onboarding',
    order: 100,
    isAutomated: false,
    triggerEvent: 'Password reset requested',
  },
  {
    id: 'broadcast',
    name: 'Broadcast',
    description: 'Admin-sent broadcast message to all or selected users',
    stage: 'engagement',
    order: 101,
    isAutomated: false,
    triggerEvent: 'Admin sends broadcast',
  },
  {
    id: 'generic-notification',
    name: 'Generic Notification',
    description: 'Template for system notifications',
    stage: 'engagement',
    order: 102,
    isAutomated: false,
    triggerEvent: 'System event',
  },
  {
    id: 'account-security',
    name: 'Account Security',
    description: 'Security-related notifications (suspicious login, etc.)',
    stage: 'onboarding',
    order: 103,
    isAutomated: false,
    triggerEvent: 'Security event detected',
  },
];

/**
 * Get the flow item for a template ID
 */
export function getFlowItem(templateId: string): NotificationFlowItem | undefined {
  return notificationFlow.find(item => item.id === templateId);
}

/**
 * Get notifications that block a given template
 */
export function getBlockingNotifications(templateId: string): NotificationFlowItem[] {
  const flowItem = getFlowItem(templateId);
  if (!flowItem?.blockedByTemplates) return [];

  return flowItem.blockedByTemplates
    .map(id => getFlowItem(id))
    .filter((item): item is NotificationFlowItem => item !== undefined);
}

/**
 * Get user-facing notifications sorted by flow order (excludes system/admin templates)
 */
export function getUserFacingFlow(): NotificationFlowItem[] {
  return notificationFlow
    .filter(item => item.order < 100)
    .sort((a, b) => a.order - b.order);
}

/**
 * Get notifications grouped by stage
 */
export function getFlowByStage(): Record<NotificationFlowItem['stage'], NotificationFlowItem[]> {
  const stages: NotificationFlowItem['stage'][] = ['onboarding', 'activation', 'engagement', 'monetization', 'retention'];
  const result: Record<NotificationFlowItem['stage'], NotificationFlowItem[]> = {
    onboarding: [],
    activation: [],
    engagement: [],
    monetization: [],
    retention: [],
  };

  for (const item of notificationFlow.filter(i => i.order < 100)) {
    result[item.stage].push(item);
  }

  // Sort each stage by order
  for (const stage of stages) {
    result[stage].sort((a, b) => a.order - b.order);
  }

  return result;
}

/**
 * Stage display configuration
 */
export const stageConfig: Record<NotificationFlowItem['stage'], {
  label: string;
  icon: string;
  color: string;
  description: string;
}> = {
  onboarding: {
    label: 'Onboarding',
    icon: 'UserPlus',
    color: 'text-blue-400',
    description: 'New user setup and verification',
  },
  activation: {
    label: 'Activation',
    icon: 'Rocket',
    color: 'text-purple-400',
    description: 'Getting users to take first actions',
  },
  engagement: {
    label: 'Engagement',
    icon: 'Heart',
    color: 'text-pink-400',
    description: 'Keeping active users engaged',
  },
  monetization: {
    label: 'Monetization',
    icon: 'DollarSign',
    color: 'text-emerald-400',
    description: 'Earnings and payout notifications',
  },
  retention: {
    label: 'Retention',
    icon: 'RefreshCw',
    color: 'text-orange-400',
    description: 'Winning back inactive users',
  },
};
