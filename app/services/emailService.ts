/**
 * Email Service - Resend Integration
 *
 * Centralized email sending service using Resend.
 * https://resend.com/docs
 *
 * IMPORTANT: Resend only supports SENDING emails.
 * To RECEIVE emails at these addresses, set up email forwarding via:
 * - Your DNS provider (many support simple forwarding)
 * - A service like ImprovMX (free for basic use)
 * - Full email hosting (Google Workspace, Zoho, etc.)
 */

import { Resend } from 'resend';
import { Emails } from '../utils/urlConfig';
import {
  verificationEmailTemplate,
  welcomeEmailTemplate,
  passwordResetEmailTemplate,
  genericNotificationTemplate,
  payoutSetupReminderTemplate,
  payoutProcessedTemplate,
  subscriptionConfirmationTemplate,
  weeklyDigestTemplate,
  newFollowerTemplate,
  pageLinkedTemplate,
  accountSecurityTemplate,
  chooseUsernameTemplate,
  getTemplateById,
} from '../lib/emailTemplates';
import { logEmailSend, type EmailTriggerSource } from './emailLogService';
import {
  canSendEmail,
  recordEmailSent,
  getPriorityForTemplate,
  EmailPriority,
  type CanSendResult,
} from './emailRateLimitService';

// Lazy-initialize Resend to avoid build-time errors
let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

// Rate limiting: Resend allows 2 requests/second, we use 600ms for safety margin
const RATE_LIMIT_DELAY_MS = 600;
let lastEmailSentAt = 0;

/**
 * Wait to respect rate limits before sending next email
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastEmail = now - lastEmailSentAt;
  if (timeSinceLastEmail < RATE_LIMIT_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS - timeSinceLastEmail));
  }
  lastEmailSentAt = Date.now();
}

/**
 * Send email with retry logic for rate limit errors
 * @param sendFn - Function that performs the actual send
 * @param maxRetries - Maximum number of retries (default 3)
 */
