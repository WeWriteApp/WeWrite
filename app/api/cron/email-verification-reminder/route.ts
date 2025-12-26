/**
 * Email Verification Reminder Cron Job
 *
 * Sends reminder emails to users who haven't verified their email after 3 days.
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
    // Verify cron access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const cronApiKey = process.env.CRON_API_KEY;

    const isAuthorized =
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (cronApiKey && authHeader === `Bearer ${cronApiKey}`);

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      console.warn('[EMAIL VERIFY REMINDER] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[EMAIL VERIFY REMINDER] Starting email verification reminder processing');

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();

    // Calculate date range - users who signed up 3-7 days ago
    // We target users after 3 days but before a week
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Find users who haven't verified their email and signed up 3-7 days ago
    const usersSnapshot = await db.collection(getCollectionName('users'))
      .where('createdAt', '>=', sevenDaysAgo)
      .where('createdAt', '<=', threeDaysAgo)
      .limit(200)
      .get();

    console.log(`[EMAIL VERIFY REMINDER] Found ${usersSnapshot.size} users in date range to check`);

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

        // Skip users who already received this reminder
        if (userData.emailVerificationReminderSent) {
          skipped++;
          continue;
        }

        // Skip users who opted out of system emails
        if (userData.emailPreferences?.system === false) {
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
          userId
        });

        if (success) {
          // Mark that we sent the reminder
          await userDoc.ref.update({
            emailVerificationReminderSent: true,
            emailVerificationReminderSentAt: admin.firestore.FieldValue.serverTimestamp()
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
