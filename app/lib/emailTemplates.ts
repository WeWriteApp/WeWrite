/**
 * Email Templates
 *
 * Centralized email template definitions with preview support.
 * All templates are defined here and can be previewed in the admin panel.
 */

// ============================================================================
// UTM Parameter Helper
// ============================================================================

/**
 * Add UTM parameters to a URL for email analytics tracking
 *
 * @param url - The base URL to add UTM parameters to
 * @param templateId - The email template ID (used as utm_campaign)
 * @param content - Optional button/link name (used as utm_content)
 * @returns URL with UTM parameters appended
 *
 * @example
 * addEmailUtm('https://getwewrite.app/settings', 'verification-reminder', 'verify_button')
 * // Returns: https://getwewrite.app/settings?utm_source=email&utm_medium=email&utm_campaign=verification-reminder&utm_content=verify_button
 */
export function addEmailUtm(url: string, templateId: string, content?: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set('utm_source', 'email');
    urlObj.searchParams.set('utm_medium', 'email');
    urlObj.searchParams.set('utm_campaign', templateId);
    if (content) {
      urlObj.searchParams.set('utm_content', content);
    }
    return urlObj.toString();
  } catch {
    // If URL parsing fails, append manually (for relative URLs or edge cases)
    const separator = url.includes('?') ? '&' : '?';
    let utmParams = `utm_source=email&utm_medium=email&utm_campaign=${encodeURIComponent(templateId)}`;
    if (content) {
      utmParams += `&utm_content=${encodeURIComponent(content)}`;
    }
    return `${url}${separator}${utmParams}`;
  }
}

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
    border-radius: 24px;
    display: inline-block;
    font-weight: 500;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3), 0 4px 12px rgba(37, 99, 235, 0.2);
  `,
  secondaryButton: `
    background: #f5f5f5;
    color: #333;
    padding: 12px 30px;
    text-decoration: none;
    border-radius: 24px;
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
  subject: 'One quick step to get started on WeWrite',
  sampleData: {
    username: 'JohnDoe',
    verificationLink: 'https://getwewrite.app/verify?token=abc123',
  },
  generateHtml: ({ username, verificationLink }) => {
    const trackedLink = addEmailUtm(verificationLink, 'verification', 'verify_button');
    return wrapEmail('Verify Your Email', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username || 'there'}, welcome aboard!</h2>
      <p class="dark-text">We're so excited to have you join WeWrite—a place where your words can actually earn you money.</p>
      <p class="dark-text">Just one quick step before you dive in: let's verify your email to keep your account secure.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${trackedLink}" style="${emailStyles.button}">
          Verify My Email
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}">
        Or copy and paste this link into your browser:<br>
        <a class="dark-link" href="${trackedLink}" style="${emailStyles.link}; word-break: break-all;">${verificationLink}</a>
      </p>
    </div>

    <div class="dark-footer" style="${emailStyles.footer}">
      <p>If you didn't create an account on WeWrite, you can safely ignore this email.</p>
    </div>
  `);
  },
};

export const verificationReminderTemplate: EmailTemplate = {
  id: 'verification-reminder',
  name: 'Email Verification Reminder',
  description: 'Sent as a reminder to users who haven\'t verified their email',
  category: 'authentication',
  subject: 'Quick reminder: verify your email to unlock everything',
  sampleData: {
    username: 'JohnDoe',
    verificationLink: 'https://getwewrite.app/verify?token=sample-token',
  },
  generateHtml: ({ username, verificationLink }) => {
    const trackedLink = addEmailUtm(verificationLink, 'verification-reminder', 'verify_button');
    return wrapEmail('Verify Your Email', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username}, just a friendly nudge!</h2>
      <p class="dark-text">We noticed your email isn't verified yet—no worries, it only takes a second.</p>
      <p class="dark-text">Once you verify, you'll be all set to:</p>

      <ul class="dark-text" style="padding-left: 20px; margin: 15px 0;">
        <li style="margin-bottom: 8px;">🔐 Keep your account (and any future earnings) secure</li>
        <li style="margin-bottom: 8px;">🔔 Get notified when someone follows you or links to your work</li>
        <li style="margin-bottom: 8px;">💰 Receive your payouts without any hiccups</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${trackedLink}" style="${emailStyles.button}">
          Verify My Email
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}">
        Or copy and paste this link into your browser:<br>
        <a class="dark-link" href="${trackedLink}" style="${emailStyles.link}; word-break: break-all;">${verificationLink}</a>
      </p>
    </div>

    <div class="dark-footer" style="${emailStyles.footer}">
      <p>If you didn't create an account on WeWrite, you can safely ignore this email.</p>
    </div>
  `);
  },
};

