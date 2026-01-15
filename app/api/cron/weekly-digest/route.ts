/**
 * Weekly Digest Email Cron Job
 * 
 * Sends weekly digest emails to users with their activity summary.
 * Run weekly via Vercel cron (e.g., every Sunday at 10am UTC).
 * 
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/weekly-digest",
 *     "schedule": "0 10 * * 0"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { sendTemplatedEmail, EmailPriority } from '../../../services/emailService';
import {
  calculateBatchSchedule,
  getScheduleDateForBatchIndex,
} from '../../../services/emailRateLimitService';

export const maxDuration = 300; // 5 minute timeout for processing all users

interface UserDigestData {
  userId: string;
  email: string;
  username: string;
  pageViews: number;
  newFollowers: number;
  earningsThisWeek: number;
}

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
      console.warn('[WEEKLY DIGEST] Unauthorized access attempt - check CRON_SECRET env var');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[WEEKLY DIGEST] Starting weekly digest processing');
    
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    
    const db = admin.firestore();

    // Get all verified users with email addresses
    // Note: We can't use != query because Firestore only returns docs where the field EXISTS
    // Users without emailPreferences.weeklyDigest set should receive digest (default opt-in)
    // We filter out explicit opt-outs in the processing loop below
    const usersSnapshot = await db.collection(getCollectionName('users'))
      .where('emailVerified', '==', true)
      .limit(1000) // Process in batches if needed
      .get();

    console.log(`[WEEKLY DIGEST] Found ${usersSnapshot.size} verified users to process`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let scheduled = 0;

    // Get trending pages for the digest (do this once, not per user)
    const trendingPages = await getTrendingPages(db, 3);

    // OPTIMIZATION: Batch fetch writer balances for all users upfront
    // This eliminates N+1 queries for earnings data
    const userIds = usersSnapshot.docs.map(doc => doc.id);
    const balanceRefs = userIds.map(userId => db.collection(getCollectionName('writerUsdBalances')).doc(userId));

    const balancesMap = new Map<string, number>();
    const chunkSize = 10;
    for (let i = 0; i < balanceRefs.length; i += chunkSize) {
      const chunk = balanceRefs.slice(i, i + chunkSize);
      if (chunk.length > 0) {
        const balanceDocs = await db.getAll(...chunk);
        balanceDocs.forEach(doc => {
          if (doc.exists) {
            const data = doc.data();
            balancesMap.set(doc.id, (data?.pendingUsdCents || 0) / 100);
          }
        });
      }
    }

    console.log(`[WEEKLY DIGEST] Batch fetched ${balancesMap.size} writer balances`);

    // PHASE 1: Collect eligible users first
    interface EligibleUser {
      userId: string;
      email: string;
      username: string;
      stats: { pageViews: number; newFollowers: number; earningsThisWeek: number };
    }
    const eligibleUsers: EligibleUser[] = [];

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Skip users without email
        if (!userData.email) {
          skipped++;
          continue;
        }

        // Skip users who explicitly opted out of weekly digest
        // Note: Default is opt-in (undefined or true means subscribed)
        if (userData.emailPreferences?.weeklyDigest === false) {
          skipped++;
          continue;
        }

        // Get user's weekly stats (optimized - uses pre-fetched balance)
        const stats = await getUserWeeklyStatsOptimized(db, userId, balancesMap.get(userId) || 0);

        // Skip users with no activity (don't spam inactive users)
        if (stats.pageViews === 0 && stats.newFollowers === 0 && stats.earningsThisWeek === 0) {
          skipped++;
          continue;
        }

        eligibleUsers.push({
          userId,
          email: userData.email,
          username: userData.username || 'there',
          stats,
        });

      } catch (userError) {
        console.error(`[WEEKLY DIGEST] Error processing user ${userDoc.id}:`, userError);
        failed++;
      }
    }

    console.log(`[WEEKLY DIGEST] Found ${eligibleUsers.length} eligible users for digest`);

    // PHASE 2: Calculate batch schedule to spread across days
    const batchSchedule = await calculateBatchSchedule(eligibleUsers.length, EmailPriority.P2_ENGAGEMENT);
    console.log(`[WEEKLY DIGEST] Batch schedule: ${JSON.stringify(batchSchedule.schedule)}`);

    // PHASE 3: Send/schedule emails
    for (let i = 0; i < eligibleUsers.length; i++) {
      const user = eligibleUsers[i];
      try {
        // Get scheduled date based on batch schedule
        const scheduledAt = getScheduleDateForBatchIndex(batchSchedule.schedule, i);

        const result = await sendTemplatedEmail({
          templateId: 'weekly-digest',
          to: user.email,
          data: {
            username: user.username,
            pageViews: user.stats.pageViews.toString(),
            newFollowers: user.stats.newFollowers.toString(),
            earningsThisWeek: `$${user.stats.earningsThisWeek.toFixed(2)}`,
            trendingPages
          },
          userId: user.userId,
          triggerSource: 'cron',
          scheduledAt, // Will be undefined for today's batch (send immediately)
          skipRateLimitCheck: true, // We already calculated the schedule
        });

        if (result.success) {
          if (result.wasScheduled) {
            scheduled++;
          } else {
            sent++;
          }
        } else {
          failed++;
        }

        // Rate limit - don't overwhelm Resend
        if ((sent + scheduled) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (userError) {
        console.error(`[WEEKLY DIGEST] Error sending to user ${user.userId}:`, userError);
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[WEEKLY DIGEST] Completed in ${duration}ms - Sent: ${sent}, Scheduled: ${scheduled}, Skipped: ${skipped}, Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      summary: {
        totalUsers: usersSnapshot.size,
        eligible: eligibleUsers.length,
        sentImmediately: sent,
        scheduledForLater: scheduled,
        skipped,
        failed,
        batchSchedule: batchSchedule.schedule,
        durationMs: duration
      }
    });
    
  } catch (error) {
    console.error('[WEEKLY DIGEST] Error:', error);
    return NextResponse.json({
      error: 'Failed to process weekly digest',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get user's stats for the past week (OPTIMIZED version)
 * Uses pre-fetched balance to avoid N+1 queries
 */
