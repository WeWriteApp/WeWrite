# Email System Implementation Guide

## Overview

WeWrite uses [Resend](https://resend.com) for transactional email delivery. All email templates are defined in `/app/lib/emailTemplates.ts` and the service functions are in `/app/services/emailService.ts`.

## Email Templates & Triggers

### 1. ✅ Verification Email
- **Template**: `verificationEmailTemplate`
- **Trigger**: Firebase Client SDK `sendEmailVerification()`
- **Status**: Handled by Firebase Auth directly

### 2. ✅ Welcome Email
- **Template**: `welcomeEmailTemplate`
- **Trigger**: User registration flow
- **Function**: `sendWelcomeEmail()`
- **File**: `app/api/auth/register/route.ts` or client-side registration

### 3. ✅ Password Reset Email
- **Template**: Handled by Firebase
- **Trigger**: Firebase REST API `sendOobCode`
- **Status**: Sent via Firebase Auth directly

### 4. ✅ New Follower Email
- **Template**: `newFollowerTemplate`
- **Trigger**: When user follows another user
- **Function**: `sendNewFollowerEmail()`
- **File**: `app/api/follows/users/route.ts`
- **Condition**: Target user has `emailPreferences.newFollower !== false`

### 5. ✅ Subscription Confirmation Email
- **Template**: `subscriptionConfirmationTemplate`
- **Trigger**: Stripe webhook `payment_intent.succeeded`
- **Function**: `sendSubscriptionConfirmation()`
- **File**: `app/api/webhooks/stripe-subscription/route.ts`

### 6. ✅ Payout Processed Email
- **Template**: `payoutProcessedTemplate`
- **Trigger**: After successful payout processing
- **Function**: `sendPayoutProcessed()`
- **File**: `app/services/payoutServiceUnified.ts`
- **Condition**: Payout completes successfully

### 7. ✅ Payout Setup Reminder Email
- **Template**: `payoutSetupReminderTemplate`
- **Trigger**: Manual or cron job
- **Function**: `sendPayoutReminder()`
- **File**: Can be triggered from admin or cron

### 8. ✅ Weekly Digest Email
- **Template**: `weeklyDigestTemplate`
- **Trigger**: Weekly cron job (Mondays at 10 AM UTC)
- **Function**: `sendTemplatedEmail({ templateId: 'weekly-digest', ... })`
- **File**: `app/api/cron/weekly-digest/route.ts`
- **Vercel Cron**: `"0 10 * * 1"`
- **Content**: Page views, new followers, earnings, trending pages

### 9. ✅ Page Linked Email
- **Template**: `pageLinkedTemplate`
- **Trigger**: When a user links to another user's page in their content
- **Function**: `sendPageLinkedEmail()`
- **File**: `app/firebase/database/backlinks.ts` (in `sendPageLinkedEmails()`)
- **Condition**: Target user has `emailPreferences.engagement !== false`

### 10. ✅ Choose Username Reminder Email
- **Template**: `chooseUsernameTemplate`
- **Trigger**: Daily cron job (2 PM UTC)
- **Function**: `sendTemplatedEmail({ templateId: 'choose-username', ... })`
- **File**: `app/api/cron/username-reminder/route.ts`
- **Vercel Cron**: `"0 14 * * *"`
- **Targets**: Users 1-7 days old with `user_*` usernames

### 11. ✅ Security Alert Email
- **Template**: `accountSecurityTemplate`
- **Trigger**: New device login detected
- **Function**: `sendSecurityAlert()`
- **File**: `app/api/auth/session/route.ts` (in `createUserSession()`)
- **Condition**: User has `emailPreferences.securityAlerts !== false`
- **Detection**: Compares device info with existing active sessions

### 12. ✅ Email Verification Reminder
- **Template**: `emailVerificationReminderTemplate`
- **Trigger**: Daily cron job (4 PM UTC)
- **Function**: `sendTemplatedEmail({ templateId: 'email-verification-reminder', ... })`
- **File**: `app/api/cron/email-verification-reminder/route.ts`
- **Vercel Cron**: `"0 16 * * *"`
- **Targets**: Users with unverified emails, 1-7 days old

### 13. ✅ Payout Setup Reminder
- **Template**: `payoutSetupReminderTemplate`
- **Trigger**: Daily cron job (3 PM UTC)
- **Function**: `sendTemplatedEmail({ templateId: 'payout-setup-reminder', ... })`
- **File**: `app/api/cron/payout-setup-reminder/route.ts`
- **Vercel Cron**: `"0 15 * * *"`
- **Targets**: Creators with earnings but no payout setup

### 14. ✅ Reactivation Email
- **Template**: `reactivationEmailTemplate`
- **Trigger**: Weekly cron job (Mondays at 4 PM UTC)
- **Function**: `sendTemplatedEmail({ templateId: 'reactivation', ... })`
- **File**: `app/api/cron/reactivation/route.ts`
- **Vercel Cron**: `"0 16 * * 1"`
- **Targets**: Users inactive for 14+ days

### 15. ✅ First Earnings Email
- **Template**: `firstEarningsTemplate`
- **Trigger**: When user receives their first allocation
- **Function**: `sendFirstEarningsEmail()`
- **File**: `app/services/emailService.ts`

### 16. ✅ Halfway to Payout Email
- **Template**: `halfwayToPayoutTemplate`
- **Trigger**: When user reaches 50% of minimum payout threshold
- **Function**: `sendHalfwayToPayoutEmail()`
- **File**: `app/services/emailService.ts`

### 17. Generic Notification Email
- **Template**: `genericNotificationTemplate`
- **Trigger**: Manual/various
- **Function**: `sendGenericNotification()`
- **Status**: Available for custom notifications

### 13. Broadcast Email
- **Template**: `broadcastTemplate`
- **Trigger**: Admin broadcast
- **Function**: `sendBroadcastEmail()`
- **Status**: Available for admin broadcasts

## Email Preferences

Users can control which emails they receive via settings at `/settings/email-preferences`.

### Preference Fields (in `users` collection):
```typescript
interface EmailPreferences {
  securityAlerts: boolean;      // Security alerts (default: true)
  loginNotifications: boolean;  // Login notifications (default: true)
  newFollower: boolean;         // New follower notifications (default: true)
  pageComments: boolean;        // Page comments (default: true)
  pageMentions: boolean;        // Page mentions/links (default: true)
  payoutReminders: boolean;     // Payout setup reminders (default: true)
  paymentReceipts: boolean;     // Payment receipts (default: true)
  earningsSummary: boolean;     // Earnings summary (default: true)
  weeklyDigest: boolean;        // Weekly digest (default: true)
  productUpdates: boolean;      // Product updates (default: true)
  tipsAndTricks: boolean;       // Tips & tricks (default: false)
}
```

## Cron Jobs

### Current Cron Schedule (vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/usd/process-writer-earnings",
      "schedule": "0 8 1 * *"  // 1st of month, 8 AM UTC
    },
    {
      "path": "/api/cron/automated-payouts",
      "schedule": "0 9 1 * *"  // 1st of month, 9 AM UTC
    },
    {
      "path": "/api/cron/weekly-digest",
      "schedule": "0 10 * * 1" // Mondays at 10 AM UTC
    },
    {
      "path": "/api/cron/username-reminder",
      "schedule": "0 14 * * *" // Daily at 2 PM UTC
    },
    {
      "path": "/api/cron/payout-setup-reminder",
      "schedule": "0 15 * * *" // Daily at 3 PM UTC
    },
    {
      "path": "/api/cron/email-verification-reminder",
      "schedule": "0 16 * * *" // Daily at 4 PM UTC
    },
    {
      "path": "/api/cron/reactivation",
      "schedule": "0 16 * * 1" // Mondays at 4 PM UTC
    }
  ]
}
```

### Cron Authentication

All cron routes verify the request using:
- `CRON_SECRET` environment variable
- `CRON_API_KEY` environment variable (alternative)
- Bearer token in `Authorization` header

Example verification:
```typescript
const authHeader = request.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;
const isAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
```

## Email Logging

All sent emails are logged to Firestore in the `emailLogs` collection (or `DEV_emailLogs` in development):

```typescript
interface EmailLog {
  templateId: string;
  templateName: string;
  recipientEmail: string;
  recipientUserId?: string;
  recipientUsername?: string;
  subject: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
  resendId?: string;
  metadata?: Record<string, any>;
  sentAt: string;
}
```

## Testing

### Test Email Script
Run the test script to verify Resend configuration:
```bash
bun run scripts/test-email.ts
```

### Manual Testing
Call cron endpoints directly (requires auth):
```bash
curl -X GET "http://localhost:3000/api/cron/weekly-digest" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Environment Variables

Required for email functionality:
- `RESEND_API_KEY` - Resend API key
- `CRON_SECRET` or `CRON_API_KEY` - For cron job authentication
- `NEXT_PUBLIC_APP_URL` - Base URL for links in emails (e.g., `https://wewrite.co`)

## Implementation Notes

### Rate Limiting
- Cron jobs include `await new Promise(resolve => setTimeout(resolve, 100))` between batches
- Resend has rate limits - respect them for bulk sends

### Error Handling
- All email sends are wrapped in try/catch
- Failures are logged but don't break main functionality
- Non-critical emails (notifications) fail silently

### Server-Side Only
- Email sends happen server-side to protect API keys
- Backlinks page-linked emails triggered from API route (server context)
- Security alerts triggered from session creation (server context)

## Future Improvements

1. **Email Unsubscribe Links** - One-click unsubscribe per email type
2. **Email Preview in Admin** - Preview templates before sending
3. **Scheduled Emails** - Queue emails for future delivery
4. **Email Analytics** - Track open rates, click rates
5. **Bulk Email Admin** - Admin interface for broadcasts