export const welcomeEmailTemplate: EmailTemplate = {
  id: 'welcome',
  name: 'Welcome Email',
  description: 'Sent after a user successfully verifies their email',
  category: 'authentication',
  subject: 'You\'re in! Welcome to WeWrite',
  sampleData: {
    username: 'JohnDoe',
  },
  generateHtml: ({ username }) => {
    const createPageLink = addEmailUtm('https://getwewrite.app/create', 'welcome', 'create_first_page');
    return wrapEmail('Welcome to WeWrite!', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">You're officially part of WeWrite, ${username}!</h2>
      <p class="dark-text" style="font-size: 16px;">This is the beginning of something exciting. WeWrite is a place where your ideas don't just sit in a folder—they can actually <strong>earn you money</strong>.</p>

      <div class="dark-card-inner" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <p class="dark-text" style="margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #334155;">
          Here's how it works:
        </p>
        <ul class="dark-text-muted" style="padding-left: 20px; margin: 0; color: #475569;">
          <li style="margin-bottom: 10px;">✍️ <strong>Write about anything</strong> — ideas, stories, thoughts, tutorials, you name it</li>
          <li style="margin-bottom: 10px;">🔗 <strong>Connect with other writers</strong> — link to pages you love and build relationships</li>
          <li style="margin-bottom: 10px;">💰 <strong>Earn real money</strong> — when readers support your work, you get paid</li>
        </ul>
      </div>

      <p class="dark-text">Ready to write your first page? Don't overthink it—just share something you care about. That's what makes WeWrite special.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${createPageLink}" style="${emailStyles.button}">
          Write Your First Page →
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center;">
        We can't wait to see what you create. Welcome to the community! 💙
      </p>
    </div>
  `);
  },
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
  generateHtml: ({ username, email, resetLink }) => {
    const trackedLink = addEmailUtm(resetLink, 'password-reset', 'reset_button');
    return wrapEmail('Reset Your Password', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Reset Your Password</h2>
      <p class="dark-text">Hi ${username || 'there'},</p>
      <p class="dark-text">You requested to reset the password for <strong>${email}</strong>.</p>
      <p class="dark-text">Click the button below to set a new password:</p>

      <div style="text-align: center; margin: 30px 0;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${trackedLink}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" strokecolor="#000000" fillcolor="#000000">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">Reset Password</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
          <tr>
            <td style="background-color: #000; border-radius: 24px; padding: 0;">
              <a href="${trackedLink}" target="_blank" style="background-color: #000; color: #ffffff; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 500; line-height: 44px; text-align: center; text-decoration: none; width: 200px; border-radius: 24px; -webkit-text-size-adjust: none;">
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
        <a class="dark-link" href="${trackedLink}" style="${emailStyles.link}; word-break: break-all;">${resetLink}</a>
      </p>
    </div>

    <div class="dark-footer" style="${emailStyles.footer}">
      <p>If you didn't request a password reset for ${email}, you can safely ignore this email.</p>
    </div>
  `);
  },
};

// ============================================================================
// Payment Templates
// ============================================================================

