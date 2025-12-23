/**
 * Email Templates
 * 
 * Centralized email template definitions with preview support.
 * All templates are defined here and can be previewed in the admin panel.
 */

// ============================================================================
// Shared Styles
// ============================================================================

export const emailStyles = {
  base: `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
  `,
  button: `
    background: linear-gradient(135deg, #3B82F6 0%, #2563EB 50%, #1D4ED8 100%);
    color: #fff;
    padding: 12px 30px;
    text-decoration: none;
    border-radius: 6px;
    display: inline-block;
    font-weight: 500;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3), 0 4px 12px rgba(37, 99, 235, 0.2);
  `,
  secondaryButton: `
    background: #f5f5f5;
    color: #333;
    padding: 12px 30px;
    text-decoration: none;
    border-radius: 6px;
    display: inline-block;
    font-weight: 500;
    border: 1px solid #ddd;
  `,
  link: `color: #0066cc; text-decoration: none;`,
  muted: `color: #666; font-size: 14px;`,
  footer: `text-align: center; font-size: 12px; color: #999;`,
};

// ============================================================================
// Dark Mode Styles
// Dark mode CSS for email clients that support @media (prefers-color-scheme)
// Supported: Apple Mail (iOS/macOS), Outlook on macOS
// Partial/No support: Gmail, Yahoo, Outlook on Windows
// ============================================================================

const darkModeStyles = `
  /* Dark mode meta declaration */
  :root {
    color-scheme: light dark;
    supported-color-schemes: light dark;
  }

  /* Dark mode styles for clients that support prefers-color-scheme */
  @media (prefers-color-scheme: dark) {
    /* Body and main wrapper */
    .email-body {
      background-color: #1a1a1a !important;
    }

    /* Text colors */
    .dark-text {
      color: #e5e5e5 !important;
    }
    .dark-text-muted {
      color: #a3a3a3 !important;
    }
    .dark-text-heading {
      color: #ffffff !important;
    }

    /* Card backgrounds */
    .dark-card {
      background-color: #262626 !important;
    }
    .dark-card-inner {
      background-color: #333333 !important;
      border-color: #404040 !important;
    }

    /* Footer */
    .dark-footer {
      color: #737373 !important;
    }
    .dark-footer a {
      color: #737373 !important;
    }

    /* Links */
    .dark-link {
      color: #60a5fa !important;
    }

    /* Stats boxes */
    .dark-stat-box {
      background-color: #333333 !important;
      border-color: #404040 !important;
    }

    /* Security alert (keep red tones) */
    .dark-alert-security {
      background-color: #2a1a1a !important;
      border-color: #4a2020 !important;
    }
  }

  /* Outlook app dark mode (uses [data-ogsc] selector) */
  [data-ogsc] .dark-text {
    color: #e5e5e5 !important;
  }
  [data-ogsc] .dark-text-muted {
    color: #a3a3a3 !important;
  }
  [data-ogsc] .dark-text-heading {
    color: #ffffff !important;
  }
  [data-ogsc] .dark-card {
    background-color: #262626 !important;
  }
  [data-ogsc] .dark-card-inner {
    background-color: #333333 !important;
  }
`;

// ============================================================================
// Template Definitions
// ============================================================================

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: 'authentication' | 'notifications' | 'payments' | 'engagement' | 'system';
  subject: string;
  generateHtml: (data: Record<string, any>) => string;
  sampleData: Record<string, any>;
}

/**
 * Email footer options for customizing unsubscribe links
 */
interface EmailFooterOptions {
  /** User's email settings token for no-login preferences access */
  emailSettingsToken?: string;
  /** The type of email being sent (for one-click unsubscribe) */
  emailType?: string;
}

/**
 * Generate footer links based on whether we have a token
 */
const generateFooterLinks = (options?: EmailFooterOptions): string => {
  const baseUrl = 'https://getwewrite.app';
  const { emailSettingsToken, emailType } = options || {};

  if (emailSettingsToken) {
    // Token-based links (no login required)
    const preferencesUrl = `${baseUrl}/email-preferences/${emailSettingsToken}`;
    const unsubscribeUrl = emailType
      ? `${baseUrl}/api/email/unsubscribe?token=${emailSettingsToken}&type=${emailType}`
      : null;

    return `
      <p>
        <a href="${preferencesUrl}" style="color: #999;">Manage email preferences</a>
        ${unsubscribeUrl ? `
          <span style="color: #ccc;"> | </span>
          <a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe from this type of email</a>
        ` : ''}
      </p>
    `;
  }

  // Fallback to login-required preferences page
  return `
    <p>
      <a href="${baseUrl}/settings/email-preferences" style="color: #999;">Manage email preferences</a>
    </p>
  `;
};

