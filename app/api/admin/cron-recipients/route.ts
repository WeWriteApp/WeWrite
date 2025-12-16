/**
 * Cron Recipients API
 *
 * Returns the list of users who would receive the next scheduled notification
 * for a given cron job. Used by admin notifications page to show upcoming recipients.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { isAdmin } from '../../../utils/isAdmin';

export const maxDuration = 30;

interface Recipient {
  userId: string;
  email: string;
  username?: string;
  type: string;
  reason?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin access via middleware header
    const userEmail = request.headers.get('x-user-email');
    if (!userEmail || !isAdmin(userEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cronId = searchParams.get('cronId');

    if (!cronId) {
      return NextResponse.json({ error: 'cronId required' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();
    const recipients: Recipient[] = [];

    switch (cronId) {
      case 'username-reminder': {
        // Users who signed up 1-7 days ago without proper username
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const usersSnapshot = await db.collection(getCollectionName('users'))
          .where('createdAt', '>=', oneWeekAgo)
          .where('createdAt', '<=', oneDayAgo)
          .limit(50)
          .get();

        for (const doc of usersSnapshot.docs) {
          const data = doc.data();
          if (!data.email) continue;

          const username = data.username || '';
          const hasProperUsername = username &&
            !username.startsWith('user_') &&
            !username.startsWith('User_') &&
            username.length > 3;

          if (hasProperUsername) continue;
          if (data.usernameReminderSent) continue;
          if (data.emailPreferences?.engagement === false) continue;

          recipients.push({
            userId: doc.id,
            email: data.email,
            username: data.username,
            type: 'no-username',
            reason: `Signed up ${Math.floor((Date.now() - data.createdAt?.toDate?.().getTime?.() || 0) / 86400000)} days ago`
          });
        }
        break;
      }

      case 'payout-setup-reminder': {
        // Users with pending earnings but no Stripe connected
        const writerBalancesSnapshot = await db.collection(getCollectionName('writerUsdBalances'))
          .where('pendingUsdCents', '>=', 100) // $1 minimum
          .limit(50)
          .get();

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        for (const balanceDoc of writerBalancesSnapshot.docs) {
          const balanceData = balanceDoc.data();
          const userId = balanceDoc.id;

          const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
          if (!userDoc.exists) continue;

          const userData = userDoc.data()!;
          if (!userData.email) continue;
          if (userData.stripeConnectedAccountId) continue;

          const lastReminderSent = userData.payoutReminderSentAt?.toDate?.() || userData.payoutReminderSentAt;
          if (lastReminderSent && new Date(lastReminderSent) > oneWeekAgo) continue;
          if (userData.emailPreferences?.payments === false) continue;

          const pendingEarnings = (balanceData.pendingUsdCents || 0) / 100;

          recipients.push({
            userId,
            email: userData.email,
            username: userData.username,
            type: 'pending-earnings',
            reason: `$${pendingEarnings.toFixed(2)} pending`
          });
        }
        break;
      }

      case 'email-verification-reminder': {
        // Unverified users who signed up 3-7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const usersSnapshot = await db.collection(getCollectionName('users'))
          .where('createdAt', '>=', sevenDaysAgo)
          .where('createdAt', '<=', threeDaysAgo)
          .limit(50)
          .get();

        for (const doc of usersSnapshot.docs) {
          const data = doc.data();
          if (!data.email) continue;
          if (data.emailVerified) continue;
          if (data.verificationReminderSent) continue;
          if (data.emailPreferences?.engagement === false) continue;

          recipients.push({
            userId: doc.id,
            email: data.email,
            username: data.username,
            type: 'unverified',
            reason: `Signed up ${Math.floor((Date.now() - data.createdAt?.toDate?.().getTime?.() || 0) / 86400000)} days ago`
          });
        }
        break;
      }

      case 'weekly-digest': {
        // All verified users with engagement emails enabled
        const usersSnapshot = await db.collection(getCollectionName('users'))
          .where('emailVerified', '==', true)
          .limit(50)
          .get();

        for (const doc of usersSnapshot.docs) {
          const data = doc.data();
          if (!data.email) continue;
          if (data.emailPreferences?.engagement === false) continue;

          recipients.push({
            userId: doc.id,
            email: data.email,
            username: data.username,
            type: 'verified-user',
            reason: 'Subscribed to weekly digest'
          });
        }
        break;
      }

      case 'process-writer-earnings': {
        // Writers with views in the past month
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const writerBalancesSnapshot = await db.collection(getCollectionName('writerUsdBalances'))
          .limit(50)
          .get();

        for (const balanceDoc of writerBalancesSnapshot.docs) {
          const balanceData = balanceDoc.data();
          const userId = balanceDoc.id;

          // Skip if no recent activity
          const lastUpdated = balanceData.updatedAt?.toDate?.() || balanceData.lastActivityAt?.toDate?.();
          if (lastUpdated && lastUpdated < oneMonthAgo) continue;

          const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
          if (!userDoc.exists) continue;

          const userData = userDoc.data()!;

          recipients.push({
            userId,
            email: userData.email || 'N/A',
            username: userData.username,
            type: 'active-writer',
            reason: `Pending: $${((balanceData.pendingUsdCents || 0) / 100).toFixed(2)}`
          });
        }
        break;
      }

      case 'automated-payouts': {
        // Writers with available balance and Stripe connected
        const writerBalancesSnapshot = await db.collection(getCollectionName('writerUsdBalances'))
          .where('availableUsdCents', '>=', 100)
          .limit(50)
          .get();

        for (const balanceDoc of writerBalancesSnapshot.docs) {
          const balanceData = balanceDoc.data();
          const userId = balanceDoc.id;

          const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
          if (!userDoc.exists) continue;

          const userData = userDoc.data()!;
          if (!userData.stripeConnectedAccountId) continue;

          recipients.push({
            userId,
            email: userData.email || 'N/A',
            username: userData.username,
            type: 'payout-eligible',
            reason: `$${((balanceData.availableUsdCents || 0) / 100).toFixed(2)} available`
          });
        }
        break;
      }

      default:
        return NextResponse.json({
          success: true,
          recipients: [],
          message: `Unknown cron job: ${cronId}`
        });
    }

    return NextResponse.json({
      success: true,
      cronId,
      recipients,
      totalCount: recipients.length
    });

  } catch (error) {
    console.error('[CRON RECIPIENTS] Error:', error);
    return NextResponse.json({
      error: 'Failed to fetch cron recipients',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