export const payoutSetupReminderTemplate: EmailTemplate = {
  id: 'payout-setup-reminder',
  name: 'Payout Setup Reminder',
  description: 'Reminds users to set up their payout method to receive earnings',
  category: 'payments',
  subject: 'You\'ve got money waiting for you! 💰',
  sampleData: {
    username: 'JohnDoe',
    pendingEarnings: '$12.50',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, pendingEarnings, emailSettingsToken }) => {
    const setupLink = addEmailUtm('https://getwewrite.app/settings/payouts', 'payout-setup-reminder', 'setup_button');
    return wrapEmail('Set Up Your Payouts', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username}, you've got earnings waiting!</h2>
      <p class="dark-text" style="font-size: 16px;">This is exciting news: you've earned <strong>${pendingEarnings}</strong> from readers who love your work on WeWrite.</p>
      <p class="dark-text">There's just one thing left to do—set up your payout method so we can send that money your way. It only takes a couple minutes, and then you're all set for automatic monthly payouts.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${setupLink}" style="${emailStyles.button}">
          Set Up My Payouts →
        </a>
      </div>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p class="dark-text-muted" style="margin: 0; font-size: 14px; color: #666;">
          🔒 <strong class="dark-text">Safe and secure:</strong> We use Stripe—the same payment system used by millions of businesses—to make sure your money gets to you safely.
        </p>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center;">
        Questions? Just reply to this email—we're happy to help.
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'payout-reminder' });
  },
};

export const firstEarningsTemplate: EmailTemplate = {
  id: 'first-earnings',
  name: 'First Earnings',
  description: 'Congratulates users on earning their first money on WeWrite',
  category: 'payments',
  subject: 'This is huge—you just earned your first money!',
  sampleData: {
    username: 'JohnDoe',
    firstEarnings: '$2.50',
    amountToGo: '$22.50',
    payoutThreshold: '$25.00',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, firstEarnings, amountToGo, payoutThreshold, emailSettingsToken }) => {
    const createPageLink = addEmailUtm('https://getwewrite.app/new', 'first-earnings', 'create_page_button');
    return wrapEmail('First Earnings', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username}, you just got paid for your words!</h2>
      <p class="dark-text" style="font-size: 16px;">This is the moment we love to see. Someone out there read what you wrote and decided: <em>"This is worth supporting."</em></p>

      <div class="dark-card-inner" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: rgba(255,255,255,0.9); margin: 0 0 8px 0; font-size: 14px;">Your first earnings</p>
        <p style="color: #fff; margin: 0; font-size: 36px; font-weight: 700;">${firstEarnings}</p>
      </div>

      <p class="dark-text">It might look like a small number, but here's what it really means: <strong>your writing has value</strong>. And this is just the beginning.</p>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <p class="dark-text" style="margin: 0 0 12px 0; font-weight: 600;">📈 Your path to payout:</p>
        <p class="dark-text-muted" style="margin: 0; font-size: 14px; color: #666;">
          You're <strong class="dark-text">${amountToGo}</strong> away from the ${payoutThreshold} threshold. Once you hit it, we'll send money directly to your bank. Automatically. Every month.
        </p>
      </div>

      <p class="dark-text">Keep writing, keep sharing, keep being you. Every page gets you closer to that first payout.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${createPageLink}" style="${emailStyles.button}">
          Write Something New →
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center;">
        We're cheering for you. Seriously. 💙
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'first-earnings' });
  },
};

export const halfwayToPayoutTemplate: EmailTemplate = {
  id: 'halfway-to-payout',
  name: 'Halfway to Payout',
  description: 'Celebrates users who have earned 50% of the minimum payout threshold',
  category: 'payments',
  subject: 'You\'re halfway there—keep going!',
  sampleData: {
    username: 'JohnDoe',
    currentEarnings: '$12.50',
    payoutThreshold: '$25.00',
    percentComplete: '50',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, currentEarnings, payoutThreshold, percentComplete, emailSettingsToken }) => {
    const createPageLink = addEmailUtm('https://getwewrite.app/new', 'halfway-to-payout', 'create_page_button');
    return wrapEmail('Halfway to Payout', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username}, look how far you've come!</h2>
      <p class="dark-text" style="font-size: 16px;">You've hit an awesome milestone: you're <strong>${percentComplete}%</strong> of the way to your first payout. That's real progress.</p>

      <div class="dark-card-inner" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 14px; color: #166534;">Your progress</span>
            <span style="font-size: 14px; font-weight: 600; color: #166534;">${currentEarnings} / ${payoutThreshold}</span>
          </div>
          <div style="background: #bbf7d0; border-radius: 9999px; height: 10px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); height: 100%; width: ${percentComplete}%; border-radius: 9999px;"></div>
          </div>
        </div>
        <p style="margin: 0; font-size: 13px; color: #15803d;">
          Once you hit ${payoutThreshold}, we'll automatically send your earnings to your bank. Every month. No extra steps.
        </p>
      </div>

      <p class="dark-text">You're proving that your words have value. Readers are supporting your work—keep giving them something to love.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${createPageLink}" style="${emailStyles.button}">
          Write Your Next Page →
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center;">
        You've got this. We believe in you. 💙
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'earnings-milestone' });
  },
};