async function sendWithRetry<T>(
  sendFn: () => Promise<{ data: T | null; error: { message: string; name?: string; statusCode?: number } | null; headers?: Record<string, string> | null }>,
  maxRetries = 3
): Promise<{ data: T | null; error: { message: string; name?: string } | null }> {
  let lastError: { message: string; name?: string } | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Wait for rate limit before each attempt
    await waitForRateLimit();

    const result = await sendFn();

    if (!result.error) {
      return result;
    }

    lastError = result.error;

    // Check if it's a rate limit error (429)
    const isRateLimitError =
      result.error.name === 'rate_limit_exceeded' ||
      result.error.message?.includes('rate limit') ||
      result.error.message?.includes('Too many requests') ||
      (result.error as any).statusCode === 429;

    if (isRateLimitError && attempt < maxRetries) {
      // Exponential backoff: 1s, 2s, 4s
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.log(`[Email Service] Rate limited, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      continue;
    }

    // Not a rate limit error or max retries reached
    break;
  }

  return { data: null, error: lastError };
}

/**
 * Internal rate-limited send — ALL email sending must go through this.
 * Checks daily/monthly quota, auto-schedules via Resend's scheduledAt if over limit,
 * records usage in Firestore on success.
 */
async function rateLimitedSend(
  templateId: string,
  params: { from: string; to: string | string[]; subject: string; html?: string; text?: string; replyTo?: string; scheduledAt?: string }
): Promise<{ data: { id: string } | null; error: { message: string; name?: string } | null; scheduled?: boolean; scheduledFor?: string }> {
  const priority = getPriorityForTemplate(templateId);
  let scheduledAt = params.scheduledAt;
  let wasAutoScheduled = false;

  // Check rate limits (unless already scheduled for a future date)
  if (!scheduledAt) {
    try {
      const rateLimitResult = await canSendEmail(priority);
      if (!rateLimitResult.canSend) {
        if (priority === EmailPriority.P0_CRITICAL) {
          console.warn(`[Email Service] Sending P0 email despite quota: ${rateLimitResult.reason}`);
        } else if (rateLimitResult.suggestedScheduleDate) {
          scheduledAt = rateLimitResult.suggestedScheduleDate;
          wasAutoScheduled = true;
          console.log(`[Email Service] Auto-scheduling ${templateId} for ${scheduledAt} (${rateLimitResult.reason})`);
        }
      }
    } catch (err) {
      console.warn('[Email Service] Rate limit check failed, sending anyway:', err);
    }
  }

  const result = await sendWithRetry(async () => {
    const res = await getResend().emails.send({
      ...params,
      ...(scheduledAt && { scheduledAt }),
    } as any);
    return {
      data: res.data,
      error: res.error ? { message: res.error.message, name: res.error.name } : null,
    };
  });

  // Record usage on success
  if (!result.error) {
    try {
      const recordDate = scheduledAt ? scheduledAt.split('T')[0] : undefined;
      await recordEmailSent(priority, recordDate);
    } catch (err) {
      console.warn('[Email Service] Failed to record email sent:', err);
    }
  }

  return { ...result, scheduled: wasAutoScheduled, scheduledFor: scheduledAt };
}

// Use notifications@ instead of noreply@ for better deliverability
const FROM_EMAIL = `WeWrite <${Emails.notifications}>`;
const REPLY_TO_EMAIL = Emails.support;

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

interface VerificationEmailOptions {
  to: string;
  verificationLink: string;
  username?: string;
  userId?: string;
}

interface WelcomeEmailOptions {
  to: string;
  username: string;
  userId?: string;
}

interface PasswordResetEmailOptions {
  to: string;
  resetLink: string;
  username?: string;
  userId?: string;
}

interface NotificationEmailOptions {
  to: string;
  subject: string;
  preheader?: string;
  heading: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  username?: string;
  userId?: string;
}

/**
 * Send a verification email
 */
export const sendVerificationEmail = async (options: VerificationEmailOptions): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    const { to, verificationLink, username, userId } = options;
    
    const { data, error } = await rateLimitedSend('verification', {
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to,
      subject: verificationEmailTemplate.subject,
      html: verificationEmailTemplate.generateHtml({ verificationLink, username }),
      text: `Hi ${username || 'there'},\n\nPlease verify your email by clicking this link: ${verificationLink}\n\nIf you didn't create an account, you can ignore this email.\n\nThanks,\nThe WeWrite Team`,
    });

    if (error) {
      await logEmailSend({
        templateId: 'verification',
        templateName: 'Email Verification',
        recipientEmail: to,
        recipientUserId: userId,
        recipientUsername: username,
        subject: verificationEmailTemplate.subject,
        status: 'failed',
        errorMessage: error.message,
        sentAt,
      });
      return false;
    }

    await logEmailSend({
      templateId: 'verification',
      templateName: 'Email Verification',
      recipientEmail: to,
      recipientUserId: userId,
      recipientUsername: username,
      subject: verificationEmailTemplate.subject,
      status: 'sent',
      resendId: data?.id,
      sentAt,
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Send a welcome email after verification
 */
export const sendWelcomeEmail = async (options: WelcomeEmailOptions): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    const { to, username, userId } = options;
    
    const { data, error } = await rateLimitedSend('welcome', {
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to,
      subject: welcomeEmailTemplate.subject,
      html: welcomeEmailTemplate.generateHtml({ username }),
      text: `Hi ${username},\n\nWelcome to WeWrite! We're excited to have you join our community of writers.\n\nGet started by creating your first page or exploring what others are writing.\n\nHappy writing!\nThe WeWrite Team`,
    });

    if (error) {
      await logEmailSend({
        templateId: 'welcome',
        templateName: 'Welcome Email',
        recipientEmail: to,
        recipientUserId: userId,
        recipientUsername: username,
        subject: welcomeEmailTemplate.subject,
        status: 'failed',
        errorMessage: error.message,
        sentAt,
      });
      return false;
    }

    await logEmailSend({
      templateId: 'welcome',
      templateName: 'Welcome Email',
      recipientEmail: to,
      recipientUserId: userId,
      recipientUsername: username,
      subject: welcomeEmailTemplate.subject,
      status: 'sent',
      resendId: data?.id,
      sentAt,
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Send a password reset email
 */
export const sendPasswordResetEmail = async (options: PasswordResetEmailOptions): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    const { to, resetLink, username, userId } = options;
    
    const { data, error } = await rateLimitedSend('password-reset', {
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to,
      subject: passwordResetEmailTemplate.subject,
      html: passwordResetEmailTemplate.generateHtml({ resetLink, username, email: to }),
      text: `Hi ${username || 'there'},\n\nYou requested to reset the password for ${to}.\n\nClick this link to set a new password: ${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can ignore this email.\n\nThanks,\nThe WeWrite Team`,
    });

    if (error) {
      await logEmailSend({
        templateId: 'password-reset',
        templateName: 'Password Reset',
        recipientEmail: to,
        recipientUserId: userId,
        recipientUsername: username,
        subject: passwordResetEmailTemplate.subject,
        status: 'failed',
        errorMessage: error.message,
        sentAt,
      });
      return false;
    }

    await logEmailSend({
      templateId: 'password-reset',
      templateName: 'Password Reset',
      recipientEmail: to,
      recipientUserId: userId,
      recipientUsername: username,
      subject: passwordResetEmailTemplate.subject,
      status: 'sent',
      resendId: data?.id,
      sentAt,
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Send a generic notification email
 */
export const sendNotificationEmail = async (options: NotificationEmailOptions): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    const { to, subject, heading, body, ctaText, ctaUrl, username, userId } = options;
    
    const { data, error } = await rateLimitedSend('generic-notification', {
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to,
      subject,
      html: genericNotificationTemplate.generateHtml({ heading, body, ctaText, ctaUrl, username }),
      text: `${heading}\n\n${body}${ctaUrl ? `\n\n${ctaText || 'Learn more'}: ${ctaUrl}` : ''}`,
    });

    if (error) {
      await logEmailSend({
        templateId: 'generic-notification',
        templateName: 'Generic Notification',
        recipientEmail: to,
        recipientUserId: userId,
        recipientUsername: username,
        subject,
        status: 'failed',
        errorMessage: error.message,
        sentAt,
      });
      return false;
    }

    await logEmailSend({
      templateId: 'generic-notification',
      templateName: 'Generic Notification',
      recipientEmail: to,
      recipientUserId: userId,
      recipientUsername: username,
      subject,
      status: 'sent',
      resendId: data?.id,
      sentAt,
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Send a generic email
 */
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    const { to, subject, text, html, replyTo } = options;
    
    // Resend requires at least one of: html, text, or react
    const content = html || text || subject;
    
    const { data, error } = await rateLimitedSend('generic', {
      from: FROM_EMAIL,
      replyTo: replyTo || REPLY_TO_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      ...(html ? { html } : { text: content }),
    });

    if (error) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

// ============================================================================
// Additional Specialized Email Functions
// ============================================================================

/**
 * Send payout setup reminder email
 */
export const sendPayoutSetupReminder = async (options: {
  to: string;
  username: string;
  pendingEarnings: string;
  userId?: string;
  emailSettingsToken?: string;
}): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    const { data, error } = await rateLimitedSend('payout-setup-reminder', {
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: options.to,
      subject: payoutSetupReminderTemplate.subject,
      html: payoutSetupReminderTemplate.generateHtml({
        username: options.username,
        pendingEarnings: options.pendingEarnings,
        emailSettingsToken: options.emailSettingsToken,
      }),
    });

    if (error) {
      await logEmailSend({
        templateId: 'payout-setup-reminder',
        templateName: 'Payout Setup Reminder',
        recipientEmail: options.to,
        recipientUserId: options.userId,
        recipientUsername: options.username,
        subject: payoutSetupReminderTemplate.subject,
        status: 'failed',
        errorMessage: error.message,
        sentAt,
      });
      return false;
    }

    await logEmailSend({
      templateId: 'payout-setup-reminder',
      templateName: 'Payout Setup Reminder',
      recipientEmail: options.to,
      recipientUserId: options.userId,
      recipientUsername: options.username,
      subject: payoutSetupReminderTemplate.subject,
      status: 'sent',
      resendId: data?.id,
      sentAt,
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Send payout processed email
 */
export const sendPayoutProcessed = async (options: {
  to: string;
  username: string;
  amount: string;
  processingDate: string;
  arrivalDate: string;
  userId?: string;
}): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    const { data, error } = await rateLimitedSend('payout-processed', {
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: options.to,
      subject: payoutProcessedTemplate.subject,
      html: payoutProcessedTemplate.generateHtml(options),
    });

    if (error) {
      await logEmailSend({
        templateId: 'payout-processed',
        templateName: 'Payout Processed',
        recipientEmail: options.to,
        recipientUserId: options.userId,
        recipientUsername: options.username,
        subject: payoutProcessedTemplate.subject,
        status: 'failed',
        errorMessage: error.message,
        metadata: { amount: options.amount },
        sentAt,
      });
      return false;
    }

    await logEmailSend({
      templateId: 'payout-processed',
      templateName: 'Payout Processed',
      recipientEmail: options.to,
      recipientUserId: options.userId,
      recipientUsername: options.username,
      subject: payoutProcessedTemplate.subject,
      status: 'sent',
      resendId: data?.id,
      metadata: { amount: options.amount },
      sentAt,
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Send subscription confirmation email
 */
export const sendSubscriptionConfirmation = async (options: {
  to: string;
  username: string;
  planName: string;
  amount: string;
  nextBillingDate: string;
  userId?: string;
  emailSettingsToken?: string;
}): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    const { data, error } = await rateLimitedSend('subscription-confirmation', {
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: options.to,
      subject: subscriptionConfirmationTemplate.subject,
      html: subscriptionConfirmationTemplate.generateHtml(options),
    });

    if (error) {
      await logEmailSend({
        templateId: 'subscription-confirmation',
        templateName: 'Subscription Confirmation',
        recipientEmail: options.to,
        recipientUserId: options.userId,
        recipientUsername: options.username,
        subject: subscriptionConfirmationTemplate.subject,
        status: 'failed',
        errorMessage: error.message,
        metadata: { planName: options.planName, amount: options.amount },
        sentAt,
      });
      return false;
    }

    await logEmailSend({
      templateId: 'subscription-confirmation',
      templateName: 'Subscription Confirmation',
      recipientEmail: options.to,
      recipientUserId: options.userId,
      recipientUsername: options.username,
      subject: subscriptionConfirmationTemplate.subject,
      status: 'sent',
      resendId: data?.id,
      metadata: { planName: options.planName, amount: options.amount },
      sentAt,
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Send new follower notification email
 */
export const sendNewFollowerEmail = async (options: {
  to: string;
  username: string;
  followerUsername: string;
  followerBio?: string;
  userId?: string;
  emailSettingsToken?: string;
}): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    // Interpolate subject with actual values
    const subject = newFollowerTemplate.subject
      .replace('{{followerUsername}}', options.followerUsername);

    const { data, error } = await rateLimitedSend('new-follower', {
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: options.to,
      subject,
      html: newFollowerTemplate.generateHtml(options),
    });

    if (error) {
      await logEmailSend({
        templateId: 'new-follower',
        templateName: 'New Follower',
        recipientEmail: options.to,
        recipientUserId: options.userId,
        recipientUsername: options.username,
        subject,
        status: 'failed',
        errorMessage: error.message,
        metadata: { followerUsername: options.followerUsername },
        sentAt,
      });
      return false;
    }

    await logEmailSend({
      templateId: 'new-follower',
      templateName: 'New Follower',
      recipientEmail: options.to,
      recipientUserId: options.userId,
      recipientUsername: options.username,
      subject,
      status: 'sent',
      resendId: data?.id,
      metadata: { followerUsername: options.followerUsername },
      sentAt,
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Send page linked notification email
 */
export const sendPageLinkedEmail = async (options: {
  to: string;
  username: string;
  linkedPageTitle: string;
  linkerUsername: string;
  linkerPageTitle: string;
  linkerPageId: string;
  userId?: string;
  emailSettingsToken?: string;
}): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    // Interpolate subject with actual values
    const subject = pageLinkedTemplate.subject
      .replace('{{linkerUsername}}', options.linkerUsername)
      .replace('{{linkedPageTitle}}', options.linkedPageTitle);

    const { data, error } = await rateLimitedSend('page-linked', {
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: options.to,
      subject,
      html: pageLinkedTemplate.generateHtml(options),
    });

    if (error) {
      await logEmailSend({
        templateId: 'page-linked',
        templateName: 'Page Linked',
        recipientEmail: options.to,
        recipientUserId: options.userId,
        recipientUsername: options.username,
        subject,
        status: 'failed',
        errorMessage: error.message,
        metadata: { linkedPageTitle: options.linkedPageTitle, linkerUsername: options.linkerUsername, linkerPageId: options.linkerPageId },
        sentAt,
      });
      return false;
    }

    await logEmailSend({
      templateId: 'page-linked',
      templateName: 'Page Linked',
      recipientEmail: options.to,
      recipientUserId: options.userId,
      recipientUsername: options.username,
      subject,
      status: 'sent',
      resendId: data?.id,
      metadata: { linkedPageTitle: options.linkedPageTitle, linkerUsername: options.linkerUsername, linkerPageId: options.linkerPageId },
      sentAt,
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Send security alert email
 */
export const sendSecurityAlert = async (options: {
  to: string;
  username: string;
  eventType: string;
  eventDetails: string;
  eventTime: string;
  userId?: string;
}): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    const { data, error } = await rateLimitedSend('account-security', {
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: options.to,
      subject: accountSecurityTemplate.subject,
      html: accountSecurityTemplate.generateHtml(options),
    });

    if (error) {
      await logEmailSend({
        templateId: 'account-security',
        templateName: 'Account Security',
        recipientEmail: options.to,
        recipientUserId: options.userId,
        recipientUsername: options.username,
        subject: accountSecurityTemplate.subject,
        status: 'failed',
        errorMessage: error.message,
        metadata: { eventType: options.eventType },
        sentAt,
      });
      return false;
    }

    await logEmailSend({
      templateId: 'account-security',
      templateName: 'Account Security',
      recipientEmail: options.to,
      recipientUserId: options.userId,
      recipientUsername: options.username,
      subject: accountSecurityTemplate.subject,
      status: 'sent',
      resendId: data?.id,
      metadata: { eventType: options.eventType },
      sentAt,
    });
    return true;
  } catch (error) {
    return false;
  }
};

// Export the getResend function for advanced use cases
export { getResend };

/**
 * Send an email using a template ID
 * This is the recommended way to send emails using pre-defined templates
 *
 * Features:
 * - Automatic priority-based rate limiting (P0-P3)
 * - Auto-scheduling when daily quota is reached
 * - Critical emails (P0) always send immediately
 *
 * @param options.scheduledAt - Optional ISO 8601 date string to schedule for future delivery (up to 30 days)
 * @param options.triggerSource - Source of the email trigger: 'cron', 'system', or 'admin'
 * @param options.priority - Override automatic priority (0-3). If not set, determined from templateId
 * @param options.skipRateLimitCheck - Skip rate limit check (use with caution, for batch scheduling)
 */
export const sendTemplatedEmail = async (options: {
  templateId: string;
  to: string;
  data: Record<string, any>;
  userId?: string;
  scheduledAt?: string;
  triggerSource?: EmailTriggerSource;
  priority?: EmailPriority;
  skipRateLimitCheck?: boolean;
}): Promise<{
  success: boolean;
  resendId?: string;
  error?: string;
  wasScheduled?: boolean;
  scheduledFor?: string;
}> => {
  const sentAt = new Date().toISOString();
  try {
    const { templateId, to, data, userId, triggerSource, skipRateLimitCheck } = options;
    let { scheduledAt } = options;

    const template = getTemplateById(templateId);
    if (!template) {
      return { success: false, error: `Template not found: ${templateId}` };
    }

    // Determine priority (explicit > template mapping > default P2)
    const priority = options.priority ?? getPriorityForTemplate(templateId);
    let wasAutoScheduled = false;

    // Check rate limits unless explicitly skipped or already scheduled
    if (!skipRateLimitCheck && !scheduledAt) {
      const rateLimitResult = await canSendEmail(priority);

      if (!rateLimitResult.canSend) {
        if (priority === EmailPriority.P0_CRITICAL) {
          // P0 emails always send - log warning but proceed
          console.warn(`[Email Service] Sending P0 (critical) email despite quota: ${rateLimitResult.reason}`);
        } else if (rateLimitResult.suggestedScheduleDate) {
          // Auto-schedule for later
          scheduledAt = rateLimitResult.suggestedScheduleDate;
          wasAutoScheduled = true;
          console.log(`[Email Service] Auto-scheduling ${templateId} email for ${scheduledAt} (${rateLimitResult.reason})`);
        } else {
          // No available slot - this shouldn't happen but handle gracefully
          console.error(`[Email Service] No available slot for ${templateId}, sending anyway`);
        }
      }
    }

    // Use retry wrapper for rate limit handling
    const { data: resendData, error } = await sendWithRetry(async () => {
      const result = await getResend().emails.send({
        from: FROM_EMAIL,
        replyTo: REPLY_TO_EMAIL,
        to,
        subject: template.subject,
        html: template.generateHtml(data),
        ...(scheduledAt && { scheduledAt }),
      });
      // Resend returns a discriminated union, normalize to the expected shape
      return {
        data: result.data,
        error: result.error ? { message: result.error.message, name: result.error.name } : null,
        headers: result.headers,
      };
    });

    if (error) {
      await logEmailSend({
        templateId,
        templateName: template.name,
        recipientEmail: to,
        recipientUserId: userId,
        recipientUsername: data.username,
        subject: template.subject,
        status: 'failed',
        errorMessage: error.message,
        metadata: { ...data, scheduledAt, priority, wasAutoScheduled },
        triggerSource,
        sentAt,
      });
      return { success: false, error: error.message };
    }

    // Record the email in rate limit tracking
    // For scheduled emails, record against the scheduled date
    const recordDate = scheduledAt ? scheduledAt.split('T')[0] : undefined;
    await recordEmailSent(priority, recordDate);

    await logEmailSend({
      templateId,
      templateName: template.name,
      recipientEmail: to,
      recipientUserId: userId,
      recipientUsername: data.username,
      subject: template.subject,
      status: scheduledAt ? 'scheduled' : 'sent',
      resendId: resendData?.id,
      metadata: { ...data, scheduledAt, priority, wasAutoScheduled },
      triggerSource,
      sentAt,
    });

    return {
      success: true,
      resendId: resendData?.id,
      wasScheduled: !!scheduledAt,
      scheduledFor: scheduledAt,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Re-export EmailPriority for convenience
export { EmailPriority } from './emailRateLimitService';

export default {
  sendEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
  sendPayoutSetupReminder,
  sendPayoutProcessed,
  sendSubscriptionConfirmation,
  sendNewFollowerEmail,
  sendPageLinkedEmail,
  sendSecurityAlert,
  sendTemplatedEmail,
};