async function getUserWeeklyStatsOptimized(
  db: FirebaseFirestore.Firestore,
  userId: string,
  earningsThisWeek: number // Pre-fetched from batch query
): Promise<{
  pageViews: number;
  newFollowers: number;
  earningsThisWeek: number;
}> {
  let pageViews = 0;
  let newFollowers = 0;

  try {
    // Get page views for user's pages - limit to avoid expensive scans
    const pagesSnapshot = await db.collection(getCollectionName('pages'))
      .where('userId', '==', userId)
      .select('weeklyViews', 'views') // Only fetch the fields we need
      .limit(100) // Limit pages per user for performance
      .get();

    // Sum up views (simplified - you may have a separate analytics collection)
    for (const pageDoc of pagesSnapshot.docs) {
      const pageData = pageDoc.data();
      pageViews += pageData.weeklyViews || pageData.views || 0;
    }

    // Get new followers in the last week
    const followersDoc = await db.collection(getCollectionName('userFollowers')).doc(userId).get();
    if (followersDoc.exists) {
      // This is simplified - ideally you'd track when each follow happened
      newFollowers = Math.min(followersDoc.data()?.followers?.length || 0, 10); // Cap at 10 for weekly
    }

  } catch (error) {
    console.error(`[WEEKLY DIGEST] Error getting stats for user ${userId}:`, error);
  }

  return { pageViews, newFollowers, earningsThisWeek };
}

/**
 * Get user's stats for the past week (LEGACY - kept for backwards compatibility)
 */
async function getUserWeeklyStats(db: FirebaseFirestore.Firestore, userId: string): Promise<{
  pageViews: number;
  newFollowers: number;
  earningsThisWeek: number;
}> {
  // Get earnings from balance doc
  let earningsThisWeek = 0;
  try {
    const writerBalanceDoc = await db.collection(getCollectionName('writerUsdBalances')).doc(userId).get();
    if (writerBalanceDoc.exists) {
      const balanceData = writerBalanceDoc.data();
      earningsThisWeek = (balanceData?.pendingUsdCents || 0) / 100;
    }
  } catch (error) {
    console.error(`[WEEKLY DIGEST] Error getting balance for user ${userId}:`, error);
  }

  return getUserWeeklyStatsOptimized(db, userId, earningsThisWeek);
}

/**
 * Get trending pages for the digest
 */
async function getTrendingPages(db: FirebaseFirestore.Firestore, limit: number): Promise<Array<{ title: string; author: string }>> {
  try {
    const trendingSnapshot = await db.collection(getCollectionName('pages'))
      .where('isPublic', '==', true)
      .orderBy('views', 'desc')
      .limit(limit)
      .get();
    
    const pages: Array<{ title: string; author: string }> = [];
    
    for (const doc of trendingSnapshot.docs) {
      const data = doc.data();
      pages.push({
        title: data.title || 'Untitled',
        author: data.username || 'Anonymous'
      });
    }
    
    return pages;
  } catch (error) {
    console.error('[WEEKLY DIGEST] Error getting trending pages:', error);
    return [
      { title: 'Explore WeWrite', author: 'WeWrite Team' }
    ];
  }
}
