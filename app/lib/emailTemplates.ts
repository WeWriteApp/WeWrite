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
    background: #000;
    color: #fff;
    padding: 12px 30px;
    text-decoration: none;
    border-radius: 6px;
    display: inline-block;
    font-weight: 500;
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

// Base wrapper for all emails
const wrapEmail = (title: string, content: string, footerOptions?: EmailFooterOptions): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - WeWrite</title>
</head>
<body style="${emailStyles.base} max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <div style="text-align: center; margin-bottom: 30px;">
    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
      <tr>
        <td style="vertical-align: middle; padding-right: 12px;">
          <img src="https://getwewrite.app/icons/icon-192x192.png" alt="WeWrite" width="44" height="44" style="display: block; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
        </td>
        <td style="vertical-align: middle;">
          <h1 style="color: #000; margin: 0; font-size: 28px; font-weight: 600;">WeWrite</h1>
        </td>
      </tr>
    </table>
  </div>
  ${content}
  <div style="${emailStyles.footer}">
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
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">Verify Your Email</h2>
      <p>Hi ${username || 'there'},</p>
      <p>Thanks for signing up for WeWrite! Please verify your email address by clicking the button below:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" style="${emailStyles.button}">
          Verify Email
        </a>
      </div>
      
      <p style="${emailStyles.muted}">
        Or copy and paste this link into your browser:<br>
        <a href="${verificationLink}" style="${emailStyles.link}; word-break: break-all;">${verificationLink}</a>
      </p>
    </div>
    
    <div style="${emailStyles.footer}">
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
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">Welcome to WeWrite! 🎉</h2>
      <p>Hi ${username},</p>
      <p>We're thrilled to have you join our community of writers and collaborators!</p>
      
      <p><strong>Here's how to get started:</strong></p>
      <ul style="padding-left: 20px; margin: 20px 0;">
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
    
    <div style="${emailStyles.footer}">
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
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">Reset Your Password</h2>
      <p>Hi ${username || 'there'},</p>
      <p>You requested to reset the password for <strong>${email}</strong>.</p>
      <p>Click the button below to set a new password:</p>
      
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
      
      <p style="${emailStyles.muted}">
        This link will expire in 1 hour.<br><br>
        If the button above doesn't work, copy and paste this link into your browser:<br>
        <span style="color: #0066cc; word-break: break-all;">${resetLink}</span>
      </p>
    </div>
    
    <div style="${emailStyles.footer}">
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
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">You Have Earnings Waiting! 💰</h2>
      <p>Hi ${username},</p>
      <p>Great news! You've earned <strong>${pendingEarnings}</strong> on WeWrite from readers supporting your pages.</p>
      <p>To receive your earnings, you'll need to set up your payout method. It only takes a few minutes!</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/settings/payouts" style="${emailStyles.button}">
          Set Up Payouts
        </a>
      </div>
      
      <div style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #666;">
          <strong>Why set up payouts?</strong><br>
          Once configured, you'll automatically receive your earnings at the end of each month. We use Stripe for secure, fast transfers.
        </p>
      </div>
    </div>
  `, { emailSettingsToken, emailType: 'payout-reminder' }),
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
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">Payout Processed! 🎉</h2>
      <p>Hi ${username},</p>
      <p>We've processed your payout of <strong>${amount}</strong>.</p>
      
      <div style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Amount</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${amount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Processed on</td>
            <td style="padding: 8px 0; text-align: right;">${processingDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Expected arrival</td>
            <td style="padding: 8px 0; text-align: right;">${arrivalDate}</td>
          </tr>
        </table>
      </div>
      
      <p style="${emailStyles.muted}">
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
  },
  generateHtml: ({ username, planName, amount, nextBillingDate }) => wrapEmail('Subscription Confirmed', `
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">Welcome to WeWrite Premium! ✨</h2>
      <p>Hi ${username},</p>
      <p>Thank you for subscribing! Your support helps keep WeWrite running and enables us to pay writers like you.</p>
      
      <div style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Plan</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${planName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Amount</td>
            <td style="padding: 8px 0; text-align: right;">${amount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Next billing</td>
            <td style="padding: 8px 0; text-align: right;">${nextBillingDate}</td>
          </tr>
        </table>
      </div>
      
      <p><strong>What you can do now:</strong></p>
      <ul style="padding-left: 20px; margin: 20px 0;">
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
  `),
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
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">Your Week on WeWrite 📚</h2>
      <p>Hi ${username},</p>
      <p>Here's what happened this week:</p>
      
      <div style="display: flex; gap: 12px; margin: 20px 0; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 120px; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #000;">${pageViews}</div>
          <div style="font-size: 12px; color: #666;">Page Views</div>
        </div>
        <div style="flex: 1; min-width: 120px; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #000;">${newFollowers}</div>
          <div style="font-size: 12px; color: #666;">New Followers</div>
        </div>
        <div style="flex: 1; min-width: 120px; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #000;">${earningsThisWeek}</div>
          <div style="font-size: 12px; color: #666;">Earned</div>
        </div>
      </div>
      
      <h3 style="color: #000; margin-top: 30px;">Trending This Week 🔥</h3>
      ${trendingPages.map((page: any) => `
        <div style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 12px 16px; margin: 8px 0;">
          <strong>${page.title}</strong>
          <span style="color: #666;"> by ${page.author}</span>
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
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">New Follower! 🎉</h2>
      <p>Hi ${username},</p>
      <p><strong>@${followerUsername}</strong> is now following you on WeWrite.</p>

      ${followerBio ? `
      <div style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; font-style: italic; color: #666;">"${followerBio}"</p>
      </div>
      ` : ''}

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/user/${followerUsername}" style="${emailStyles.button}">
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
  subject: 'Someone linked to your page on WeWrite! 🔗',
  sampleData: {
    username: 'JohnDoe',
    linkedPageTitle: 'My Awesome Article',
    linkerUsername: 'JaneSmith',
    linkerPageTitle: 'Related Thoughts on Writing',
    emailSettingsToken: 'sample-token-123',
  },
  generateHtml: ({ username, linkedPageTitle, linkerUsername, linkerPageTitle, emailSettingsToken }) => wrapEmail('Page Linked', `
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">Your Page Was Linked! 🔗</h2>
      <p>Hi ${username},</p>
      <p><strong>@${linkerUsername}</strong> linked to your page "<strong>${linkedPageTitle}</strong>" in their page "<strong>${linkerPageTitle}</strong>".</p>

      <p style="${emailStyles.muted}">
        When others link to your pages, it helps more people discover your writing and can increase your earnings!
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app" style="${emailStyles.button}">
          View on WeWrite
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
  },
  generateHtml: ({ username, heading, body, ctaText, ctaUrl }) => wrapEmail(heading, `
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">${heading}</h2>
      ${username ? `<p>Hi ${username},</p>` : ''}
      <p>${body}</p>
      
      ${ctaUrl ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${ctaUrl}" style="${emailStyles.button}">
          ${ctaText || 'Learn More'}
        </a>
      </div>
      ` : ''}
    </div>
  `),
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
    <div style="background: #fff4f4; border: 1px solid #ffcccc; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #cc0000;">🔒 ${eventType}</h2>
      <p>Hi ${username},</p>
      <p>We detected the following activity on your account:</p>
      
      <div style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;"><strong>${eventType}</strong></p>
        <p style="margin: 0 0 8px 0; color: #666;">${eventDetails}</p>
        <p style="margin: 0; color: #999; font-size: 12px;">${eventTime}</p>
      </div>
      
      <p style="${emailStyles.muted}">
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
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">Make Your Mark on WeWrite ✏️</h2>
      <p>Hey there!</p>
      <p>We noticed you haven't chosen a username yet. Right now you're showing up as <strong style="color: #666;">${currentUsername || 'user_...'}</strong> around the platform.</p>

      <p>A great username helps you:</p>
      <ul style="padding-left: 20px; margin: 20px 0;">
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

      <div style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #666;">
          <strong>💡 Tips for a great username:</strong><br>
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
    <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #000;">Hey ${username || 'there'}, we've missed you!</h2>
      <p>It's been a little quiet on your WeWrite profile lately, and we wanted to check in.</p>

      <p>Here's the thing: <strong>every page you write on WeWrite can earn you real money</strong>. When subscribers allocate their monthly budget to pages they love, creators like you get paid.</p>

      <div style="background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 12px 0; font-size: 15px; color: #333;">
          <strong>Why come back?</strong>
        </p>
        <ul style="padding-left: 18px; margin: 0; color: #555;">
          <li style="margin-bottom: 8px;">Write about anything you're passionate about</li>
          <li style="margin-bottom: 8px;">Earn money when readers support your work</li>
          <li style="margin-bottom: 8px;">Connect with other writers and build your audience</li>
          <li style="margin-bottom: 8px;">No minimum—every allocation counts</li>
        </ul>
      </div>

      <p style="color: #555;">Your next great idea could be the one that resonates with readers. Why not give it a shot?</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://getwewrite.app/create" style="${emailStyles.button}">
          Start Writing
        </a>
      </div>

      <p style="${emailStyles.muted}; text-align: center;">
        Got questions or feedback? Just reply to this email—we'd love to hear from you.
      </p>
    </div>
  `, { emailSettingsToken, emailType: 'reactivation' }),
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
  },
  generateHtml: ({ subject, heading, body, ctaText, ctaUrl, recipientEmail }) => {
    const baseUrl = 'https://getwewrite.app';
    const unsubscribeUrl = `${baseUrl}/settings?tab=notifications&email=${encodeURIComponent(recipientEmail || '')}`;
    
    const ctaSection = ctaText && ctaUrl ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${ctaUrl}" style="${emailStyles.button}">
          ${ctaText}
        </a>
      </div>
    ` : '';
    
    return wrapEmail(subject || 'Update from WeWrite', `
      <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
        <h2 style="margin-top: 0; color: #000;">${heading}</h2>
        <div style="color: #333; line-height: 1.7;">
          ${body}
        </div>
        ${ctaSection}
      </div>
      <div style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">
        <p>You're receiving this because you have an account at WeWrite.</p>
        <p><a href="${unsubscribeUrl}" style="color: #999;">Manage email preferences</a></p>
      </div>
    `);
  },
};

// ============================================================================
// Export All Templates
// ============================================================================

export const emailTemplates: EmailTemplate[] = [
  // Authentication
  verificationEmailTemplate,
  welcomeEmailTemplate,
  passwordResetEmailTemplate,
  // Payments
  payoutSetupReminderTemplate,
  payoutProcessedTemplate,
  subscriptionConfirmationTemplate,
  // Engagement
  weeklyDigestTemplate,
  newFollowerTemplate,
  pageLinkedTemplate,
  chooseUsernameTemplate,
  reactivationTemplate,
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