// Base wrapper for all emails with dark mode support
const wrapEmail = (title: string, content: string, footerOptions?: EmailFooterOptions): string => `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title} - WeWrite</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    ${darkModeStyles}
  </style>
</head>
<body class="email-body" style="${emailStyles.base} max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <div style="text-align: center; margin-bottom: 30px;">
    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
      <tr>
        <td style="vertical-align: middle; padding-right: 12px;">
          <img src="https://getwewrite.app/icons/icon-192x192.png" alt="WeWrite" width="44" height="44" style="display: block; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
        </td>
        <td style="vertical-align: middle;">
          <h1 class="dark-text-heading" style="color: #000; margin: 0; font-size: 28px; font-weight: 600;">WeWrite</h1>
        </td>
      </tr>
    </table>
  </div>
  ${content}
  <div class="dark-footer" style="${emailStyles.footer}">
    <p>© ${new Date().getFullYear()} WeWrite. All rights reserved.</p>
    ${generateFooterLinks(footerOptions)}
  </div>
</body>
</html>
`;

// ============================================================================
// Authentication Templates
// ============================================================================

export const verificationEmailTemplate: EmailTemplate = {
  id: 'verification',
  name: 'Email Verification',
  description: 'Sent when a new user signs up to verify their email address',
  category: 'authentication',
  subject: 'Verify your WeWrite email',
  sampleData: {
    username: 'JohnDoe',
    verificationLink: 'https://getwewrite.app/verify?token=abc123',
  },
  generateHtml: ({ username, verificationLink }) => wrapEmail('Verify Your Email', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Verify Your Email</h2>
      <p class="dark-text">Hi ${username || 'there'},</p>
      <p class="dark-text">Thanks for signing up for WeWrite! Please verify your email address by clicking the button below:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" style="${emailStyles.button}">
          Verify Email
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}">
        Or copy and paste this link into your browser:<br>
        <a class="dark-link" href="${verificationLink}" style="${emailStyles.link}; word-break: break-all;">${verificationLink}</a>
      </p>
    </div>

    <div class="dark-footer" style="${emailStyles.footer}">
      <p>If you didn't create an account on WeWrite, you can safely ignore this email.</p>
    </div>
  `),
};

export const verificationReminderTemplate: EmailTemplate = {
  id: 'verification-reminder',
  name: 'Email Verification Reminder',
  description: 'Sent as a reminder to users who haven\'t verified their email',
  category: 'authentication',
  subject: 'Reminder: Verify your WeWrite email',
  sampleData: {
    username: 'JohnDoe',
    verificationLink: 'https://getwewrite.app/verify?token=sample-token',
  },
  generateHtml: ({ username, verificationLink }) => wrapEmail('Verify Your Email', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Don't Forget to Verify Your Email!</h2>
      <p class="dark-text">Hi ${username},</p>
      <p class="dark-text">We noticed you haven't verified your email address yet. Verifying your email helps secure your account and ensures you don't miss any important updates.</p>

      <p class="dark-text"><strong>Why verify?</strong></p>
      <ul class="dark-text" style="padding-left: 20px; margin: 15px 0;">
        <li style="margin-bottom: 8px;">Secure your account and protect your earnings</li>
        <li style="margin-bottom: 8px;">Receive notifications about new followers and page links</li>
        <li style="margin-bottom: 8px;">Get important updates about your content</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" style="${emailStyles.button}">
          Verify Email Now
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}">
        Or copy and paste this link into your browser:<br>
        <a class="dark-link" href="${verificationLink}" style="${emailStyles.link}; word-break: break-all;">${verificationLink}</a>
      </p>
    </div>

    <div class="dark-footer" style="${emailStyles.footer}">
      <p>If you didn't create an account on WeWrite, you can safely ignore this email.</p>
    </div>
  `),
};