export const payoutProcessedTemplate: EmailTemplate = {
  id: 'payout-processed',
  name: 'Payout Processed',
  description: 'Sent when a payout has been successfully processed',
  category: 'payments',
  subject: 'Cha-ching! Your payout is on its way 💸',
  sampleData: {
    username: 'JohnDoe',
    amount: '$45.00',
    processingDate: 'December 1, 2025',
    arrivalDate: 'December 3-5, 2025',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, amount, processingDate, arrivalDate, emailSettingsToken }) => {
    const historyLink = addEmailUtm('https://getwewrite.app/settings/payouts', 'payout-processed', 'view_history_button');
    const createLink = addEmailUtm('https://getwewrite.app/new', 'payout-processed', 'keep_writing_button');
    return wrapEmail('Payout Processed', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username}, your payout is on its way!</h2>
      <p class="dark-text" style="font-size: 16px;">This is the moment that makes it all worth it. We've just sent <strong>${amount}</strong> to your bank account—money you earned by sharing your words with the world.</p>

      <div class="dark-card-inner" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td class="dark-text-muted" style="padding: 8px 0; color: #166534;">Amount</td>
            <td class="dark-text" style="padding: 8px 0; text-align: right; font-weight: 700; color: #166534; font-size: 18px;">${amount}</td>
          </tr>
          <tr>
            <td class="dark-text-muted" style="padding: 8px 0; color: #15803d;">Processed on</td>
            <td class="dark-text" style="padding: 8px 0; text-align: right; color: #15803d;">${processingDate}</td>
          </tr>
          <tr>
            <td class="dark-text-muted" style="padding: 8px 0; color: #15803d;">Expected arrival</td>
            <td class="dark-text" style="padding: 8px 0; text-align: right; color: #15803d;">${arrivalDate}</td>
          </tr>
        </table>
      </div>

      <p class="dark-text">This is what happens when readers believe in your work. Thank you for being part of WeWrite—keep writing, keep earning, keep being awesome.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${createLink}" style="${emailStyles.button}">
          Keep Writing →
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center;">
        <a class="dark-link" href="${historyLink}" style="${emailStyles.link}">View your payout history</a>
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'payout-processed' });
  },
};

