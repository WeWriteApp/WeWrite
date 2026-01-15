# Email Rate Limiting & Batch Scheduling System

## Overview

WeWrite uses Resend for transactional emails. The free tier has strict limits:
- **Daily limit**: 100 emails/day
- **Monthly limit**: 3,000 emails/month

This document describes the rate limiting system that ensures we stay within these limits by:
1. Tracking daily email usage in Firestore
2. Using Resend's scheduled sending to spread emails across multiple days
3. Prioritizing time-sensitive emails over bulk/engagement emails

## Architecture

### Email Priority Tiers

| Priority | Type | Examples | Behavior |
|----------|------|----------|----------|
| **P0 - Critical** | Transactional | Password reset, email verification, security alerts | Always send immediately, never defer |
| **P1 - Time-Sensitive** | User-triggered | New follower, page linked, subscription confirmation | Send if quota available, otherwise schedule for next day |
| **P2 - Engagement** | Cron-triggered | Weekly digest, first page activation, username reminder | Schedule across multiple days to stay under limits |
| **P3 - Win-back** | Reactivation | Reactivation emails | Already scheduled 2 days out, lowest priority |

### Daily Quota Allocation

With 100 emails/day limit:

| Priority | Reserved Quota | Notes |
|----------|----------------|-------|
| P0 (Critical) | 30/day | Always available, never blocked |
| P1 (Time-sensitive) | 40/day | Real-time notifications |
| P2 (Engagement) | 25/day | Cron jobs spread across days |
| P3 (Win-back) | 5/day | Low volume, already scheduled |
| **Buffer** | 0 | No buffer - we use scheduling |

### Firestore Tracking Collection

Collection: `emailRateLimits` (or `DEV_emailRateLimits` in development)

```typescript
interface DailyEmailUsage {
  date: string;              // YYYY-MM-DD format
  p0Sent: number;            // Critical emails sent
  p1Sent: number;            // Time-sensitive emails sent
  p2Sent: number;            // Engagement emails sent
  p3Sent: number;            // Win-back emails sent
  totalSent: number;         // Total for the day
  lastUpdatedAt: Timestamp;  // Last update time
}

// Monthly tracking
interface MonthlyEmailUsage {
  month: string;             // YYYY-MM format
  totalSent: number;         // Running total for month
  byDay: Record<string, number>; // Daily breakdown
  lastUpdatedAt: Timestamp;
}
```

## Implementation

### 1. Email Rate Limit Service

New service: `app/services/emailRateLimitService.ts`

```typescript
// Configuration
const DAILY_LIMITS = {
  total: 100,
  p0: 30,  // Critical - password reset, verification, security
  p1: 40,  // Time-sensitive - notifications
  p2: 25,  // Engagement - cron emails
  p3: 5,   // Win-back - reactivation
};

const MONTHLY_LIMIT = 3000;

// Core functions
async function canSendEmail(priority: 0 | 1 | 2 | 3): Promise<{
  canSend: boolean;
  reason?: string;
  suggestedScheduleDate?: string;
}>;

async function recordEmailSent(priority: 0 | 1 | 2 | 3): Promise<void>;

async function getDailyUsage(date?: string): Promise<DailyEmailUsage>;

async function getMonthlyUsage(month?: string): Promise<MonthlyEmailUsage>;

async function getNextAvailableSlot(priority: 0 | 1 | 2 | 3): Promise<string>;
```

### 2. Updated Email Service Integration

Modify `sendTemplatedEmail` to check rate limits:

```typescript
export const sendTemplatedEmail = async (options: {
  templateId: string;
  to: string;
  data: Record<string, any>;
  userId?: string;
  scheduledAt?: string;
  triggerSource?: EmailTriggerSource;
  priority?: 0 | 1 | 2 | 3;  // NEW: Email priority
}): Promise<{ success: boolean; resendId?: string; error?: string; scheduled?: boolean; scheduledFor?: string }> => {

  const priority = options.priority ?? getPriorityForTemplate(templateId);

  // Check if we can send now
  const { canSend, suggestedScheduleDate } = await canSendEmail(priority);

  if (!canSend && priority === 0) {
    // P0 emails always send - critical path
    // Log warning but proceed
    console.warn('[Email] Sending P0 email despite quota - critical');
  } else if (!canSend) {
    // Schedule for future delivery
    const scheduleDate = suggestedScheduleDate || getNextAvailableSlot(priority);
    options.scheduledAt = scheduleDate;
  }

  // ... rest of send logic

  // Record the send
  await recordEmailSent(priority);
};
```

### 3. Template Priority Mapping

```typescript
const TEMPLATE_PRIORITIES: Record<string, 0 | 1 | 2 | 3> = {
  // P0 - Critical (always send)
  'verification': 0,
  'password-reset': 0,
  'account-security': 0,

  // P1 - Time-sensitive (send if quota, else schedule next day)
  'new-follower': 1,
  'page-linked': 1,
  'subscription-confirmation': 1,
  'payout-processed': 1,
  'welcome': 1,

  // P2 - Engagement (spread across days via scheduling)
  'weekly-digest': 2,
  'first-page-activation': 2,
  'username-reminder': 2,
  'choose-username': 2,
  'payout-setup-reminder': 2,
  'email-verification-reminder': 2,

  // P3 - Win-back (already uses scheduled sending)
  'reactivation': 3,
};
```