export const welcomeEmailTemplate: EmailTemplate = {
  id: 'welcome',
  name: 'Welcome Email',
  description: 'Sent after a user successfully verifies their email',
  category: 'authentication',
  subject: 'Welcome to WeWrite! 🎉',
  sampleData: {
    username: 'JohnDoe',
  },
  generateHtml: ({ username }) => wrapEmail('Welcome to WeWrite!', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Welcome to WeWrite! 🎉</h2>
      <p class="dark-text">Hi ${username},</p>
      <p class="dark-text">We're thrilled to have you join our community of writers and collaborators!</p>

      <p class="dark-text"><strong>Here's how to get started:</strong></p>
      <ul class="dark-text" style="padding-left: 20px; margin: 20px 0;">
        <li style="margin-bottom: 8px;">Create your first page and share your thoughts</li>
        <li style="margin-bottom: 8px;">Discover and follow other writers</li>
        <li style="margin-bottom: 8px;">Link your pages to build connections</li>
        <li style="margin-bottom: 8px;">Earn from your contributions</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/create" style="${emailStyles.button}">
          Create Your First Page
        </a>
      </div>
    </div>

    <div class="dark-footer" style="${emailStyles.footer}">
      <p>Happy writing!</p>
    </div>
  `),
};

export const passwordResetEmailTemplate: EmailTemplate = {
  id: 'password-reset',
  name: 'Password Reset',
  description: 'Sent when a user requests to reset their password',
  category: 'authentication',
  subject: 'Reset your WeWrite password',
  sampleData: {
    username: 'JohnDoe',
    email: 'johndoe@example.com',
    resetLink: 'https://getwewrite.app/auth/reset-password?token=xyz789',
  },
  generateHtml: ({ username, email, resetLink }) => wrapEmail('Reset Your Password', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Reset Your Password</h2>
      <p class="dark-text">Hi ${username || 'there'},</p>
      <p class="dark-text">You requested to reset the password for <strong>${email}</strong>.</p>
      <p class="dark-text">Click the button below to set a new password:</p>

      <div style="text-align: center; margin: 30px 0;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${resetLink}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" strokecolor="#000000" fillcolor="#000000">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">Reset Password</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
          <tr>
            <td style="background-color: #000; border-radius: 6px; padding: 0;">
              <a href="${resetLink}" target="_blank" style="background-color: #000; color: #ffffff; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 500; line-height: 44px; text-align: center; text-decoration: none; width: 200px; border-radius: 6px; -webkit-text-size-adjust: none;">
                Reset Password
              </a>
            </td>
          </tr>
        </table>
        <!--<![endif]-->
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}">
        This link will expire in 1 hour.<br><br>
        If the button above doesn't work, copy and paste this link into your browser:<br>
        <a class="dark-link" href="${resetLink}" style="${emailStyles.link}; word-break: break-all;">${resetLink}</a>
      </p>
    </div>

    <div class="dark-footer" style="${emailStyles.footer}">
      <p>If you didn't request a password reset for ${email}, you can safely ignore this email.</p>
    </div>
  `),
};

// ============================================================================
// Payment Templates
// ============================================================================

export const payoutSetupReminderTemplate: EmailTemplate = {
  id: 'payout-setup-reminder',
  name: 'Payout Setup Reminder',
  description: 'Reminds users to set up their payout method to receive earnings',
  category: 'payments',
  subject: 'Set up payouts to receive your WeWrite earnings 💰',
  sampleData: {
    username: 'JohnDoe',
    pendingEarnings: '$12.50',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, pendingEarnings, emailSettingsToken }) => wrapEmail('Set Up Your Payouts', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">You Have Earnings Waiting! 💰</h2>
      <p class="dark-text">Hi ${username},</p>
      <p class="dark-text">Great news! You've earned <strong>${pendingEarnings}</strong> on WeWrite from readers supporting your pages.</p>
      <p class="dark-text">To receive your earnings, you'll need to set up your payout method. It only takes a few minutes!</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/settings/payouts" style="${emailStyles.button}">
          Set Up Payouts
        </a>
      </div>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p class="dark-text-muted" style="margin: 0; font-size: 14px; color: #666;">
          <strong class="dark-text">Why set up payouts?</strong><br>
          Once configured, you'll automatically receive your earnings at the end of each month. We use Stripe for secure, fast transfers.
        </p>
      </div>
    </div>
  `, { emailSettingsToken, emailType: 'payout-reminder' }),
};

export const firstEarningsTemplate: EmailTemplate = {
  id: 'first-earnings',
  name: 'First Earnings',
  description: 'Congratulates users on earning their first money on WeWrite',
  category: 'payments',
  subject: 'You earned your first money on WeWrite! 🎉',
  sampleData: {
    username: 'JohnDoe',
    firstEarnings: '$2.50',
    amountToGo: '$22.50',
    payoutThreshold: '$25.00',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, firstEarnings, amountToGo, payoutThreshold, emailSettingsToken }) => wrapEmail('First Earnings', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Congratulations on Your First Earnings! 🎉</h2>
      <p class="dark-text">Hi ${username},</p>
      <p class="dark-text">This is a big moment - you just earned your first money on WeWrite!</p>

      <div class="dark-card-inner" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: rgba(255,255,255,0.9); margin: 0 0 8px 0; font-size: 14px;">Your first earnings</p>
        <p style="color: #fff; margin: 0; font-size: 36px; font-weight: 700;">${firstEarnings}</p>
      </div>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <p class="dark-text" style="margin: 0 0 12px 0; font-weight: 600;">Your path to payout:</p>
        <p class="dark-text-muted" style="margin: 0; font-size: 14px; color: #666;">
          You're only <strong class="dark-text">${amountToGo}</strong> away from reaching the ${payoutThreshold} payout threshold. Once you hit ${payoutThreshold}, you'll be able to set up automatic monthly payouts!
        </p>
      </div>

      <p class="dark-text">Keep creating great content and engaging with the WeWrite community. Every contribution brings you closer to your first payout!</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/new" style="${emailStyles.button}">
          Create Another Page
        </a>
      </div>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p class="dark-text-muted" style="margin: 0; font-size: 14px; color: #666;">
          <strong class="dark-text">How did you earn this?</strong><br>
          When readers pledge to pages you've contributed to, you earn a share of the revenue based on your contributions. The more valuable content you create, the more you can earn!
        </p>
      </div>
    </div>
  `, { emailSettingsToken, emailType: 'first-earnings' }),
};

