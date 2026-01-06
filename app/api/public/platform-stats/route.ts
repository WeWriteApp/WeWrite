/**
 * Public Platform Statistics API
 * Provides basic platform statistics for public display (landing page, etc.)
 * Always uses production collections for accurate data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

interface PlatformStats {
  totalUsers: number;
  totalPayouts: number;
  pagesLast30Days: number;
  lastUpdated: string;
}

// Cache for platform statistics (5 minute cache)
let statsCache: { data: PlatformStats; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// GET endpoint - Get public platform statistics
export async function GET(request: NextRequest) {
  try {
    // Check cache first for faster response
    const now = Date.now();
    if (statsCache && (now - statsCache.timestamp) < CACHE_DURATION) {
      console.log('Returning cached platform statistics');
      return createApiResponse({
        ...statsCache.data,
        note: 'Public platform statistics from production data (cached)',
        cached: true
      });
    }

    const admin = getFirebaseAdmin();
    const db = admin!.firestore();

    console.log('Fetching fresh platform statistics from production collections...');

    // Always use production collections for public stats
    const PRODUCTION_USERS_COLLECTION = 'users';
    const PRODUCTION_WRITER_USD_EARNINGS_COLLECTION = 'writerUsdEarnings';
    const PRODUCTION_PAGES_COLLECTION = 'pages';

    // Calculate 30 days ago for rolling page count
    // Use ISO string format since pages store createdAt as ISO strings
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    // Parallel execution for faster response
    const [usersSnapshot, earningsSnapshot, pagesLast30DaysSnapshot] = await Promise.all([
      // Get total user count (fast count operation)
      db.collection(PRODUCTION_USERS_COLLECTION).count().get(),
      // Get writer earnings (Phase 2 - single source of truth)
      db.collection(PRODUCTION_WRITER_USD_EARNINGS_COLLECTION)
        .select('totalUsdCentsReceived', 'totalCentsReceived', 'status')
        .get(),
      // Get pages created in the last 30 days (count operation)
      // Using ISO string comparison since createdAt is stored as ISO strings
      db.collection(PRODUCTION_PAGES_COLLECTION)
        .where('createdAt', '>=', thirtyDaysAgoISO)
        .count()
        .get()
    ]);

    const totalUsers = usersSnapshot.data().count;
    const pagesLast30Days = pagesLast30DaysSnapshot.data().count;
    console.log(`Total users in production: ${totalUsers}`);
    console.log(`Pages created in last 30 days: ${pagesLast30Days} (since ${thirtyDaysAgoISO})`);

    // Calculate total earnings from earnings records (Phase 2 - single source of truth)
    let totalFromEarnings = 0;
    let earningsRecordsProcessed = 0;

    earningsSnapshot.docs.forEach(doc => {
      const earning = doc.data();
      earningsRecordsProcessed++;

      // Sum all earnings regardless of status (pending, available, paid_out)
      const cents = earning.totalUsdCentsReceived || earning.totalCentsReceived || 0;
      totalFromEarnings += cents;
    });

    console.log(`Processed ${earningsRecordsProcessed} writer earnings records`);
    console.log(`Total from earnings: $${(totalFromEarnings / 100).toFixed(2)}`);

    // Use total from earnings (includes pending + available + paid_out) for transparency
    // This shows the total value that has been earned by writers
    const totalPayouts = Math.round(totalFromEarnings / 100 * 100) / 100; // Convert cents to dollars

    const stats: PlatformStats = {
      totalUsers,
      totalPayouts,
      pagesLast30Days,
      lastUpdated: new Date().toISOString()
    };

    // Cache the results
    statsCache = {
      data: stats,
      timestamp: now
    };

    console.log('Public platform stats (fresh):', stats);

    return createApiResponse({
      ...stats,
      note: 'Public platform statistics from production data (fresh)',
      cached: false
    });

  } catch (error) {
    console.error('Error fetching public platform stats:', error);

    // If we have cached data, return it even if stale
    if (statsCache) {
      console.log('Returning stale cached data due to error');
      return createApiResponse({
        ...statsCache.data,
        note: 'Public platform statistics from production data (stale cache)',
        cached: true,
        stale: true
      });
    }

    // Never return false data - return error instead
    return createErrorResponse('Unable to fetch platform statistics', 'INTERNAL_ERROR');
  }
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'X-Service': 'public-platform-stats-api',
      'X-Timestamp': new Date().toISOString()
    }
  });
}
