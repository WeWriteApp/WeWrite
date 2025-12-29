/**
 * Email Verification Reminder Cron Job
 *
 * Sends reminder emails to ALL unverified users (at least 1 day old).
 * Throttles to max once per week per user.
 * Run daily via Vercel cron.
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/email-verification-reminder",
 *     "schedule": "0 15 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { PRODUCTION_URL } from '../../../utils/urlConfig';
import { randomUUID } from 'crypto';
import { sendTemplatedEmail } from '../../../services/emailService';

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
      console.warn('[EMAIL VERIFY REMINDER] Unauthorized access attempt - check CRON_SECRET env var');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[EMAIL VERIFY REMINDER] Starting email verification reminder processing');

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();

    // Calculate dates for throttling
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Helper to parse various date formats
    const getDateValue = (val: any): Date | null => {
      if (!val) return null;
      if (val._seconds) return new Date(val._seconds * 1000);
      if (val.toDate) return val.toDate();
      if (typeof val === 'string') return new Date(val);
      return null;
    };

    // Find ALL unverified users (query all and filter since can't easily query emailVerified != true)
    const usersSnapshot = await db.collection(getCollectionName('users'))
      .limit(500)
      .get();

    console.log(`[EMAIL VERIFY REMINDER] Found ${usersSnapshot.size} total users to check`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let alreadyVerified = 0;

    // Get base URL for verification links
    const envType = getEnvironmentType();
    const baseUrl = envType === 'production'
      ? PRODUCTION_URL
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Skip users without email
        if (!userData.email) {
          skipped++;
          continue;
        }

        // Skip users who already verified their email
        if (userData.emailVerified === true) {
          alreadyVerified++;
          continue;
        }

        // Skip users who opted out of engagement emails
        if (userData.emailPreferences?.engagement === false) {
          skipped++;
          continue;
        }

        // Skip users who signed up less than 1 day ago (give them time to verify naturally)
        const createdAt = getDateValue(userData.createdAt);
        if (!createdAt || createdAt > oneDayAgo) {
          skipped++;
          continue;
        }

        // Throttle: Skip users who already received a reminder within the last 7 days
        const lastReminderSent = getDateValue(userData.verificationReminderSentAt);
        if (lastReminderSent && lastReminderSent > sevenDaysAgo) {
          skipped++;
          continue;
        }

        // Generate a new verification token
        const verificationToken = randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Store the verification token
        await db.collection(getCollectionName('email_verification_tokens')).doc(verificationToken).set({
          userId,
          email: userData.email,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt,
          used: false,
          type: 'reminder'
        });

        // Create verification link
        const verificationLink = `${baseUrl}/auth/verify-email?token=${verificationToken}`;

        // Send the reminder email using our new template
        const success = await sendTemplatedEmail({
          templateId: 'verification-reminder',
          to: userData.email,
          data: {
            username: userData.username || `user_${userId.slice(0, 8)}`,
            verificationLink
          },
          userId,
          triggerSource: 'cron'
        });

        if (success) {
          // Mark that we sent the reminder with timestamp for throttling
          await userDoc.ref.update({
            verificationReminderSentAt: admin.firestore.FieldValue.serverTimestamp()
          });
          sent++;
        } else {
          failed++;
        }

        // Rate limit
        if (sent % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (userError) {
        console.error(`[EMAIL VERIFY REMINDER] Error processing user ${userDoc.id}:`, userError);
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[EMAIL VERIFY REMINDER] Completed in ${duration}ms - Sent: ${sent}, Skipped: ${skipped}, Already verified: ${alreadyVerified}, Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      summary: {
        totalChecked: usersSnapshot.size,
        sent,
        skipped,
        alreadyVerified,
        failed,
        durationMs: duration
      }
    });

  } catch (error) {
    console.error('[EMAIL VERIFY REMINDER] Error:', error);
    return NextResponse.json({
      error: 'Failed to process email verification reminders',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