export const halfwayToPayoutTemplate: EmailTemplate = {
  id: 'halfway-to-payout',
  name: 'Halfway to Payout',
  description: 'Celebrates users who have earned 50% of the minimum payout threshold',
  category: 'payments',
  subject: 'You\'re halfway to your first payout! 🎯',
  sampleData: {
    username: 'JohnDoe',
    currentEarnings: '$12.50',
    payoutThreshold: '$25.00',
    percentComplete: '50',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, currentEarnings, payoutThreshold, percentComplete, emailSettingsToken }) => wrapEmail('Halfway to Payout', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">You're ${percentComplete}% to Your First Payout! 🎯</h2>
      <p class="dark-text">Hi ${username},</p>
      <p class="dark-text">Great progress! You've earned <strong>${currentEarnings}</strong> on WeWrite so far.</p>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span class="dark-text" style="font-size: 14px;">Progress to payout</span>
            <span class="dark-text" style="font-size: 14px; font-weight: 600;">${currentEarnings} / ${payoutThreshold}</span>
          </div>
          <div style="background: #e5e7eb; border-radius: 9999px; height: 8px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); height: 100%; width: ${percentComplete}%; border-radius: 9999px;"></div>
          </div>
        </div>
        <p class="dark-text-muted" style="margin: 0; font-size: 13px; color: #666;">
          Once you reach ${payoutThreshold}, you'll be able to receive automatic monthly payouts!
        </p>
      </div>

      <p class="dark-text">Keep creating great content and engaging with the community to reach your payout goal!</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/new" style="${emailStyles.button}">
          Create New Page
        </a>
      </div>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p class="dark-text-muted" style="margin: 0; font-size: 14px; color: #666;">
          <strong class="dark-text">How earnings work:</strong><br>
          You earn when readers pledge to pages you've contributed to. The more valuable content you create, the more you can earn!
        </p>
      </div>
    </div>
  `, { emailSettingsToken, emailType: 'earnings-milestone' }),
};

export const payoutProcessedTemplate: EmailTemplate = {
  id: 'payout-processed',
  name: 'Payout Processed',
  description: 'Sent when a payout has been successfully processed',
  category: 'payments',
  subject: 'Your WeWrite payout has been processed! 🎉',
  sampleData: {
    username: 'JohnDoe',
    amount: '$45.00',
    processingDate: 'December 1, 2025',
    arrivalDate: 'December 3-5, 2025',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, amount, processingDate, arrivalDate, emailSettingsToken }) => wrapEmail('Payout Processed', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Payout Processed! 🎉</h2>
      <p class="dark-text">Hi ${username},</p>
      <p class="dark-text">We've processed your payout of <strong>${amount}</strong>.</p>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td class="dark-text-muted" style="padding: 8px 0; color: #666;">Amount</td>
            <td class="dark-text" style="padding: 8px 0; text-align: right; font-weight: 600;">${amount}</td>
          </tr>
          <tr>
            <td class="dark-text-muted" style="padding: 8px 0; color: #666;">Processed on</td>
            <td class="dark-text" style="padding: 8px 0; text-align: right;">${processingDate}</td>
          </tr>
          <tr>
            <td class="dark-text-muted" style="padding: 8px 0; color: #666;">Expected arrival</td>
            <td class="dark-text" style="padding: 8px 0; text-align: right;">${arrivalDate}</td>
          </tr>
        </table>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}">
        Funds typically arrive in your bank account within 2-5 business days.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/settings/payouts" style="${emailStyles.button}">
          View Payout History
        </a>
      </div>
    </div>
  `, { emailSettingsToken, emailType: 'payout-processed' }),
};

