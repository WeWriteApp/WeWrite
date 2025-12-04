/**
 * Admin API: User Management
 * Provides endpoints for managing users in the admin panel
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { isAdminServer } from '../../admin-auth-helper';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';

interface UserData {
  uid: string;
  email: string;
  username?: string;
  emailVerified: boolean;
  createdAt: any;
  lastLogin?: any;
  totalPages?: number;
  // Feature flags removed - all features are now always enabled
  stripeConnectedAccountId?: string | null;
  isAdmin?: boolean;
  financial?: {
    hasSubscription: boolean;
    subscriptionAmount?: number | null;
    subscriptionStatus?: string | null;
    subscriptionCancelReason?: string | null;
    availableEarningsUsd?: number;
    payoutsSetup: boolean;
    earningsTotalUsd?: number;
    earningsThisMonthUsd?: number;
  };
}

// GET endpoint - Get all users with their details and feature flag overrides
export async function GET(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    let admin;
    try {
      admin = getFirebaseAdmin();
    } catch (initError: any) {
      console.error('[Admin Users API] Firebase Admin initialization error:', initError.message);
      return NextResponse.json({ 
        error: 'Firebase Admin initialization failed',
        details: initError.message
      }, { status: 500 });
    }
    
    if (!admin) {
      console.error('[Admin Users API] Firebase Admin failed to initialize');
      return NextResponse.json({ 
        error: 'Firebase Admin not available',
        details: 'Server configuration issue - check environment variables'
      }, { status: 500 });
    }
    const db = admin.firestore();

    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email to check admin status (allow dev bypass locally)
    const userRecord = await admin.auth().getUser(userId);
    const userEmail = userRecord.email;
    if (!userEmail || !isAdminServer(userEmail)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const searchTerm = searchParams.get('search');
    const includeFinancial = searchParams.get('includeFinancial') === 'true';
    const countOnly = searchParams.get('countOnly') === 'true';

    console.log('Loading users from Firestore via API...');

    // Query Firestore for user documents
    let usersQuery = db.collection(getCollectionName('users'))
      .orderBy('createdAt', 'desc')
      .limit(limit);

    let snapshot;
    try {
      snapshot = await usersQuery.get();
    } catch (orderingError) {
      console.warn('Order by createdAt failed; falling back to unordered fetch:', orderingError);
      snapshot = await db.collection(getCollectionName('users')).limit(limit).get();
    }

    if (snapshot.empty) {
      console.warn('No users found in Firestore');
      return NextResponse.json({
        success: true,
        users: [],
        message: 'No users found in the database'
      });
    }

    console.log(`Found ${snapshot.docs.length} users in Firestore`);
    const userData: UserData[] = [];

    // If only the count is needed, try using Firestore count() for accuracy
    if (countOnly) {
      try {
        const usersCollection = db.collection(getCollectionName('users'));
        // Use count() if available (Firestore v11+), otherwise fallback to snapshot size
        if (typeof (usersCollection as any).count === 'function') {
          const countSnap = await (usersCollection as any).count().get();
          const totalCount = countSnap.data()?.count ?? snapshot.size;
          return NextResponse.json({ success: true, total: totalCount });
        }
      } catch (countError) {
        console.warn('Count query failed, falling back to snapshot size:', countError);
      }
      return NextResponse.json({ success: true, total: snapshot.size });
    }

    // Reuse pages collection reference for counts
    const pagesCollection = db.collection(getCollectionName('pages'));

    for (const userDoc of snapshot.docs) {
      try {
        const data = userDoc.data();

        // Get email verification status from Firebase Auth
        let emailVerified = false;
        try {
          const authUser = await admin.auth().getUser(userDoc.id);
          emailVerified = authUser.emailVerified;
        } catch (authError) {
          console.warn(`Could not get auth data for user ${userDoc.id}:`, authError.message);
        }

        const user: UserData = {
          uid: userDoc.id,
          email: data.email || 'No email',
          username: data.username,
          emailVerified,
          createdAt: data.createdAt,
          lastLogin: data.lastLogin,
          stripeConnectedAccountId: data.stripeConnectedAccountId || null,
          isAdmin: data.isAdmin === true || (userEmail ? isAdminServer(data.email || '') : false)
        };

        // Total pages (non-deleted) for this user
        try {
          const pagesQuery = pagesCollection.where('userId', '==', userDoc.id);
          if (typeof (pagesQuery as any).count === 'function') {
            const countSnap = await (pagesQuery as any).count().get();
            user.totalPages = countSnap.data()?.count ?? 0;
          } else {
            const pagesSnap = await pagesQuery.get();
            user.totalPages = pagesSnap.size;
          }
        } catch (pagesErr) {
          console.warn(`Could not count pages for user ${userDoc.id}:`, pagesErr);
        }

        if (includeFinancial) {
          try {
            const balanceDoc = await db.collection(getCollectionName('usdBalances')).doc(userDoc.id).get();
            const writerBalanceDoc = await db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(userDoc.id).get();
            const balanceData = balanceDoc.data() || {};
            const writerBalance = writerBalanceDoc.data() || {};

            const subscriptionAmount =
              balanceData.subscriptionAmount ??
              (balanceData.monthlyAllocationCents ? balanceData.monthlyAllocationCents / 100 : null);

            const subscriptionStatus =
              balanceData.subscriptionStatus ??
              balanceData.status ??
              null;

            const subscriptionCancelReason =
              balanceData.subscriptionCancellationReason ??
              balanceData.cancelReason ??
              null;

            const availableEarningsUsd =
              writerBalance.availableCents !== undefined ? writerBalance.availableCents / 100 : undefined;
            const earningsTotalUsd =
              writerBalance.totalUsdCentsEarned !== undefined
                ? writerBalance.totalUsdCentsEarned / 100
                : writerBalance.totalCents !== undefined
                ? writerBalance.totalCents / 100
                : undefined;
            const earningsThisMonthUsd =
              writerBalance.pendingUsdCents !== undefined ? writerBalance.pendingUsdCents / 100 : undefined;

            user.financial = {
              hasSubscription: Boolean(subscriptionAmount && subscriptionAmount > 0),
              subscriptionAmount: subscriptionAmount ?? null,
              subscriptionStatus,
              subscriptionCancelReason,
              availableEarningsUsd,
              earningsTotalUsd,
              earningsThisMonthUsd,
              payoutsSetup: Boolean(user.stripeConnectedAccountId)
            };
          } catch (finError) {
            console.warn(`Financial data fetch failed for user ${userDoc.id}:`, finError);
          }
        }

        // Apply search filter if provided
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const emailMatch = user.email.toLowerCase().includes(searchLower);
          const usernameMatch = user.username?.toLowerCase().includes(searchLower);

          if (emailMatch || usernameMatch) {
            userData.push(user);
          }
        } else {
          userData.push(user);
        }

      } catch (error) {
        console.error(`Error processing user ${userDoc.id}:`, error);
        // Continue processing other users
      }
    }

    console.log(`Processed ${userData.length} users successfully`);

    return NextResponse.json({
      success: true,
      users: userData,
      total: userData.length
    });

  } catch (error) {
    console.error('Error loading users:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load users',
      details: error.message
    }, { status: 500 });
  }
}

// POST endpoint - Update user feature flag overrides
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email to check admin status
    const userRecord = await admin.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || !isAdminServer(userEmail)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Feature flags have been removed - this endpoint no longer handles feature flag updates
    return NextResponse.json({
      error: 'Feature flags have been removed from the system'
    }, { status: 410 }); // 410 Gone - resource no longer available

    // This code is unreachable since we return early above

  } catch (error) {
    console.error('Error updating user feature flag:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update feature flag',
      details: error.message
    }, { status: 500 });
  }
}
