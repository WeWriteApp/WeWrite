import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeByToken, validateEmailSettingsToken, buildEmailSettingsUrl } from '../../../services/emailSettingsTokenService';

/**
 * GET /api/email/unsubscribe?token=xxx&type=weekly-digest
 * One-click unsubscribe endpoint for email links
 *
 * This endpoint handles the one-click unsubscribe action and redirects
 * the user to the email preferences page where they can see and manage
 * all their preferences.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const emailType = searchParams.get('type');

    if (!token) {
      return new NextResponse(
        renderUnsubscribePage({
          success: false,
          error: 'Missing token',
          message: 'This unsubscribe link is invalid or has expired.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    if (!emailType) {
      return new NextResponse(
        renderUnsubscribePage({
          success: false,
          error: 'Missing email type',
          message: 'This unsubscribe link is missing required information.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    // Perform the unsubscribe
    const result = await unsubscribeByToken(token, emailType);

    if (!result.success) {
      return new NextResponse(
        renderUnsubscribePage({
          success: false,
          error: result.error || 'Unknown error',
          message: 'Unable to process your unsubscribe request. The link may have expired.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    // Get user data to show which account was updated
    const userData = await validateEmailSettingsToken(token);
    const preferencesUrl = buildEmailSettingsUrl(token, emailType);

    // Return a success page with link to manage all preferences
    return new NextResponse(
      renderUnsubscribePage({
        success: true,
        emailType,
        preferencesUrl,
        username: userData?.username,
        email: userData?.email,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );

  } catch (error) {
    console.error('[API] Error processing unsubscribe:', error);
    return new NextResponse(
      renderUnsubscribePage({
        success: false,
        error: 'Internal error',
        message: 'Something went wrong. Please try again later.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

/**
 * POST /api/email/unsubscribe
 * API version of unsubscribe for programmatic access
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, type } = body;

    if (!token || !type) {
      return NextResponse.json(
        { success: false, error: 'Token and type are required' },
        { status: 400 }
      );
    }

    const result = await unsubscribeByToken(token, type);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API] Error processing unsubscribe:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper to render the unsubscribe response page
function renderUnsubscribePage(options: {
  success: boolean;
  error?: string;
  message?: string;
  emailType?: string;
  preferencesUrl?: string;
  username?: string;
  email?: string;
}): string {
  const { success, error, message, emailType, preferencesUrl, username, email } = options;

  // Map email types to human-readable names
  const emailTypeNames: Record<string, string> = {
    'weekly-digest': 'Weekly Digest',
    'new-follower': 'New Follower Notifications',
    'page-linked': 'Page Link Notifications',
    'payout-reminder': 'Payout Reminders',
    'payout-processed': 'Payment Receipts',
    'product-update': 'Product Updates',
    'earnings-summary': 'Earnings Summary',
    'tips': 'Tips & Writing Prompts',
    'comments': 'Comment Notifications',
    'mentions': 'Mention Notifications',
    'all': 'All Non-Essential Emails',
  };

  const emailTypeName = emailType ? (emailTypeNames[emailType] || emailType) : 'this type of email';
  const accountInfo = username ? `@${username}` : email || 'your account';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? 'Unsubscribed' : 'Unsubscribe Error'} - WeWrite</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f9fafb;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      padding: 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-success {
      background-color: #dcfce7;
      color: #16a34a;
    }
    .icon-error {
      background-color: #fee2e2;
      color: #dc2626;
    }
    .icon svg {
      width: 32px;
      height: 32px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 12px;
    }
    .message {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .account-info {
      background-color: #f3f4f6;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 14px;
      color: #374151;
      margin-bottom: 24px;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #1d4ed8;
    }
    .secondary-link {
      display: block;
      margin-top: 16px;
      color: #6b7280;
      font-size: 14px;
      text-decoration: none;
    }
    .secondary-link:hover {
      color: #2563eb;
    }
  </style>
</head>
<body>
  <div class="container">
    ${success ? `
      <div class="icon icon-success">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1>Unsubscribed</h1>
      <p class="message">
        You've been unsubscribed from <strong>${emailTypeName}</strong>.
        You won't receive these emails anymore.
      </p>
      <div class="account-info">
        Updated preferences for ${accountInfo}
      </div>
      ${preferencesUrl ? `
        <a href="${preferencesUrl}" class="button">Manage All Email Preferences</a>
        <a href="https://getwewrite.app" class="secondary-link">Go to WeWrite</a>
      ` : ''}
    ` : `
      <div class="icon icon-error">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h1>Unable to Unsubscribe</h1>
      <p class="message">${message || 'Something went wrong processing your request.'}</p>
      <a href="https://getwewrite.app/settings/email-preferences" class="button">
        Log In to Manage Preferences
      </a>
    `}
  </div>
</body>
</html>
  `.trim();
}
