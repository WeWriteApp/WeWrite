/**
 * Email Service - Resend Integration
 * 
 * Centralized email sending service using Resend.
 * https://resend.com/docs
 * 
 * Domain: getwewrite.app (pending DNS propagation)
 * From address: noreply@getwewrite.app (once DNS propagates)
 * Test address: onboarding@resend.dev (use until DNS propagates)
 */

import { Resend } from 'resend';
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
import { logEmailSend } from './emailLogService';

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

// Use notifications@ instead of noreply@ for better deliverability
const FROM_EMAIL = 'WeWrite <notifications@getwewrite.app>';
const REPLY_TO_EMAIL = 'support@getwewrite.app';

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
    
    const { data, error } = await getResend().emails.send({
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
    
    const { data, error } = await getResend().emails.send({
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
    
    const { data, error } = await getResend().emails.send({
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
    
    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to,
      subject,
      html: genericNotificationTemplate.generateHtml({ heading, body, ctaText, ctaUrl, username }),
      text: `${heading}\n\n${body}${ctaUrl ? `\n\n${ctaText || 'Learn more'}: ${ctaUrl}` : ''}`,
    });

    if (error) {
      await logEmailSend({
        templateId: 'notification',
        templateName: 'Notification',
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
      templateId: 'notification',
      templateName: 'Notification',
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
    
    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      ...(html ? { html } : { text: content }),
      ...(replyTo && { replyTo }),
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
    const { data, error } = await getResend().emails.send({
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
        templateId: 'payout-reminder',
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
      templateId: 'payout-reminder',
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
    const { data, error } = await getResend().emails.send({
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
}): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    const { data, error } = await getResend().emails.send({
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
}): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: options.to,
      subject: newFollowerTemplate.subject,
      html: newFollowerTemplate.generateHtml(options),
    });

    if (error) {
      await logEmailSend({
        templateId: 'new-follower',
        templateName: 'New Follower',
        recipientEmail: options.to,
        recipientUserId: options.userId,
        recipientUsername: options.username,
        subject: newFollowerTemplate.subject,
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
      subject: newFollowerTemplate.subject,
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
  userId?: string;
}): Promise<boolean> => {
  const sentAt = new Date().toISOString();
  try {
    // Interpolate subject with actual values
    const subject = pageLinkedTemplate.subject
      .replace('{{linkerUsername}}', options.linkerUsername)
      .replace('{{linkedPageTitle}}', options.linkedPageTitle);

    const { data, error } = await getResend().emails.send({
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
        metadata: { linkedPageTitle: options.linkedPageTitle, linkerUsername: options.linkerUsername },
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
      metadata: { linkedPageTitle: options.linkedPageTitle, linkerUsername: options.linkerUsername },
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
    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: options.to,
      subject: accountSecurityTemplate.subject,
      html: accountSecurityTemplate.generateHtml(options),
    });

    if (error) {
      await logEmailSend({
        templateId: 'security-alert',
        templateName: 'Security Alert',
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
      templateId: 'security-alert',
      templateName: 'Security Alert',
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
 * @param options.scheduledAt - Optional ISO 8601 date string or natural language (e.g., "in 2 days")
 *                              to schedule the email for future delivery (up to 30 days)
 */
export const sendTemplatedEmail = async (options: {
  templateId: string;
  to: string;
  data: Record<string, any>;
  userId?: string;
  scheduledAt?: string;
}): Promise<{ success: boolean; resendId?: string }> => {
  const sentAt = new Date().toISOString();
  try {
    const { templateId, to, data, userId, scheduledAt } = options;

    const template = getTemplateById(templateId);
    if (!template) {
      return { success: false };
    }

    const { data: resendData, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to,
      subject: template.subject,
      html: template.generateHtml(data),
      ...(scheduledAt && { scheduledAt }),
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
        metadata: { ...data, scheduledAt },
        sentAt,
      });
      return { success: false };
    }

    await logEmailSend({
      templateId,
      templateName: template.name,
      recipientEmail: to,
      recipientUserId: userId,
      recipientUsername: data.username,
      subject: template.subject,
      status: scheduledAt ? 'scheduled' : 'sent',
      resendId: resendData?.id,
      metadata: { ...data, scheduledAt },
      sentAt,
    });
    return { success: true, resendId: resendData?.id };
  } catch (error) {
    return { success: false };
  }
};

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