export const startSubscriptionTemplate: EmailTemplate = {
  id: 'start-subscription',
  name: 'Start Subscription',
  description: 'Encourages users to start a subscription and support writers they love',
  category: 'engagement',
  subject: 'Support the writers you love on WeWrite 💙',
  sampleData: {
    username: 'JohnDoe',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, emailSettingsToken }) => {
    const subscribeLink = addEmailUtm('https://getwewrite.app/settings/subscription', 'start-subscription', 'subscribe_button');
    const exploreLink = addEmailUtm('https://getwewrite.app/explore', 'start-subscription', 'explore_button');
    return wrapEmail('Support Writers You Love', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username || 'there'}, let's talk about something special</h2>

      <p class="dark-text" style="font-size: 16px;">You've been reading great content on WeWrite, and we wanted to share something with you: <strong>every page you love was written by a real person</strong> pouring their thoughts, stories, and ideas onto the screen.</p>

      <p class="dark-text">What if you could thank them—not with a like or a comment (though those are great too!), but by <strong>actually putting money in their pocket?</strong></p>

      <div class="dark-card-inner" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <p class="dark-text-heading" style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #166534;">Here's how it works:</p>
        <ol class="dark-text" style="padding-left: 20px; margin: 0; color: #15803d;">
          <li style="margin-bottom: 12px;"><strong>Pick an amount</strong> that feels right for you (starting at just $3/month)</li>
          <li style="margin-bottom: 12px;"><strong>Allocate your budget</strong> to the pages and writers you love most</li>
          <li style="margin-bottom: 12px;"><strong>Writers get paid</strong> directly from your support—no middlemen, no mystery</li>
        </ol>
      </div>

      <p class="dark-text">It's simple: <strong>you decide who deserves your support</strong>, and your subscription goes directly to the creators making WeWrite worth reading.</p>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 24px 0;">
        <p class="dark-text" style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600;">Why subscribe?</p>
        <ul class="dark-text-muted" style="padding-left: 18px; margin: 0; color: #555;">
          <li style="margin-bottom: 8px;">💚 <strong>Support creators directly</strong> — Your money goes to writers, not algorithms</li>
          <li style="margin-bottom: 8px;">✨ <strong>Encourage more great content</strong> — When writers earn, they write more</li>
          <li style="margin-bottom: 8px;">🎯 <strong>You're in control</strong> — Allocate your budget exactly how you want</li>
          <li style="margin-bottom: 8px;">❤️ <strong>Be part of something good</strong> — Help build a platform where creativity pays</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${subscribeLink}" style="${emailStyles.button}; font-size: 16px; padding: 14px 36px;">
          Start Supporting Writers →
        </a>
      </div>

      <p class="dark-text" style="text-align: center;">
        <a class="dark-link" href="${exploreLink}" style="${emailStyles.link}">Or explore pages to find writers you'll love</a>
      </p>

      <div class="dark-card-inner" style="background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 24px 0; text-align: center;">
        <p class="dark-text-muted" style="margin: 0; font-size: 14px; color: #6b7280;">
          💬 <em>Questions about subscriptions? Just reply to this email—we're here to help.</em>
        </p>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center; margin-top: 24px;">
        Every dollar you contribute makes a difference. Thank you for being part of WeWrite.
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'start-subscription' });
  },
};

export const subscriptionConfirmationTemplate: EmailTemplate = {
  id: 'subscription-confirmation',
  name: 'Subscription Confirmation',
  description: 'Sent when a user subscribes to WeWrite',
  category: 'payments',
  subject: 'You\'re officially a supporter—thank you! 💙',
  sampleData: {
    username: 'JohnDoe',
    planName: 'Monthly',
    amount: '$5.00/month',
    nextBillingDate: 'January 4, 2026',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, planName, amount, nextBillingDate, emailSettingsToken }) => {
    const startLink = addEmailUtm('https://getwewrite.app', 'subscription-confirmation', 'start_button');
    const exploreLink = addEmailUtm('https://getwewrite.app/explore', 'subscription-confirmation', 'explore_button');
    return wrapEmail('Subscription Confirmed', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username}, you just made a real difference</h2>
      <p class="dark-text" style="font-size: 16px;">Thank you for subscribing. Seriously. Your support goes directly to the writers creating the content you love—there's no middleman, no mystery. Just you helping creators get paid for their work.</p>

      <div class="dark-card-inner" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #15803d;">Your plan</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #166534;">${planName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #15803d;">Monthly contribution</td>
            <td style="padding: 8px 0; text-align: right; color: #166534;">${amount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #15803d;">Next billing</td>
            <td style="padding: 8px 0; text-align: right; color: #166534;">${nextBillingDate}</td>
          </tr>
        </table>
      </div>

      <p class="dark-text"><strong>Here's what you can do now:</strong></p>
      <ul class="dark-text" style="padding-left: 20px; margin: 20px 0;">
        <li style="margin-bottom: 8px;">🎯 <strong>Allocate your budget</strong> — Decide which pages and writers get your support</li>
        <li style="margin-bottom: 8px;">💚 <strong>Watch your impact</strong> — See how your contribution helps creators earn</li>
        <li style="margin-bottom: 8px;">✨ <strong>Discover more</strong> — Find new writers worth supporting</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${startLink}" style="${emailStyles.button}">
          Start Allocating Your Budget →
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center;">
        <a class="dark-link" href="${exploreLink}" style="${emailStyles.link}">Or explore pages to find writers you love</a>
      </p>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center; margin-top: 24px;">
        You're part of something good. Thank you for being here. 💙
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'subscription-confirmation' });
  },
};

