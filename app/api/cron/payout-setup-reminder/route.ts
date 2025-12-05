/**
 * Payout Setup Reminder Email Cron Job
 * 
 * Sends reminder emails to users who have pending earnings but haven't set up payouts.
 * Run daily to catch users who have accumulated earnings.
 * 
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/payout-setup-reminder",
 *     "schedule": "0 15 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { sendPayoutSetupReminder } from '../../../services/emailService';

export const maxDuration = 120; // 2 minute timeout

// Minimum pending earnings in USD to trigger reminder ($1.00)
const MIN_EARNINGS_THRESHOLD = 100; // in cents

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
      console.warn('[PAYOUT REMINDER] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[PAYOUT REMINDER] Starting payout setup reminder processing');
    
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    
    const db = admin.firestore();
    
    // Find users with pending earnings who haven't set up payouts
    // We need to:
    // 1. Get all writer balances with pending earnings > threshold
    // 2. Check if those users have Stripe connected
    // 3. Check if they haven't already received a reminder recently
    
    const writerBalancesSnapshot = await db.collection(getCollectionName('writerUsdBalances'))
      .where('pendingUsdCents', '>=', MIN_EARNINGS_THRESHOLD)
      .limit(200)
      .get();
    
    console.log(`[PAYOUT REMINDER] Found ${writerBalancesSnapshot.size} users with pending earnings`);
    
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    
    // Calculate "don't spam" window - only send once per week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    for (const balanceDoc of writerBalancesSnapshot.docs) {
      try {
        const balanceData = balanceDoc.data();
        const userId = balanceDoc.id;
        
        // Get user data
        const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
        if (!userDoc.exists) {
          skipped++;
          continue;
        }
        
        const userData = userDoc.data()!;
        
        // Skip users without email
        if (!userData.email) {
          skipped++;
          continue;
        }
        
        // Skip users who have Stripe connected (they have payouts set up)
        if (userData.stripeConnectedAccountId) {
          skipped++;
          continue;
        }
        
        // Skip users who already received a reminder recently
        const lastReminderSent = userData.payoutReminderSentAt?.toDate?.() || userData.payoutReminderSentAt;
        if (lastReminderSent && new Date(lastReminderSent) > oneWeekAgo) {
          skipped++;
          continue;
        }
        
        // Skip users who opted out of payment emails
        if (userData.emailPreferences?.payments === false) {
          skipped++;
          continue;
        }
        
        // Calculate pending earnings in dollars
        const pendingEarnings = (balanceData.pendingUsdCents || 0) / 100;
        
        // Send the reminder email
        const success = await sendPayoutSetupReminder({
          to: userData.email,
          username: userData.username || 'there',
          pendingEarnings: `$${pendingEarnings.toFixed(2)}`,
          userId
        });
        
        if (success) {
          // Mark that we sent the reminder
          await db.collection(getCollectionName('users')).doc(userId).update({
            payoutReminderSentAt: admin.firestore.FieldValue.serverTimestamp()
          });
          sent++;
        } else {
          failed++;
        }
        
        // Rate limit - don't overwhelm Resend
        if (sent % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (userError) {
        console.error(`[PAYOUT REMINDER] Error processing user ${balanceDoc.id}:`, userError);
        failed++;
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[PAYOUT REMINDER] Completed in ${duration}ms - Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`);
    
    return NextResponse.json({
      success: true,
      summary: {
        totalBalances: writerBalancesSnapshot.size,
        sent,
        skipped,
        failed,
        durationMs: duration
      }
    });
    
  } catch (error) {
    console.error('[PAYOUT REMINDER] Error:', error);
    return NextResponse.json({
      error: 'Failed to process payout setup reminders',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