export const subscriptionConfirmationTemplate: EmailTemplate = {
  id: 'subscription-confirmation',
  name: 'Subscription Confirmation',
  description: 'Sent when a user subscribes to WeWrite',
  category: 'payments',
  subject: 'Welcome to WeWrite Premium! ✨',
  sampleData: {
    username: 'JohnDoe',
    planName: 'Monthly',
    amount: '$5.00/month',
    nextBillingDate: 'January 4, 2026',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, planName, amount, nextBillingDate, emailSettingsToken }) => wrapEmail('Subscription Confirmed', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Welcome to WeWrite Premium! ✨</h2>
      <p class="dark-text">Hi ${username},</p>
      <p class="dark-text">Thank you for subscribing! Your support helps keep WeWrite running and enables us to pay writers like you.</p>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td class="dark-text-muted" style="padding: 8px 0; color: #666;">Plan</td>
            <td class="dark-text" style="padding: 8px 0; text-align: right; font-weight: 600;">${planName}</td>
          </tr>
          <tr>
            <td class="dark-text-muted" style="padding: 8px 0; color: #666;">Amount</td>
            <td class="dark-text" style="padding: 8px 0; text-align: right;">${amount}</td>
          </tr>
          <tr>
            <td class="dark-text-muted" style="padding: 8px 0; color: #666;">Next billing</td>
            <td class="dark-text" style="padding: 8px 0; text-align: right;">${nextBillingDate}</td>
          </tr>
        </table>
      </div>

      <p class="dark-text"><strong>What you can do now:</strong></p>
      <ul class="dark-text" style="padding-left: 20px; margin: 20px 0;">
        <li style="margin-bottom: 8px;">Allocate your monthly budget to pages you love</li>
        <li style="margin-bottom: 8px;">Support writers directly</li>
        <li style="margin-bottom: 8px;">Access premium features</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app" style="${emailStyles.button}">
          Start Supporting Writers
        </a>
      </div>
    </div>
  `, { emailSettingsToken, emailType: 'subscription-confirmation' }),
};

// ============================================================================
// Engagement Templates
// ============================================================================

export const weeklyDigestTemplate: EmailTemplate = {
  id: 'weekly-digest',
  name: 'Weekly Digest',
  description: 'Weekly summary of activity and trending pages',
  category: 'engagement',
  subject: 'Your WeWrite Weekly Digest 📚',
  sampleData: {
    username: 'JohnDoe',
    pageViews: '142',
    newFollowers: '3',
    earningsThisWeek: '$2.50',
    trendingPages: [
      { title: 'The Future of AI Writing', author: 'TechWriter' },
      { title: 'Creative Writing Tips', author: 'StoryMaster' },
      { title: 'Building in Public', author: 'StartupDev' },
    ],
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, pageViews, newFollowers, earningsThisWeek, trendingPages, emailSettingsToken }) => wrapEmail('Weekly Digest', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Your Week on WeWrite 📚</h2>
      <p class="dark-text">Hi ${username},</p>
      <p class="dark-text">Here's what happened this week:</p>

      <div style="display: flex; gap: 12px; margin: 20px 0; flex-wrap: wrap;">
        <div class="dark-stat-box" style="flex: 1; min-width: 120px; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; text-align: center;">
          <div class="dark-text-heading" style="font-size: 24px; font-weight: 700; color: #000;">${pageViews}</div>
          <div class="dark-text-muted" style="font-size: 12px; color: #666;">Page Views</div>
        </div>
        <div class="dark-stat-box" style="flex: 1; min-width: 120px; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; text-align: center;">
          <div class="dark-text-heading" style="font-size: 24px; font-weight: 700; color: #000;">${newFollowers}</div>
          <div class="dark-text-muted" style="font-size: 12px; color: #666;">New Followers</div>
        </div>
        <div class="dark-stat-box" style="flex: 1; min-width: 120px; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; text-align: center;">
          <div class="dark-text-heading" style="font-size: 24px; font-weight: 700; color: #000;">${earningsThisWeek}</div>
          <div class="dark-text-muted" style="font-size: 12px; color: #666;">Earned</div>
        </div>
      </div>

      <h3 class="dark-text-heading" style="color: #000; margin-top: 30px;">Trending This Week 🔥</h3>
      ${trendingPages.map((page: any) => `
        <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 12px 16px; margin: 8px 0;">
          <strong class="dark-text">${page.title}</strong>
          <span class="dark-text-muted" style="color: #666;"> by ${page.author}</span>
        </div>
      `).join('')}

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/trending" style="${emailStyles.button}">
          Explore Trending
        </a>
      </div>
    </div>
  `, { emailSettingsToken, emailType: 'weekly-digest' }),
};

