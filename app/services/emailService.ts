/**
 * Email Service
 * 
 * Centralized email sending service that can be easily switched between providers.
 * Currently uses Firebase's built-in email, but can be switched to SendGrid.
 * 
 * SETUP FOR SENDGRID:
 * 1. Install: pnpm add @sendgrid/mail
 * 2. Add to .env: SENDGRID_API_KEY=your_api_key
 * 3. Set USE_SENDGRID=true below
 * 4. Customize email templates as needed
 */

// Toggle this to switch email providers
const USE_SENDGRID = false;

// SendGrid configuration (uncomment when ready)
// import sgMail from '@sendgrid/mail';
// if (process.env.SENDGRID_API_KEY) {
//   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// }

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface VerificationEmailOptions {
  to: string;
  verificationLink: string;
  username?: string;
}

/**
 * Send a verification email
 * 
 * When USE_SENDGRID is false:
 *   - Uses Firebase's sendEmailVerification() on the client side
 *   - This function is just a placeholder
 * 
 * When USE_SENDGRID is true:
 *   - Sends a custom branded email via SendGrid
 */
export const sendVerificationEmail = async (options: VerificationEmailOptions): Promise<boolean> => {
  if (!USE_SENDGRID) {
    // Firebase handles this via client-side sendEmailVerification()
    console.log('[EmailService] Using Firebase built-in email verification');
    return true;
  }

  // SendGrid implementation (uncomment when ready)
  /*
  try {
    const { to, verificationLink, username } = options;
    
    const msg = {
      to,
      from: {
        email: 'noreply@getwewrite.app',
        name: 'WeWrite'
      },
      subject: 'Verify your WeWrite email',
      text: `Hi ${username || 'there'},\n\nPlease verify your email by clicking this link: ${verificationLink}\n\nIf you didn't create an account, you can ignore this email.\n\nThanks,\nThe WeWrite Team`,
      html: generateVerificationEmailHtml(verificationLink, username),
    };

    await sgMail.send(msg);
    console.log('[EmailService] Verification email sent via SendGrid to:', to);
    return true;
  } catch (error) {
    console.error('[EmailService] SendGrid error:', error);
    return false;
  }
  */

  return false;
};

/**
 * Generate HTML for verification email
 * Customize this template for your brand
 */
const generateVerificationEmailHtml = (verificationLink: string, username?: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - WeWrite</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #000; margin: 0;">WeWrite</h1>
      </div>
      
      <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
        <h2 style="margin-top: 0;">Verify Your Email</h2>
        <p>Hi ${username || 'there'},</p>
        <p>Thanks for signing up for WeWrite! Please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
            Verify Email
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666;">
          Or copy and paste this link into your browser:<br>
          <a href="${verificationLink}" style="color: #0066cc; word-break: break-all;">${verificationLink}</a>
        </p>
      </div>
      
      <div style="text-align: center; font-size: 12px; color: #999;">
        <p>If you didn't create an account on WeWrite, you can safely ignore this email.</p>
        <p>© ${new Date().getFullYear()} WeWrite. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send a generic email (for future use)
 */
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  if (!USE_SENDGRID) {
    console.log('[EmailService] SendGrid not enabled, email not sent');
    return false;
  }

  // SendGrid implementation (uncomment when ready)
  /*
  try {
    const msg = {
      to: options.to,
      from: {
        email: 'noreply@getwewrite.app',
        name: 'WeWrite'
      },
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    await sgMail.send(msg);
    console.log('[EmailService] Email sent via SendGrid to:', options.to);
    return true;
  } catch (error) {
    console.error('[EmailService] SendGrid error:', error);
    return false;
  }
  */

  return false;
};

export default {
  sendVerificationEmail,
  sendEmail,
  USE_SENDGRID,
};