// ============================================================================
// Engagement Templates
// ============================================================================

export const weeklyDigestTemplate: EmailTemplate = {
  id: 'weekly-digest',
  name: 'Weekly Digest',
  description: 'Weekly summary of activity and trending pages',
  category: 'engagement',
  subject: 'Your week in review—here\'s what happened',
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
  generateHtml: ({ username, pageViews, newFollowers, earningsThisWeek, trendingPages, emailSettingsToken }) => {
    const trendingLink = addEmailUtm('https://getwewrite.app/trending', 'weekly-digest', 'explore_trending_button');
    const createLink = addEmailUtm('https://getwewrite.app/new', 'weekly-digest', 'write_something_button');
    return wrapEmail('Weekly Digest', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username}, here's your week on WeWrite!</h2>
      <p class="dark-text" style="font-size: 16px;">Another week, another chance to see what your words are doing out in the world. Let's take a look:</p>

      <div style="display: flex; gap: 12px; margin: 20px 0; flex-wrap: wrap;">
        <div class="dark-stat-box" style="flex: 1; min-width: 120px; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; text-align: center;">
          <div class="dark-text-heading" style="font-size: 24px; font-weight: 700; color: #000;">${pageViews}</div>
          <div class="dark-text-muted" style="font-size: 12px; color: #666;">People Read Your Work</div>
        </div>
        <div class="dark-stat-box" style="flex: 1; min-width: 120px; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; text-align: center;">
          <div class="dark-text-heading" style="font-size: 24px; font-weight: 700; color: #000;">${newFollowers}</div>
          <div class="dark-text-muted" style="font-size: 12px; color: #666;">New Followers</div>
        </div>
        <div class="dark-stat-box" style="flex: 1; min-width: 120px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 6px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #166534;">${earningsThisWeek}</div>
          <div style="font-size: 12px; color: #15803d;">Earned This Week</div>
        </div>
      </div>

      <h3 class="dark-text-heading" style="color: #000; margin-top: 30px;">What people are reading right now 🔥</h3>
      <p class="dark-text-muted" style="margin-bottom: 16px; color: #666;">Check out what's trending—maybe you'll find some inspiration:</p>
      ${trendingPages.map((page: any) => `
        <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 12px 16px; margin: 8px 0;">
          <strong class="dark-text">${page.title}</strong>
          <span class="dark-text-muted" style="color: #666;"> by ${page.author}</span>
        </div>
      `).join('')}

      <div style="text-align: center; margin: 30px 0;">
        <a href="${createLink}" style="${emailStyles.button}">
          Write Something New →
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center;">
        <a class="dark-link" href="${trendingLink}" style="${emailStyles.link}">Explore all trending pages</a>
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'weekly-digest' });
  },
};

export const newFollowerTemplate: EmailTemplate = {
  id: 'new-follower',
  name: 'New Follower',
  description: 'Notification when someone follows the user',
  category: 'engagement',
  subject: '{{followerUsername}} is now following you!',
  sampleData: {
    username: 'JohnDoe',
    followerUsername: 'JaneSmith',
    followerBio: 'Writer and coffee enthusiast ☕',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, followerUsername, followerBio, emailSettingsToken }) => {
    const profileLink = addEmailUtm(`https://getwewrite.app/u/${followerUsername}`, 'new-follower', 'view_profile_button');
    const createLink = addEmailUtm('https://getwewrite.app/new', 'new-follower', 'write_something_button');
    return wrapEmail('New Follower', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username}, someone new is following your work!</h2>
      <p class="dark-text" style="font-size: 16px;"><strong>@${followerUsername}</strong> just hit follow—they want to see more of what you create.</p>

      ${followerBio ? `
      <div class="dark-card-inner" style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p class="dark-text-muted" style="margin: 0 0 4px 0; font-size: 12px; color: #999;">About @${followerUsername}:</p>
        <p class="dark-text" style="margin: 0; font-style: italic;">"${followerBio}"</p>
      </div>
      ` : ''}

      <p class="dark-text">Every new follower is someone who believes your words are worth reading. Keep writing—you're building something here.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${profileLink}" style="${emailStyles.button}">
          Check Out Their Profile
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center;">
        <a class="dark-link" href="${createLink}" style="${emailStyles.link}">Write something new to share with your growing audience</a>
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'new-follower' });
  },
};