export const newFollowerTemplate: EmailTemplate = {
  id: 'new-follower',
  name: 'New Follower',
  description: 'Notification when someone follows the user',
  category: 'engagement',
  subject: 'You have a new follower on WeWrite! 🎉',
  sampleData: {
    username: 'JohnDoe',
    followerUsername: 'JaneSmith',
    followerBio: 'Writer and coffee enthusiast ☕',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, followerUsername, followerBio, emailSettingsToken }) => wrapEmail('New Follower', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">New Follower! 🎉</h2>
      <p class="dark-text">Hi ${username},</p>
      <p class="dark-text"><strong>@${followerUsername}</strong> is now following you on WeWrite.</p>

      ${followerBio ? `
      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p class="dark-text-muted" style="margin: 0; font-style: italic; color: #666;">"${followerBio}"</p>
      </div>
      ` : ''}

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/u/${followerUsername}" style="${emailStyles.button}">
          View Profile
        </a>
      </div>
    </div>
  `, { emailSettingsToken, emailType: 'new-follower' }),
};

export const pageLinkedTemplate: EmailTemplate = {
  id: 'page-linked',
  name: 'Page Linked',
  description: 'Notification when someone links to the user\'s page',
  category: 'engagement',
  subject: '{{linkerUsername}} linked to your page "{{linkedPageTitle}}" on WeWrite!',
  sampleData: {
    username: 'JohnDoe',
    linkedPageTitle: 'My Awesome Article',
    linkerUsername: 'JaneSmith',
    linkerPageTitle: 'Related Thoughts on Writing',
    linkerPageId: 'abc123',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, linkedPageTitle, linkerUsername, linkerPageTitle, linkerPageId, emailSettingsToken }) => wrapEmail('Page Linked', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Your Page Was Linked! 🔗</h2>
      <p class="dark-text">Hi ${username},</p>
      <p class="dark-text"><strong>@${linkerUsername}</strong> linked to your page "<strong>${linkedPageTitle}</strong>" in their page "<strong>${linkerPageTitle}</strong>".</p>

      <p class="dark-text-muted" style="${emailStyles.muted}">
        When others link to your pages, it helps more people discover your writing and can increase your earnings!
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/${linkerPageId || ''}" style="${emailStyles.button}">
          View Their Page
        </a>
      </div>
    </div>
  `, { emailSettingsToken, emailType: 'page-linked' }),
};

// ============================================================================
// System Templates
// ============================================================================

