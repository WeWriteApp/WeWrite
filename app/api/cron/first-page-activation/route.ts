/**
 * First Page Activation Email Cron Job
 *
 * Sends reminder emails to users who haven't written their first page yet.
 * Run daily via Vercel cron to encourage new users to start writing.
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/first-page-activation",
 *     "schedule": "0 13 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { sendTemplatedEmail, EmailPriority } from '../../../services/emailService';
import { randomUUID } from 'crypto';

export const maxDuration = 120; // 2 minute timeout

/**
 * GET handler for Vercel cron jobs
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron access - Vercel sends CRON_SECRET in Authorization header
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Check Authorization: Bearer <CRON_SECRET> header (Vercel's standard)
    const isAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      console.warn('[FIRST PAGE ACTIVATION] Unauthorized access attempt - check CRON_SECRET env var');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[FIRST PAGE ACTIVATION] Starting first page activation email processing');

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();
    const rtdb = admin.database();

    // Calculate date range - users who signed up 2-7 days ago
    // We give them 2 days to explore before sending this reminder
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Helper to parse various date formats
    const getDateValue = (val: any): Date | null => {
      if (!val) return null;
      if (val._seconds) return new Date(val._seconds * 1000);
      if (val.toDate) return val.toDate();
      if (typeof val === 'string') return new Date(val);
      return null;
    };

    // Find users who signed up recently - query all and filter in code
    // to handle inconsistent date formats
    const usersSnapshot = await db.collection(getCollectionName('users'))
      .limit(500)
      .get();

    console.log(`[FIRST PAGE ACTIVATION] Checking ${usersSnapshot.size} users for eligibility`);

    let sent = 0;
    let scheduled = 0;
    let skipped = 0;
    let failed = 0;
    let hasPages = 0;
    let alreadySent = 0;
    let optedOut = 0;
    let notInRange = 0;

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Skip users without email
        if (!userData.email) {
          skipped++;
          continue;
        }

        // Check if user signed up in the 2-7 day window
        const createdAt = getDateValue(userData.createdAt);
        if (!createdAt) {
          skipped++;
          continue;
        }

        // Must be older than 2 days but newer than 7 days
        if (createdAt > twoDaysAgo || createdAt < oneWeekAgo) {
          notInRange++;
          continue;
        }

        // Skip users who already received this reminder
        if (userData.firstPageActivationSent) {
          alreadySent++;
          continue;
        }

        // Skip users who opted out of engagement emails
        if (userData.emailPreferences?.engagement === false) {
          optedOut++;
          continue;
        }

        // Check if user has any pages in RTDB
        const userPagesRef = rtdb.ref(`pages`);
        const userPagesSnapshot = await userPagesRef
          .orderByChild('authorId')
          .equalTo(userId)
          .limitToFirst(1)
          .once('value');

        if (userPagesSnapshot.exists()) {
          // User already has pages, skip them
          hasPages++;
          continue;
        }

        // Generate email settings token for one-click unsubscribe
        const emailSettingsToken = userData.emailSettingsToken || randomUUID();

        // If user doesn't have an email settings token, save it
        if (!userData.emailSettingsToken) {
          await userDoc.ref.update({
            emailSettingsToken
          });
        }

        // Send the first page activation email
        // Auto-schedules for later if daily quota is reached
        const result = await sendTemplatedEmail({
          templateId: 'first-page-activation',
          to: userData.email,
          data: {
            username: userData.username || userData.displayName || 'there',
            emailSettingsToken
          },
          userId,
          triggerSource: 'cron',
          priority: EmailPriority.P2_ENGAGEMENT,
        });

        if (result.success) {
          // Mark that we sent/scheduled the reminder
          await userDoc.ref.update({
            firstPageActivationSent: true,
            firstPageActivationSentAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(result.wasScheduled && { firstPageActivationScheduledFor: result.scheduledFor })
          });
          if (result.wasScheduled) {
            scheduled++;
          } else {
            sent++;
          }
        } else {
          failed++;
        }

        // Rate limit
        if (sent % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (userError) {
        console.error(`[FIRST PAGE ACTIVATION] Error processing user ${userDoc.id}:`, userError);
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[FIRST PAGE ACTIVATION] Completed in ${duration}ms - Sent: ${sent}, Scheduled: ${scheduled}, Not in range: ${notInRange}, Has Pages: ${hasPages}, Already Sent: ${alreadySent}, Opted Out: ${optedOut}, Skipped: ${skipped}, Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      summary: {
        totalChecked: usersSnapshot.size,
        sentImmediately: sent,
        scheduledForLater: scheduled,
        notInRange,
        hasPages,
        alreadySent,
        optedOut,
        skipped,
        failed,
        durationMs: duration
      }
    });

  } catch (error) {
    console.error('[FIRST PAGE ACTIVATION] Error:', error);
    return NextResponse.json({
      error: 'Failed to process first page activation emails',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
