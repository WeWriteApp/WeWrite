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
  pagesThisMonth: number;
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
    const PRODUCTION_WRITER_USD_BALANCES_COLLECTION = 'writerUsdBalances';
    const PRODUCTION_PAGES_COLLECTION = 'pages';

    // Calculate first day of current month for pages query
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Parallel execution for faster response
    const [usersSnapshot, balancesSnapshot, pagesThisMonthSnapshot] = await Promise.all([
      // Get total user count (fast count operation)
      db.collection(PRODUCTION_USERS_COLLECTION).count().get(),
      // Get writer balances (limit to reduce processing time)
      db.collection(PRODUCTION_WRITER_USD_BALANCES_COLLECTION)
        .select('pendingUsdCents', 'availableUsdCents', 'totalPaidUsdCents')
        .get(),
      // Get pages created this month (count operation)
      db.collection(PRODUCTION_PAGES_COLLECTION)
        .where('createdAt', '>=', startOfMonth)
        .count()
        .get()
    ]);

    const totalUsers = usersSnapshot.data().count;
    const pagesThisMonth = pagesThisMonthSnapshot.data().count;
    console.log(`Total users in production: ${totalUsers}`);
    console.log(`Pages created this month: ${pagesThisMonth}`);

    // Process balances efficiently
    let totalFromBalances = 0;
    let balanceRecordsProcessed = 0;

    balancesSnapshot.docs.forEach(doc => {
      const balance = doc.data();
      balanceRecordsProcessed++;

      // Sum all earnings (pending + available + paid)
      const pendingCents = balance.pendingUsdCents || 0;
      const availableCents = balance.availableUsdCents || 0;
      const paidCents = balance.totalPaidUsdCents || 0;

      // Total includes all earnings (pending + available + paid)
      totalFromBalances += pendingCents + availableCents + paidCents;
    });

    console.log(`Processed ${balanceRecordsProcessed} writer balance records`);
    console.log(`Total from balances: $${(totalFromBalances / 100).toFixed(2)}`);

    // Use total from balances (includes pending + available + paid) for transparency
    // This shows the total value that has been earned by writers
    const totalPayouts = Math.round(totalFromBalances / 100 * 100) / 100; // Convert cents to dollars

    const stats: PlatformStats = {
      totalUsers,
      totalPayouts,
      pagesThisMonth,
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