export const genericNotificationTemplate: EmailTemplate = {
  id: 'generic-notification',
  name: 'Generic Notification',
  description: 'A flexible notification template for various announcements',
  category: 'system',
  subject: 'WeWrite Notification',
  sampleData: {
    username: 'JohnDoe',
    heading: 'Important Update',
    body: 'We have some exciting news to share with you about new features coming to WeWrite.',
    ctaText: 'Learn More',
    ctaUrl: 'https://getwewrite.app/updates',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, heading, body, ctaText, ctaUrl, emailSettingsToken }) => wrapEmail(heading, `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">${heading}</h2>
      ${username ? `<p class="dark-text">Hi ${username},</p>` : ''}
      <p class="dark-text">${body}</p>

      ${ctaUrl ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${ctaUrl}" style="${emailStyles.button}">
          ${ctaText || 'Learn More'}
        </a>
      </div>
      ` : ''}
    </div>
  `, { emailSettingsToken, emailType: 'generic-notification' }),
};

export const accountSecurityTemplate: EmailTemplate = {
  id: 'account-security',
  name: 'Account Security Alert',
  description: 'Sent when there\'s suspicious activity or security-related events',
  category: 'system',
  subject: '🔒 Security Alert - WeWrite',
  sampleData: {
    username: 'JohnDoe',
    eventType: 'New login detected',
    eventDetails: 'Chrome on macOS • San Francisco, CA',
    eventTime: 'December 4, 2025 at 3:45 PM',
  },
  generateHtml: ({ username, eventType, eventDetails, eventTime }) => wrapEmail('Security Alert', `
    <div class="dark-alert-security" style="background: #fff4f4; border: 1px solid #ffcccc; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #cc0000;">🔒 ${eventType}</h2>
      <p class="dark-text">Hi ${username},</p>
      <p class="dark-text">We detected the following activity on your account:</p>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p class="dark-text" style="margin: 0 0 8px 0;"><strong>${eventType}</strong></p>
        <p class="dark-text-muted" style="margin: 0 0 8px 0; color: #666;">${eventDetails}</p>
        <p class="dark-text-muted" style="margin: 0; color: #999; font-size: 12px;">${eventTime}</p>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}">
        If this was you, you can ignore this email. If you don't recognize this activity, please secure your account immediately.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/settings/security" style="background: #cc0000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
          Secure My Account
        </a>
      </div>
    </div>
  `),
};

export const chooseUsernameTemplate: EmailTemplate = {
  id: 'choose-username',
  name: 'Choose Your Username',
  description: 'Reminds users who haven\'t set up a proper username to choose one',
  category: 'engagement',
  subject: 'Choose your username on WeWrite ✏️',
  sampleData: {
    currentUsername: 'user_abc123',
  },
  generateHtml: ({ currentUsername }) => wrapEmail('Choose Your Username', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Make Your Mark on WeWrite ✏️</h2>
      <p class="dark-text">Hey there!</p>
      <p class="dark-text">We noticed you haven't chosen a username yet. Right now you're showing up as <strong style="color: #666;">${currentUsername || 'user_...'}</strong> around the platform.</p>

      <p class="dark-text">A great username helps you:</p>
      <ul class="dark-text" style="padding-left: 20px; margin: 20px 0;">
        <li style="margin-bottom: 8px;">Build your identity as a writer</li>
        <li style="margin-bottom: 8px;">Make it easy for others to find and follow you</li>
        <li style="margin-bottom: 8px;">Stand out on the leaderboard</li>
        <li style="margin-bottom: 8px;">Get proper credit for your contributions</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/settings/profile" style="${emailStyles.button}">
          Choose My Username
        </a>
      </div>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p class="dark-text-muted" style="margin: 0; font-size: 14px; color: #666;">
          <strong class="dark-text">💡 Tips for a great username:</strong><br>
          • Keep it memorable and easy to spell<br>
          • Use something that represents you as a writer<br>
          • Avoid numbers and special characters if possible
        </p>
      </div>
    </div>
  `),
};

export const reactivationTemplate: EmailTemplate = {
  id: 'reactivation',
  name: 'Re-activation',
  description: 'Sent to inactive users to encourage them to start writing and earning again',
  category: 'engagement',
  subject: 'We miss you on WeWrite! Come back and start earning',
  sampleData: {
    username: 'JohnDoe',
    daysSinceActive: 30,
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, daysSinceActive, emailSettingsToken }) => wrapEmail('We Miss You!', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username || 'there'}, we've missed you!</h2>
      <p class="dark-text">It's been a little quiet on your WeWrite profile lately, and we wanted to check in.</p>

      <p class="dark-text">Here's the thing: <strong>every page you write on WeWrite can earn you real money</strong>. When subscribers allocate their monthly budget to pages they love, creators like you get paid.</p>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 20px; margin: 24px 0;">
        <p class="dark-text" style="margin: 0 0 12px 0; font-size: 15px; color: #333;">
          <strong>Why come back?</strong>
        </p>
        <ul class="dark-text-muted" style="padding-left: 18px; margin: 0; color: #555;">
          <li style="margin-bottom: 8px;">Write about anything you're passionate about</li>
          <li style="margin-bottom: 8px;">Earn money when readers support your work</li>
          <li style="margin-bottom: 8px;">Connect with other writers and build your audience</li>
          <li style="margin-bottom: 8px;">No minimum—every allocation counts</li>
        </ul>
      </div>

      <p class="dark-text-muted" style="color: #555;">Your next great idea could be the one that resonates with readers. Why not give it a shot?</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/create" style="${emailStyles.button}">
          Start Writing
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center;">
        Got questions or feedback? Just reply to this email—we'd love to hear from you.
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'reactivation' }),
};