export const pageLinkedTemplate: EmailTemplate = {
  id: 'page-linked',
  name: 'Page Linked',
  description: 'Notification when someone links to the user\'s page',
  category: 'engagement',
  subject: 'Someone linked to your page "{{linkedPageTitle}}"!',
  sampleData: {
    username: 'JohnDoe',
    linkedPageTitle: 'My Awesome Article',
    linkerUsername: 'JaneSmith',
    linkerPageTitle: 'Related Thoughts on Writing',
    linkerPageId: 'abc123',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, linkedPageTitle, linkerUsername, linkerPageTitle, linkerPageId, emailSettingsToken }) => {
    const pageLink = addEmailUtm(`https://getwewrite.app/${linkerPageId || ''}`, 'page-linked', 'view_page_button');
    return wrapEmail('Page Linked', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${username}, your page got some love!</h2>
      <p class="dark-text" style="font-size: 16px;"><strong>@${linkerUsername}</strong> just linked to your page "<strong>${linkedPageTitle}</strong>" in their post "<strong>${linkerPageTitle}</strong>".</p>

      <div class="dark-card-inner" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p class="dark-text" style="margin: 0; font-size: 14px; color: #334155;">
          🔗 <strong>This is great news!</strong> Links help more people discover your writing. And when more readers find your work, you can earn more. It's the WeWrite way.
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${pageLink}" style="${emailStyles.button}">
          View Page →
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center;">
        Maybe return the favor and link to one of their pages too?
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'page-linked' });
  },
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
  generateHtml: ({ username, heading, body, ctaText, ctaUrl, emailSettingsToken }) => {
    const trackedCtaUrl = ctaUrl ? addEmailUtm(ctaUrl, 'generic-notification', 'cta_button') : null;
    return wrapEmail(heading, `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">${heading}</h2>
      ${username ? `<p class="dark-text">Hi ${username},</p>` : ''}
      <p class="dark-text">${body}</p>

      ${trackedCtaUrl ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${trackedCtaUrl}" style="${emailStyles.button}">
          ${ctaText || 'Learn More'}
        </a>
      </div>
      ` : ''}
    </div>
  `, { emailSettingsToken, emailType: 'generic-notification' });
  },
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
  generateHtml: ({ username, eventType, eventDetails, eventTime }) => {
    const securityLink = addEmailUtm('https://getwewrite.app/settings/security', 'account-security', 'secure_account_button');
    return wrapEmail('Security Alert', `
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
        <a href="${securityLink}" style="background: #cc0000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 24px; display: inline-block; font-weight: 500;">
          Secure My Account
        </a>
      </div>
    </div>
  `);
  },
};

export const verifyToChooseUsernameTemplate: EmailTemplate = {
  id: 'verify-to-choose-username',
  name: 'Verify Email to Choose Username',
  description: 'For users who need both email verification AND a username - must verify first',
  category: 'authentication',
  subject: 'Verify your email to choose your WeWrite username ✉️',
  sampleData: {
    currentUsername: 'user_abc123',
    verificationLink: 'https://getwewrite.app/auth/verify-email?token=sample-token',
  },
  generateHtml: ({ currentUsername, verificationLink }) => {
    const trackedLink = addEmailUtm(verificationLink, 'verify-to-choose-username', 'verify_button');
    return wrapEmail('Verify to Choose Username', `
    <div class="dark-card" style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 class="dark-text-heading" style="margin-top: 0; color: #000;">Hey ${currentUsername || 'there'}, let's get you a proper username!</h2>
      <p class="dark-text">We noticed you're still showing up as <strong style="color: #666;">${currentUsername || 'user_...'}</strong> around WeWrite.</p>

      <p class="dark-text">Want to pick a username that's uniquely yours? There's just one quick step first:</p>

      <div class="dark-card-inner" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
        <p class="dark-text" style="margin: 0 0 8px 0; font-size: 14px; color: #0369a1;">Step 1 of 2</p>
        <p class="dark-text-heading" style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #0c4a6e;">Verify your email address</p>
        <a href="${trackedLink}" style="${emailStyles.button}">
          Verify Email
        </a>
      </div>

      <p class="dark-text">Once verified, you'll be able to:</p>
      <ul class="dark-text" style="padding-left: 20px; margin: 20px 0;">
        <li style="margin-bottom: 8px;">Choose a custom username that represents you</li>
        <li style="margin-bottom: 8px;">Secure your account and protect any future earnings</li>
        <li style="margin-bottom: 8px;">Receive notifications about followers and page links</li>
      </ul>

      <p class="dark-text-muted" style="${emailStyles.muted}">
        Or copy and paste this link into your browser:<br>
        <a class="dark-link" href="${trackedLink}" style="${emailStyles.link}; word-break: break-all;">${verificationLink}</a>
      </p>
    </div>

    <div class="dark-footer" style="${emailStyles.footer}">
      <p>If you didn't create an account on WeWrite, you can safely ignore this email.</p>
    </div>
  `);
  },
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
  generateHtml: ({ currentUsername }) => {
    const profileLink = addEmailUtm('https://getwewrite.app/settings/profile', 'choose-username', 'choose_username_button');
    return wrapEmail('Choose Your Username', `
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
        <a href="${profileLink}" style="${emailStyles.button}">
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
  `);
  },
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
  generateHtml: ({ username, daysSinceActive, emailSettingsToken }) => {
    const createLink = addEmailUtm('https://getwewrite.app/create', 'reactivation', 'start_writing_button');
    return wrapEmail('We Miss You!', `
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
        <a href="${createLink}" style="${emailStyles.button}">
          Start Writing
        </a>
      </div>

      <p class="dark-text-muted" style="${emailStyles.muted}; text-align: center;">
        Got questions or feedback? Just reply to this email—we'd love to hear from you.
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'reactivation' });
  },
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
  generateHtml: ({ username, emailSettingsToken }) => {
    const newPageLink = addEmailUtm('https://getwewrite.app/new', 'first-page-activation', 'write_first_page_button');
    return wrapEmail('Write Your First Page', `
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
        <a href="${newPageLink}" style="${emailStyles.button}; font-size: 16px; padding: 14px 36px;">
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
  `, { emailSettingsToken, emailType: 'first-page-activation' });
  },
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
    const trackedCtaUrl = ctaUrl ? addEmailUtm(ctaUrl, 'broadcast', 'cta_button') : null;
    const ctaSection = ctaText && trackedCtaUrl ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${trackedCtaUrl}" style="${emailStyles.button}">
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
  verifyToChooseUsernameTemplate,
  welcomeEmailTemplate,
  passwordResetEmailTemplate,
  // Payments
  payoutSetupReminderTemplate,
  firstEarningsTemplate,
  halfwayToPayoutTemplate,
  payoutProcessedTemplate,
  subscriptionConfirmationTemplate,
  // Engagement
  startSubscriptionTemplate,
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

// Template ID aliases for backwards compatibility
// Maps legacy/alternate IDs to canonical template IDs
const templateIdAliases: Record<string, string> = {
  'email-verification-reminder': 'verification-reminder',
};

export const getTemplateById = (id: string): EmailTemplate | undefined => {
  // Check for alias first
  const canonicalId = templateIdAliases[id] || id;
  return emailTemplates.find(t => t.id === canonicalId);
};

export const getTemplatesByCategory = (category: EmailTemplate['category']): EmailTemplate[] => {
  return emailTemplates.filter(t => t.category === category);
};
