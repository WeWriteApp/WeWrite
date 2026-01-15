/**
 * Email Rate Limit Service
 *
 * Tracks daily/monthly email usage and enforces Resend free tier limits:
 * - Daily limit: 100 emails
 * - Monthly limit: 3,000 emails
 *
 * Uses Resend's scheduledAt feature to spread bulk emails across multiple days
 * when approaching limits, ensuring critical emails always go through.
 *
 * @see docs/deployment/EMAIL_RATE_LIMITING.md for full documentation
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName } from '../utils/environmentConfig';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Resend free tier limits
 */
export const RESEND_LIMITS = {
  DAILY: 100,
  MONTHLY: 3000,
} as const;

/**
 * Email priority levels - determines quota allocation and deferral behavior
 */
export enum EmailPriority {
  /** Critical: Password reset, verification, security alerts - ALWAYS send */
  P0_CRITICAL = 0,
  /** Time-sensitive: Notifications, welcome emails - send if quota, else next day */
  P1_TIME_SENSITIVE = 1,
  /** Engagement: Weekly digest, reminders - spread across days */
  P2_ENGAGEMENT = 2,
  /** Win-back: Reactivation emails - lowest priority, already scheduled */
  P3_WINBACK = 3,
}

/**
 * Daily quota allocation by priority
 * Total: 100 emails/day
 */
export const DAILY_QUOTAS: Record<EmailPriority, number> = {
  [EmailPriority.P0_CRITICAL]: 30,      // Always available
  [EmailPriority.P1_TIME_SENSITIVE]: 40, // Real-time notifications
  [EmailPriority.P2_ENGAGEMENT]: 25,     // Cron jobs
  [EmailPriority.P3_WINBACK]: 5,         // Reactivation
};

/**
 * Template to priority mapping
 */
export const TEMPLATE_PRIORITIES: Record<string, EmailPriority> = {
  // P0 - Critical (always send immediately)
  'verification': EmailPriority.P0_CRITICAL,
  'password-reset': EmailPriority.P0_CRITICAL,
  'account-security': EmailPriority.P0_CRITICAL,

  // P1 - Time-sensitive (send if quota available)
  'new-follower': EmailPriority.P1_TIME_SENSITIVE,
  'page-linked': EmailPriority.P1_TIME_SENSITIVE,
  'subscription-confirmation': EmailPriority.P1_TIME_SENSITIVE,
  'payout-processed': EmailPriority.P1_TIME_SENSITIVE,
  'welcome': EmailPriority.P1_TIME_SENSITIVE,

  // P2 - Engagement (spread across days)
  'weekly-digest': EmailPriority.P2_ENGAGEMENT,
  'first-page-activation': EmailPriority.P2_ENGAGEMENT,
  'username-reminder': EmailPriority.P2_ENGAGEMENT,
  'choose-username': EmailPriority.P2_ENGAGEMENT,
  'payout-setup-reminder': EmailPriority.P2_ENGAGEMENT,
  'verification-reminder': EmailPriority.P2_ENGAGEMENT,

  // P3 - Win-back (already scheduled, lowest priority)
  'reactivation': EmailPriority.P3_WINBACK,
};

// ============================================================================
// Types
// ============================================================================

export interface DailyEmailUsage {
  date: string;              // YYYY-MM-DD format
  p0Sent: number;            // Critical emails sent
  p1Sent: number;            // Time-sensitive emails sent
  p2Sent: number;            // Engagement emails sent
  p3Sent: number;            // Win-back emails sent
  totalSent: number;         // Total for the day
  lastUpdatedAt: Date;
}

export interface MonthlyEmailUsage {
  month: string;             // YYYY-MM format
  totalSent: number;
  byDay: Record<string, number>;
  lastUpdatedAt: Date;
}

export interface CanSendResult {
  canSend: boolean;
  reason?: string;
  suggestedScheduleDate?: string;
  currentUsage?: {
    daily: number;
    monthly: number;
    priorityUsed: number;
    priorityLimit: number;
  };
}