export const firstPageActivationTemplate: EmailTemplate = {
  id: 'first-page-activation',
  name: 'Write Your First Page',
  description: 'Sent to new users who haven\'t written a page yet to encourage them to start',
  category: 'engagement',
  subject: 'Your story is waiting to be told',
  sampleData: {
    username: 'JohnDoe',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, emailSettingsToken }) => wrapEmail('Write Your First Page', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username || 'there'}, we're so glad you're here!</h2>

      <p class="dark-text" style="font-size: 16px;">Welcome to WeWrite. You've taken the first step—now let's take the next one together.</p>

      <p class="dark-text">Writing your first page might feel like a big moment, but here's a secret: <strong>it doesn't need to be perfect</strong>. In fact, it doesn't need to be anything in particular. Some of our favorite pages are just a single thought, a quick memory, or a question someone was pondering.</p>

      <div class="dark-card-inner" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <p class="dark-text" style="margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #334155;">
          Not sure where to start? Try one of these:
        </p>
        <ul class="dark-text-muted" style="padding-left: 20px; margin: 0; color: #475569;">
          <li style="margin-bottom: 10px;">📝 <strong>Introduce yourself</strong> — Who are you? What lights you up?</li>
          <li style="margin-bottom: 10px;">💡 <strong>Share something you learned</strong> — Big or small, someone out there needs to hear it</li>
          <li style="margin-bottom: 10px;">❤️ <strong>Write about something you love</strong> — A place, a person, a hobby, a memory</li>
          <li style="margin-bottom: 10px;">✨ <strong>Just start typing</strong> — One sentence is all it takes. See where it goes.</li>
        </ul>
      </div>

      <p class="dark-text">Here's the beautiful thing about WeWrite: <strong>every page you write can earn you real money</strong>. When readers discover and support your work, you get paid. No minimums, no hoops to jump through. Just write something honest, and let the rest unfold.</p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://getwewrite.app/new" style="${emailStyles.button}; font-size: 16px; padding: 14px 36px;">
          Write Your First Page →
        </a>
      </div>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 24px 0; text-align: center;">
        <p class="dark-text-muted" style="margin: 0; font-size: 14px; color: #6b7280;">
          💬 <em>Got questions or just want to say hi? Reply to this email—we read every message.</em>
        </p>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center; margin-top: 24px;">
        We can't wait to read what you write. Your voice matters here.
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'first-page-activation' }),
};

// ============================================================================
// Broadcast Template (for newsletters and product updates)
// ============================================================================

export const broadcastEmailTemplate: EmailTemplate = {
  id: 'broadcast',
  name: 'Broadcast Email',
  description: 'Newsletter and product update template for bulk sending to all users',
  category: 'engagement',
  subject: 'Update from WeWrite',
  sampleData: {
    subject: 'New Features on WeWrite! 🎉',
    heading: 'Exciting Updates Coming Your Way',
    body: `<p>We've been working hard on some amazing new features that we think you'll love:</p>
    <ul>
      <li><strong>Improved Editor</strong> - A smoother writing experience</li>
      <li><strong>New Themes</strong> - Fresh looks for your pages</li>
      <li><strong>Better Mobile Support</strong> - Write on the go</li>
    </ul>
    <p>Thank you for being part of our community!</p>`,
    ctaText: 'Explore New Features',
    ctaUrl: 'https://getwewrite.app',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ subject, heading, body, ctaText, ctaUrl, emailSettingsToken }) => {
    const ctaSection = ctaText && ctaUrl ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${ctaUrl}" style="${emailStyles.button}">
          ${ctaText}
        </a>
      </div>
    ` : '';

    // Use token-based unsubscribe via wrapEmail footer
    return wrapEmail(subject || 'Update from WeWrite', `
      <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
        <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">${heading}</h2>
        <div class="dark-text" style="color: #333; line-height: 1.7;">
          ${body}
        </div>
        ${ctaSection}
      </div>
    `, { emailSettingsToken, emailType: 'product-update' });
  },
};

// ============================================================================
// Export All Templates
// ============================================================================

export const emailTemplates: EmailTemplate[] = [
  // Authentication
  verificationEmailTemplate,
  verificationReminderTemplate,
  welcomeEmailTemplate,
  passwordResetEmailTemplate,
  // Payments
  payoutSetupReminderTemplate,
  firstEarningsTemplate,
  halfwayToPayoutTemplate,
  payoutProcessedTemplate,
  subscriptionConfirmationTemplate,
  // Engagement
  weeklyDigestTemplate,
  newFollowerTemplate,
  pageLinkedTemplate,
  chooseUsernameTemplate,
  reactivationTemplate,
  firstPageActivationTemplate,
  broadcastEmailTemplate,
  // System
  genericNotificationTemplate,
  accountSecurityTemplate,
];

export const getTemplateById = (id: string): EmailTemplate | undefined => {
  return emailTemplates.find(t => t.id === id);
};

export const getTemplatesByCategory = (category: EmailTemplate['category']): EmailTemplate[] => {
  return emailTemplates.filter(t => t.category === category);
};