### 4. Cron Job Updates

Each cron job will be updated to:

1. **Check available quota** before processing
2. **Use batch scheduling** to spread emails across multiple days
3. **Track progress** in Firestore to resume if interrupted

Example for weekly digest:

```typescript
// In weekly-digest/route.ts
export async function GET(request: NextRequest) {
  // Get available P2 quota for today
  const todayUsage = await getDailyUsage();
  const availableToday = DAILY_LIMITS.p2 - todayUsage.p2Sent;

  // Query eligible users
  const eligibleUsers = await getEligibleDigestUsers();

  // Calculate how many days needed
  const totalToSend = eligibleUsers.length;
  const daysNeeded = Math.ceil(totalToSend / DAILY_LIMITS.p2);

  // Schedule emails across days
  for (let i = 0; i < eligibleUsers.length; i++) {
    const dayOffset = Math.floor(i / DAILY_LIMITS.p2);
    const scheduleDate = addDays(new Date(), dayOffset);

    await sendTemplatedEmail({
      templateId: 'weekly-digest',
      to: user.email,
      data: { ... },
      scheduledAt: dayOffset === 0 ? undefined : scheduleDate.toISOString(),
      priority: 2,
    });
  }

  return NextResponse.json({
    scheduled: totalToSend,
    daysSpread: daysNeeded,
  });
}
```

## Cron Schedule Optimization

Current schedule (all times UTC):

| Time | Cron Job | Typical Volume | Priority |
|------|----------|----------------|----------|
| Sun 10:00 | Weekly Digest | ~100-1000 | P2 |
| Daily 13:00 | First Page Activation | ~10-50 | P2 |
| Daily 14:00 | Username Reminder | ~10-50 | P2 |
| Daily 15:00 | Payout Setup Reminder | ~5-20 | P2 |
| Daily 16:00 | Email Verification Reminder | ~10-50 | P2 |
| Mon 16:00 | Reactivation | ~10-100 | P3 |

### Recommended Schedule Changes

Spread crons throughout the day and week:

| Day | Time (UTC) | Cron Job | Max Emails |
|-----|------------|----------|------------|
| Mon | 10:00 | Weekly Digest (batch 1/7) | 25 |
| Mon | 16:00 | Reactivation | 5 |
| Tue | 10:00 | Weekly Digest (batch 2/7) | 25 |
| Tue | 14:00 | First Page Activation | 25 |
| Wed | 10:00 | Weekly Digest (batch 3/7) | 25 |
| Wed | 14:00 | Username Reminder | 25 |
| Thu | 10:00 | Weekly Digest (batch 4/7) | 25 |
| Thu | 14:00 | Email Verification Reminder | 25 |
| Fri | 10:00 | Weekly Digest (batch 5/7) | 25 |
| Fri | 14:00 | Payout Setup Reminder | 25 |
| Sat | 10:00 | Weekly Digest (batch 6/7) | 25 |
| Sun | 10:00 | Weekly Digest (batch 7/7) | 25 |

## Admin Dashboard Integration

Add to `/admin/notifications` or create `/admin/email-quota`:

```typescript
interface EmailQuotaDashboard {
  today: {
    sent: number;
    remaining: number;
    byPriority: { p0: number; p1: number; p2: number; p3: number };
  };
  thisMonth: {
    sent: number;
    remaining: number;
    projectedEnd: number;
  };
  scheduled: {
    pending: number;
    nextBatch: string;
  };
}
```

## Migration Plan

### Phase 1: Tracking Only (Non-breaking)
1. Add `emailRateLimitService.ts`
2. Add tracking calls to `sendTemplatedEmail` without blocking
3. Deploy and monitor actual usage patterns

### Phase 2: Soft Limits
1. Add warnings when approaching limits
2. Add scheduling for P2/P3 emails when over soft limit (80%)
3. Admin alerts when daily/monthly limits approached

### Phase 3: Hard Limits
1. Enable automatic scheduling for P2/P3 when quota exhausted
2. Update all cron jobs to use batch scheduling
3. Full rate limiting enforcement

## Monitoring & Alerts

### Key Metrics to Track
- Daily email volume by priority
- Monthly email volume trend
- Schedule queue depth
- Email delivery success rate
- Rate limit hits (429 errors from Resend)

### Alert Thresholds
- Daily quota > 80%: Warning to admin
- Daily quota > 95%: Pause P2/P3, alert
- Monthly quota > 80%: Start aggressive scheduling
- Monthly quota > 95%: P2/P3 paused until next month

## Future Considerations

### Upgrading Resend Plan
- Pro plan: 50,000 emails/month ($20/mo)
- Scale plan: 100,000 emails/month ($90/mo)

At ~$0.0004-0.0009/email, upgrading makes sense when:
- Consistently hitting 3,000/month limit
- User base grows beyond ~500 active users
- Time-sensitive notifications getting delayed

### Alternative Approaches
- **Batch API**: Resend supports batch sending (100 emails/request)
- **Email campaigns**: Move digests to dedicated email marketing tool
- **Unsubscribe optimization**: Reduce volume by improving unsubscribe UX
