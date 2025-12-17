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
import { sendTemplatedEmail } from '../../../services/emailService';

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
    // Verify cron access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const cronApiKey = process.env.CRON_API_KEY;
    
    const isAuthorized = 
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (cronApiKey && authHeader === `Bearer ${cronApiKey}`);

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      console.warn('[WEEKLY DIGEST] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[WEEKLY DIGEST] Starting weekly digest processing');
    
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    
    const db = admin.firestore();
    
    // Get users who opted in to weekly digest emails
    const usersSnapshot = await db.collection(getCollectionName('users'))
      .where('emailPreferences.weeklyDigest', '!=', false)
      .limit(1000) // Process in batches if needed
      .get();
    
    console.log(`[WEEKLY DIGEST] Found ${usersSnapshot.size} users to process`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

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

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Skip users without email or who opted out
        if (!userData.email) {
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

        // Send the digest email
        const success = await sendTemplatedEmail({
          templateId: 'weekly-digest',
          to: userData.email,
          data: {
            username: userData.username || 'there',
            pageViews: stats.pageViews.toString(),
            newFollowers: stats.newFollowers.toString(),
            earningsThisWeek: `$${stats.earningsThisWeek.toFixed(2)}`,
            trendingPages
          },
          userId
        });

        if (success) {
          sent++;
        } else {
          failed++;
        }

        // Rate limit - don't overwhelm Resend
        if (sent % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (userError) {
        console.error(`[WEEKLY DIGEST] Error processing user ${userDoc.id}:`, userError);
        failed++;
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[WEEKLY DIGEST] Completed in ${duration}ms - Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`);
    
    return NextResponse.json({
      success: true,
      summary: {
        totalUsers: usersSnapshot.size,
        sent,
        skipped,
        failed,
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
