import { LucideIcon } from 'lucide-react';

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: 'authentication' | 'notifications' | 'payments' | 'engagement' | 'system';
  subject: string;
}

export type EmailTriggerSource = 'cron' | 'system' | 'admin';

export interface EmailLogEntry {
  id: string;
  templateId: string;
  templateName: string;
  recipientEmail: string;
  recipientUserId?: string;
  recipientUsername?: string;
  subject: string;
  status: 'sent' | 'failed' | 'bounced' | 'delivered' | 'scheduled' | 'complained' | 'opened' | 'clicked' | 'delayed';
  resendId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  triggerSource?: EmailTriggerSource;
  sentAt: string;
  createdAt: string;
  // Webhook-updated fields
  lastWebhookEvent?: string;
  lastWebhookAt?: string;
  bounceReason?: string;
  bounceType?: string;
  complaintType?: string;
  openedAt?: string;
  clickedAt?: string;
  clickedLink?: string;
}

export interface GroupedTemplates {
  authentication: EmailTemplate[];
  payments: EmailTemplate[];
  engagement: EmailTemplate[];
  engagementActive: EmailTemplate[];
  engagementInactive: EmailTemplate[];
  system: EmailTemplate[];
  notifications: EmailTemplate[];
}

export interface UserFinancialInfo {
  hasSubscription: boolean;
  subscriptionAmount?: number | null;
  subscriptionStatus?: string | null;
  subscriptionCancelReason?: string | null;
  availableEarningsUsd?: number;
  payoutsSetup: boolean;
  earningsTotalUsd?: number;
  earningsThisMonthUsd?: number;
}

export interface UserDetails {
  uid: string;
  email: string;
  username?: string;
  createdAt?: any;
  lastLogin?: any;
  totalPages?: number;
  stripeConnectedAccountId?: string | null;
  isAdmin?: boolean;
  emailVerified?: boolean;
  referredBy?: string;
  referredByUsername?: string;
  referralSource?: string;
  financial?: UserFinancialInfo;
}

export interface NotificationModes {
  email: boolean;
  inApp: boolean;
  push: boolean;
}

export interface TriggerStatusInfo {
  status: 'active' | 'partial' | 'not-implemented' | 'disabled';
  description: string;
}

export interface CategoryConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

export interface CronSchedule {
  id: string;
  name: string;
  path: string;
  schedule: string;
  description: string;
  nextRun: Date;
  isSystemJob: boolean;
}

export interface CronRecipient {
  userId: string;
  email: string;
  username?: string;
  type: string;
  reason?: string;
}

export interface CronRecipientsState {
  loading: boolean;
  recipients: CronRecipient[];
}
