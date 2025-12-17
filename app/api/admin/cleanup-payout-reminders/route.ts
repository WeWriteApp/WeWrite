/**
 * Cleanup Payout Reminders Admin API
 *
 * Clears payoutReminderSentAt for users who:
 * 1. Have balance below the payout threshold ($25)
 * 2. Were incorrectly sent payout setup reminders
 *
 * This prevents them from being spammed with irrelevant emails.
 *
 * GET - Preview which users would be cleaned up
 * POST - Actually clean up the incorrect reminder flags
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { WEWRITE_FEE_STRUCTURE } from '../../../utils/feeCalculations';

const MIN_EARNINGS_THRESHOLD_CENTS = WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold * 100; // $25 in cents

export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();

    // Find users who have payoutReminderSentAt set
    const usersWithReminder = await db.collection(getCollectionName('users'))
      .where('payoutReminderSentAt', '!=', null)
      .limit(500)
      .get();

    const usersToCleanup: Array<{
      userId: string;
      username: string;
      email: string;
      pendingUsdCents: number;
      pendingUsd: string;
      payoutReminderSentAt: string;
      hasStripeConnected: boolean;
    }> = [];

    const usersAboveThreshold: Array<{
      userId: string;
      username: string;
      pendingUsd: string;
      hasStripeConnected: boolean;
    }> = [];

    for (const userDoc of usersWithReminder.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Check their actual balance
      const balanceDoc = await db.collection(getCollectionName('writerUsdBalances')).doc(userId).get();
      const balanceData = balanceDoc.exists ? balanceDoc.data() : null;
      const pendingUsdCents = balanceData?.pendingUsdCents || 0;

      const reminderDate = userData.payoutReminderSentAt?.toDate?.()
        ? userData.payoutReminderSentAt.toDate().toISOString()
        : userData.payoutReminderSentAt;

      if (pendingUsdCents < MIN_EARNINGS_THRESHOLD_CENTS) {
        usersToCleanup.push({
          userId,
          username: userData.username || 'unknown',
          email: userData.email || 'no-email',
          pendingUsdCents,
          pendingUsd: `$${(pendingUsdCents / 100).toFixed(2)}`,
          payoutReminderSentAt: reminderDate,
          hasStripeConnected: !!userData.stripeConnectedAccountId,
        });
      } else {
        usersAboveThreshold.push({
          userId,
          username: userData.username || 'unknown',
          pendingUsd: `$${(pendingUsdCents / 100).toFixed(2)}`,
          hasStripeConnected: !!userData.stripeConnectedAccountId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      threshold: `$${WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold.toFixed(2)}`,
      thresholdCents: MIN_EARNINGS_THRESHOLD_CENTS,
      summary: {
        totalWithReminder: usersWithReminder.size,
        belowThreshold: usersToCleanup.length,
        aboveThreshold: usersAboveThreshold.length,
      },
      usersToCleanup,
      usersAboveThreshold,
      message: 'Use POST request to cleanup the payoutReminderSentAt field for users below threshold',
    });

  } catch (error) {
    console.error('[CLEANUP PAYOUT REMINDERS] Error:', error);
    return NextResponse.json({
      error: 'Failed to analyze payout reminders',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();

    // Find users who have payoutReminderSentAt set
    const usersWithReminder = await db.collection(getCollectionName('users'))
      .where('payoutReminderSentAt', '!=', null)
      .limit(500)
      .get();

    let cleanedUp = 0;
    let skipped = 0;
    const cleanedUsers: string[] = [];

    for (const userDoc of usersWithReminder.docs) {
      const userId = userDoc.id;

      // Check their actual balance
      const balanceDoc = await db.collection(getCollectionName('writerUsdBalances')).doc(userId).get();
      const balanceData = balanceDoc.exists ? balanceDoc.data() : null;
      const pendingUsdCents = balanceData?.pendingUsdCents || 0;

      if (pendingUsdCents < MIN_EARNINGS_THRESHOLD_CENTS) {
        // Clear the reminder flag so they won't be flagged as "already sent"
        await userDoc.ref.update({
          payoutReminderSentAt: admin.firestore.FieldValue.delete(),
        });
        cleanedUp++;
        cleanedUsers.push(userId);
      } else {
        skipped++;
      }
    }

    console.log(`[CLEANUP PAYOUT REMINDERS] Cleaned up ${cleanedUp} users, skipped ${skipped}`);

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed: usersWithReminder.size,
        cleanedUp,
        skipped,
      },
      cleanedUserIds: cleanedUsers,
      message: `Cleared payoutReminderSentAt for ${cleanedUp} users who were below the $${WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold} threshold`,
    });

  } catch (error) {
    console.error('[CLEANUP PAYOUT REMINDERS] Error:', error);
    return NextResponse.json({
      error: 'Failed to cleanup payout reminders',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
