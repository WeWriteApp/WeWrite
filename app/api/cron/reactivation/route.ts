/**
 * Re-activation Email Cron Job
 *
 * Sends re-activation emails to users who haven't been active for 30+ days.
 * Encourages inactive users to come back and start writing/earning again.
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

    console.log('[REACTIVATION] Starting re-activation email processing');

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();

    // Calculate date range - users who were last active 30-90 days ago
    // We target users after 30 days but before 90 days (to avoid spamming very old accounts)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find users who haven't been active recently
    // We use lastActiveAt if available, otherwise fall back to createdAt
    const usersSnapshot = await db.collection(getCollectionName('users'))
      .where('lastActiveAt', '>=', ninetyDaysAgo)
      .where('lastActiveAt', '<=', thirtyDaysAgo)
      .limit(200)
      .get();

    console.log(`[REACTIVATION] Found ${usersSnapshot.size} inactive users in date range to check`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let alreadySent = 0;
    let optedOut = 0;

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Skip users without email
        if (!userData.email) {
          skipped++;
          continue;
        }

        // Skip users who already received a reactivation email recently (within 60 days)
        if (userData.reactivationEmailSentAt) {
          const lastSent = userData.reactivationEmailSentAt._seconds
            ? new Date(userData.reactivationEmailSentAt._seconds * 1000)
            : new Date(userData.reactivationEmailSentAt);

          const sixtyDaysAgo = new Date();
          sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

          if (lastSent > sixtyDaysAgo) {
            alreadySent++;
            continue;
          }
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

        // Calculate days since last active
        const lastActiveAt = userData.lastActiveAt?._seconds
          ? new Date(userData.lastActiveAt._seconds * 1000)
          : userData.lastActiveAt
            ? new Date(userData.lastActiveAt)
            : userData.createdAt?._seconds
              ? new Date(userData.createdAt._seconds * 1000)
              : new Date();

        const daysSinceActive = Math.floor(
          (Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Generate email settings token for one-click unsubscribe
        const emailSettingsToken = userData.emailSettingsToken || randomUUID();

        // If user doesn't have an email settings token, save it
        if (!userData.emailSettingsToken) {
          await userDoc.ref.update({
            emailSettingsToken
          });
        }

        // Send the re-activation email
        const success = await sendTemplatedEmail({
          templateId: 'reactivation',
          to: userData.email,
          data: {
            username: userData.username || userData.displayName || `user_${userId.slice(0, 8)}`,
            daysSinceActive,
            emailSettingsToken
          },
          userId
        });

        if (success) {
          // Mark that we sent the reactivation email
          await userDoc.ref.update({
            reactivationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            reactivationEmailCount: admin.firestore.FieldValue.increment(1)
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
    console.log(`[REACTIVATION] Completed in ${duration}ms - Sent: ${sent}, Skipped: ${skipped}, Already sent: ${alreadySent}, Opted out: ${optedOut}, Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      summary: {
        totalChecked: usersSnapshot.size,
        sent,
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