export interface BatchScheduleResult {
  totalRecipients: number;
  scheduledToday: number;
  scheduledLater: number;
  schedule: Array<{
    date: string;
    count: number;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
function getDateKey(date?: Date): string {
  const d = date || new Date();
  return d.toISOString().split('T')[0];
}

/**
 * Get current month in YYYY-MM format (UTC)
 */
function getMonthKey(date?: Date): string {
  const d = date || new Date();
  return d.toISOString().slice(0, 7);
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get priority for a template ID
 */
export function getPriorityForTemplate(templateId: string): EmailPriority {
  return TEMPLATE_PRIORITIES[templateId] ?? EmailPriority.P2_ENGAGEMENT;
}

/**
 * Get the field name for a priority level
 */
function getPriorityField(priority: EmailPriority): 'p0Sent' | 'p1Sent' | 'p2Sent' | 'p3Sent' {
  switch (priority) {
    case EmailPriority.P0_CRITICAL: return 'p0Sent';
    case EmailPriority.P1_TIME_SENSITIVE: return 'p1Sent';
    case EmailPriority.P2_ENGAGEMENT: return 'p2Sent';
    case EmailPriority.P3_WINBACK: return 'p3Sent';
    default: return 'p2Sent';
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get the Firestore collection for rate limits
 */
function getRateLimitsCollection() {
  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new Error('Firebase Admin not initialized');
  }
  const db = admin.firestore();
  return db.collection(getCollectionName('emailRateLimits'));
}

/**
 * Get daily usage for a specific date
 */
export async function getDailyUsage(date?: string): Promise<DailyEmailUsage> {
  const dateKey = date || getDateKey();
  const collection = getRateLimitsCollection();
  const doc = await collection.doc(`daily_${dateKey}`).get();

  if (!doc.exists) {
    return {
      date: dateKey,
      p0Sent: 0,
      p1Sent: 0,
      p2Sent: 0,
      p3Sent: 0,
      totalSent: 0,
      lastUpdatedAt: new Date(),
    };
  }

  const data = doc.data()!;
  return {
    date: dateKey,
    p0Sent: data.p0Sent || 0,
    p1Sent: data.p1Sent || 0,
    p2Sent: data.p2Sent || 0,
    p3Sent: data.p3Sent || 0,
    totalSent: data.totalSent || 0,
    lastUpdatedAt: data.lastUpdatedAt?.toDate() || new Date(),
  };
}

/**
 * Get monthly usage for a specific month
 */
export async function getMonthlyUsage(month?: string): Promise<MonthlyEmailUsage> {
  const monthKey = month || getMonthKey();
  const collection = getRateLimitsCollection();
  const doc = await collection.doc(`monthly_${monthKey}`).get();

  if (!doc.exists) {
    return {
      month: monthKey,
      totalSent: 0,
      byDay: {},
      lastUpdatedAt: new Date(),
    };
  }

  const data = doc.data()!;
  return {
    month: monthKey,
    totalSent: data.totalSent || 0,
    byDay: data.byDay || {},
    lastUpdatedAt: data.lastUpdatedAt?.toDate() || new Date(),
  };
}

/**
 * Check if we can send an email now, or get a suggested schedule date
 */
export async function canSendEmail(priority: EmailPriority): Promise<CanSendResult> {
  try {
    const dailyUsage = await getDailyUsage();
    const monthlyUsage = await getMonthlyUsage();

    // P0 (Critical) emails always go through
    if (priority === EmailPriority.P0_CRITICAL) {
      return {
        canSend: true,
        currentUsage: {
          daily: dailyUsage.totalSent,
          monthly: monthlyUsage.totalSent,
          priorityUsed: dailyUsage.p0Sent,
          priorityLimit: DAILY_QUOTAS[EmailPriority.P0_CRITICAL],
        },
      };
    }

    // Check monthly limit first
    if (monthlyUsage.totalSent >= RESEND_LIMITS.MONTHLY) {
      // Find next month's first day
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return {
        canSend: false,
        reason: 'Monthly limit reached',
        suggestedScheduleDate: nextMonth.toISOString(),
        currentUsage: {
          daily: dailyUsage.totalSent,
          monthly: monthlyUsage.totalSent,
          priorityUsed: dailyUsage[getPriorityField(priority)],
          priorityLimit: DAILY_QUOTAS[priority],
        },
      };
    }

    // Check daily limit
    if (dailyUsage.totalSent >= RESEND_LIMITS.DAILY) {
      const suggestedDate = await getNextAvailableSlot(priority);
      return {
        canSend: false,
        reason: 'Daily limit reached',
        suggestedScheduleDate: suggestedDate,
        currentUsage: {
          daily: dailyUsage.totalSent,
          monthly: monthlyUsage.totalSent,
          priorityUsed: dailyUsage[getPriorityField(priority)],
          priorityLimit: DAILY_QUOTAS[priority],
        },
      };
    }

    // Check priority-specific quota
    const priorityField = getPriorityField(priority);
    const priorityUsed = dailyUsage[priorityField];
    const priorityLimit = DAILY_QUOTAS[priority];

    if (priorityUsed >= priorityLimit) {
      const suggestedDate = await getNextAvailableSlot(priority);
      return {
        canSend: false,
        reason: `Priority ${priority} quota exhausted (${priorityUsed}/${priorityLimit})`,
        suggestedScheduleDate: suggestedDate,
        currentUsage: {
          daily: dailyUsage.totalSent,
          monthly: monthlyUsage.totalSent,
          priorityUsed,
          priorityLimit,
        },
      };
    }

    return {
      canSend: true,
      currentUsage: {
        daily: dailyUsage.totalSent,
        monthly: monthlyUsage.totalSent,
        priorityUsed,
        priorityLimit,
      },
    };
  } catch (error) {
    // On error, allow the send but log warning
    console.warn('[EmailRateLimit] Error checking quota, allowing send:', error);
    return { canSend: true };
  }
}

/**
 * Record that an email was sent (or scheduled)
 */
export async function recordEmailSent(
  priority: EmailPriority,
  date?: string
): Promise<void> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) return;

    const dateKey = date || getDateKey();
    const monthKey = dateKey.slice(0, 7);
    const collection = getRateLimitsCollection();
    const FieldValue = admin.firestore.FieldValue;

    const priorityField = getPriorityField(priority);

    // Update daily usage
    await collection.doc(`daily_${dateKey}`).set({
      date: dateKey,
      [priorityField]: FieldValue.increment(1),
      totalSent: FieldValue.increment(1),
      lastUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Update monthly usage
    await collection.doc(`monthly_${monthKey}`).set({
      month: monthKey,
      totalSent: FieldValue.increment(1),
      [`byDay.${dateKey}`]: FieldValue.increment(1),
      lastUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('[EmailRateLimit] Error recording email sent:', error);
  }
}

/**
 * Find the next available slot for sending an email of a given priority
 * Looks up to 30 days ahead (Resend's scheduling limit)
 */
export async function getNextAvailableSlot(priority: EmailPriority): Promise<string> {
  const priorityQuota = DAILY_QUOTAS[priority];

  // Check up to 30 days ahead
  for (let i = 1; i <= 30; i++) {
    const checkDate = addDays(new Date(), i);
    const dateKey = getDateKey(checkDate);
    const usage = await getDailyUsage(dateKey);

    // Check if this priority has slots available
    const priorityField = getPriorityField(priority);
    const priorityUsed = usage[priorityField];

    if (priorityUsed < priorityQuota && usage.totalSent < RESEND_LIMITS.DAILY) {
      // Return ISO string for this day at a reasonable time (10 AM UTC)
      checkDate.setUTCHours(10, 0, 0, 0);
      return checkDate.toISOString();
    }
  }

  // Fallback: 31 days from now (beyond Resend's limit, will fail gracefully)
  const fallback = addDays(new Date(), 31);
  fallback.setUTCHours(10, 0, 0, 0);
  console.warn('[EmailRateLimit] No available slot found in next 30 days');
  return fallback.toISOString();
}

/**
 * Calculate a batch schedule for multiple emails
 * Returns a schedule spreading emails across multiple days
 */
export async function calculateBatchSchedule(
  totalEmails: number,
  priority: EmailPriority
): Promise<BatchScheduleResult> {
  const priorityQuota = DAILY_QUOTAS[priority];
  const schedule: Array<{ date: string; count: number }> = [];
  let remaining = totalEmails;
  let scheduledToday = 0;
  let scheduledLater = 0;

  // Check today's availability first
  const todayUsage = await getDailyUsage();
  const priorityField = getPriorityField(priority);
  const todayAvailable = Math.min(
    priorityQuota - todayUsage[priorityField],
    RESEND_LIMITS.DAILY - todayUsage.totalSent
  );

  if (todayAvailable > 0 && remaining > 0) {
    const todayCount = Math.min(todayAvailable, remaining);
    schedule.push({ date: getDateKey(), count: todayCount });
    scheduledToday = todayCount;
    remaining -= todayCount;
  }

  // Schedule remaining across future days
  let dayOffset = 1;
  while (remaining > 0 && dayOffset <= 30) {
    const futureDate = addDays(new Date(), dayOffset);
    const dateKey = getDateKey(futureDate);
    const futureUsage = await getDailyUsage(dateKey);

    const available = Math.min(
      priorityQuota - futureUsage[priorityField],
      RESEND_LIMITS.DAILY - futureUsage.totalSent
    );

    if (available > 0) {
      const count = Math.min(available, remaining);
      schedule.push({ date: dateKey, count });
      scheduledLater += count;
      remaining -= count;
    }

    dayOffset++;
  }

  return {
    totalRecipients: totalEmails,
    scheduledToday,
    scheduledLater,
    schedule,
  };
}

/**
 * Get schedule date for a specific index in a batch
 * Used by cron jobs to determine when to schedule each email
 */
export function getScheduleDateForBatchIndex(
  schedule: BatchScheduleResult['schedule'],
  index: number
): string | undefined {
  let currentIndex = 0;

  for (const slot of schedule) {
    if (index < currentIndex + slot.count) {
      // This email belongs to this slot
      if (slot.date === getDateKey()) {
        // Today - send immediately
        return undefined;
      }
      // Future date - schedule at 10 AM UTC
      const scheduleDate = new Date(slot.date + 'T10:00:00.000Z');
      return scheduleDate.toISOString();
    }
    currentIndex += slot.count;
  }

  // Fallback: schedule for tomorrow
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setUTCHours(10, 0, 0, 0);
  return tomorrow.toISOString();
}

/**
 * Get current quota status for admin dashboard
 */
export async function getQuotaStatus(): Promise<{
  today: DailyEmailUsage & { remaining: number; percentUsed: number };
  thisMonth: MonthlyEmailUsage & { remaining: number; percentUsed: number };
  limits: typeof RESEND_LIMITS;
  quotas: typeof DAILY_QUOTAS;
}> {
  const today = await getDailyUsage();
  const thisMonth = await getMonthlyUsage();

  return {
    today: {
      ...today,
      remaining: RESEND_LIMITS.DAILY - today.totalSent,
      percentUsed: Math.round((today.totalSent / RESEND_LIMITS.DAILY) * 100),
    },
    thisMonth: {
      ...thisMonth,
      remaining: RESEND_LIMITS.MONTHLY - thisMonth.totalSent,
      percentUsed: Math.round((thisMonth.totalSent / RESEND_LIMITS.MONTHLY) * 100),
    },
    limits: RESEND_LIMITS,
    quotas: DAILY_QUOTAS,
  };
}
