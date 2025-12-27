/**
 * Re-activation Email Cron Job
 *
 * Schedules re-activation emails (2 days out) for users who haven't been active for 30+ days.
 * Emails are scheduled via Resend's scheduling feature to avoid immediate spam.
 * Run weekly via Vercel cron.
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/reactivation",
 *     "schedule": "0 16 * * 1"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { sendTemplatedEmail } from '../../../services/emailService';
import { randomUUID } from 'crypto';

export const maxDuration = 120; // 2 minute timeout

/**
 * GET handler for Vercel cron jobs
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const cronApiKey = process.env.CRON_API_KEY;

    const isAuthorized =
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (cronApiKey && authHeader === `Bearer ${cronApiKey}`);

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      console.warn('[REACTIVATION] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[REACTIVATION] Starting re-activation email scheduling');

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();

    // Schedule emails for 2 days from now
    const scheduledSendDate = new Date();
    scheduledSendDate.setDate(scheduledSendDate.getDate() + 2);
    const scheduledAt = scheduledSendDate.toISOString();

    // Calculate date range - users who were last active 30-90 days ago
    // We target users after 30 days but before 90 days (to avoid spamming very old accounts)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find users who haven't been active recently
    // Query all users and filter in code to handle inconsistent date formats
    const usersSnapshot = await db.collection(getCollectionName('users'))
      .limit(500)
      .get();

    console.log(`[REACTIVATION] Checking ${usersSnapshot.size} users for inactivity`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let alreadySent = 0;
    let optedOut = 0;
    let notInRange = 0;

    // Helper to parse various date formats
    const getDateValue = (val: any): Date | null => {
      if (!val) return null;
      if (val._seconds) return new Date(val._seconds * 1000);
      if (val.toDate) return val.toDate();
      if (typeof val === 'string') return new Date(val);
      return null;
    };

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Skip users without email
        if (!userData.email) {
          skipped++;
          continue;
        }

        // Get last activity time - prefer lastActiveAt, fall back to lastLoginAt, then createdAt
        const lastActivity = getDateValue(userData.lastActiveAt)
          || getDateValue(userData.lastLoginAt)
          || getDateValue(userData.createdAt);

        if (!lastActivity) {
          skipped++;
          continue;
        }

        // Check if user is in the 30-90 day inactive window
        if (lastActivity > thirtyDaysAgo || lastActivity < ninetyDaysAgo) {
          notInRange++;
          continue;
        }

        // Skip users who already received a reactivation email recently (within 60 days)
        const lastReactivationEmail = getDateValue(userData.reactivationEmailSentAt);
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        if (lastReactivationEmail && lastReactivationEmail > sixtyDaysAgo) {
          alreadySent++;
          continue;
        }

        // Skip users who opted out of engagement emails
        if (userData.emailPreferences?.engagement === false) {
          optedOut++;
          continue;
        }

        // Skip users who unsubscribed from reactivation specifically
        if (userData.emailPreferences?.reactivation === false) {
          optedOut++;
          continue;
        }

        const daysSinceActive = Math.floor(
          (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Generate email settings token for one-click unsubscribe
        const emailSettingsToken = userData.emailSettingsToken || randomUUID();

        // If user doesn't have an email settings token, save it
        if (!userData.emailSettingsToken) {
          await userDoc.ref.update({
            emailSettingsToken
          });
        }

        // Schedule the re-activation email for 2 days from now
        const result = await sendTemplatedEmail({
          templateId: 'reactivation',
          to: userData.email,
          data: {
            username: userData.username || userData.displayName || `user_${userId.slice(0, 8)}`,
            daysSinceActive,
            emailSettingsToken
          },
          userId,
          scheduledAt
        });

        if (result.success) {
          // Mark that we scheduled the reactivation email and store Resend ID for potential cancellation
          await userDoc.ref.update({
            reactivationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            reactivationEmailCount: admin.firestore.FieldValue.increment(1),
            scheduledReactivationEmailId: result.resendId || null,
            scheduledReactivationEmailAt: scheduledAt
          });
          sent++;
        } else {
          failed++;
        }

        // Rate limit - pause every 10 emails
        if (sent % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (userError) {
        console.error(`[REACTIVATION] Error processing user ${userDoc.id}:`, userError);
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[REACTIVATION] Completed in ${duration}ms - Scheduled: ${sent} for ${scheduledAt}, Not in range: ${notInRange}, Skipped: ${skipped}, Already sent: ${alreadySent}, Opted out: ${optedOut}, Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      summary: {
        totalChecked: usersSnapshot.size,
        scheduled: sent,
        scheduledFor: scheduledAt,
        notInRange,
        skipped,
        alreadySent,
        optedOut,
        failed,
        durationMs: duration
      }
    });

  } catch (error) {
    console.error('[REACTIVATION] Error:', error);
    return NextResponse.json({
      error: 'Failed to process re-activation emails',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
