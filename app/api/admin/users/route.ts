/**
 * Admin API: User Management
 * Provides endpoints for managing users in the admin panel
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions, isAdminServer } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionNameAsync, getEnvironmentType, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';

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
  referredBy?: string;
  referredByUsername?: string;
  referralSource?: string;
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

    // Verify admin access using session cookie (avoids firebase-admin auth/jose issues)
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }
    const adminEmail = adminCheck.userEmail;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const searchTerm = searchParams.get('search');
    const includeFinancial = searchParams.get('includeFinancial') === 'true';
    const countOnly = searchParams.get('countOnly') === 'true';

    console.log('Loading users from Firestore via API...');

    // Pre-compute collection names (async to support X-Force-Production-Data header)
    const usersCollectionName = await getCollectionNameAsync('users');
    const pagesCollectionName = await getCollectionNameAsync('pages');
    const usdBalancesCollectionName = await getCollectionNameAsync('usdBalances');
    const writerEarningsCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.WRITER_USD_EARNINGS);

    // Pre-fetch active Stripe subscriptions if financial data is requested
    // This ensures we show accurate subscription status from Stripe (source of truth)
    const activeStripeSubscriptions = new Map<string, { amountCents: number; status: string }>();
    if (includeFinancial) {
      try {
        const stripeKey = getStripeSecretKey();
        if (stripeKey) {
          const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
          const subscriptions = await stripe.subscriptions.list({
            status: 'active',
            limit: 100,
            expand: ['data.items.data.price']
          });

          for (const sub of subscriptions.data) {
            const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
            if (customerId) {
              const item = sub.items.data[0];
              activeStripeSubscriptions.set(customerId, {
                amountCents: item?.price?.unit_amount || 0,
                status: sub.status
              });
            }
          }
          console.log(`[Admin Users] Fetched ${activeStripeSubscriptions.size} active Stripe subscriptions`);
        }
      } catch (stripeErr) {
        console.warn('[Admin Users] Could not fetch Stripe subscriptions:', stripeErr);
      }
    }

    // Query Firestore for user documents
    let usersQuery = db.collection(usersCollectionName)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    let snapshot;
    try {
      snapshot = await usersQuery.get();
    } catch (orderingError) {
      console.warn('Order by createdAt failed; falling back to unordered fetch:', orderingError);
      snapshot = await db.collection(usersCollectionName).limit(limit).get();
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
        const usersCollection = db.collection(usersCollectionName);
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
    const pagesCollection = db.collection(pagesCollectionName);

    for (const userDoc of snapshot.docs) {
      try {
        const data = userDoc.data();

        // Get email verification status from Firestore data
        // (Avoid using admin.auth().getUser() which causes jose issues in Vercel)
        const emailVerified = data.emailVerified === true;

        // Handle both lastLogin and lastLoginAt field names (codebase inconsistency)
        // lastLoginAt is used by session/register code, lastLogin by some older code
        const lastLoginValue = data.lastLoginAt || data.lastLogin || null;

        // In dev environment, all users are admins (for testing purposes)
        const isDev = getEnvironmentType() === 'development';
        
        const user: UserData = {
          uid: userDoc.id,
          email: data.email || 'No email',
          username: data.username,
          emailVerified,
          createdAt: data.createdAt,
          lastLogin: lastLoginValue,
          stripeConnectedAccountId: data.stripeConnectedAccountId || null,
          isAdmin: isDev || data.isAdmin === true || isAdminServer(data.email || ''),
          referredBy: data.referredBy || undefined,
          referralSource: data.referralSource || undefined
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
            const balanceDoc = await db.collection(usdBalancesCollectionName).doc(userDoc.id).get();
            const balanceData = balanceDoc.data() || {};

            // Phase 2: Calculate writer balance from earnings records (single source of truth)
            let availableEarningsUsd: number | undefined;
            let earningsTotalUsd: number | undefined;
            let earningsThisMonthUsd: number | undefined;

            const earningsQuery = db.collection(writerEarningsCollectionName)
              .where('userId', '==', userDoc.id);
            const earningsSnapshot = await earningsQuery.get();

            if (!earningsSnapshot.empty) {
              let totalCents = 0;
              let availableCents = 0;
              let pendingCents = 0;

              earningsSnapshot.docs.forEach(doc => {
                const earning = doc.data();
                const cents = earning.totalUsdCentsReceived || earning.totalCentsReceived || 0;
                totalCents += cents;

                if (earning.status === 'pending') {
                  pendingCents += cents;
                } else if (earning.status === 'available') {
                  availableCents += cents;
                }
              });

              earningsTotalUsd = totalCents / 100;
              availableEarningsUsd = availableCents / 100;
              earningsThisMonthUsd = pendingCents / 100;
            }

            // Get user's Stripe customer ID to verify subscription status against Stripe
            const stripeCustomerId = data.stripeCustomerId;
            const stripeSubData = stripeCustomerId ? activeStripeSubscriptions.get(stripeCustomerId) : null;

            // Use Stripe as source of truth for subscription status
            // Firebase data may be stale if webhook didn't update correctly
            let subscriptionAmount: number | null = null;
            let subscriptionStatus: string | null = null;

            if (stripeSubData) {
              // User has active subscription in Stripe
              subscriptionAmount = stripeSubData.amountCents / 100;
              subscriptionStatus = 'active';
            } else if (balanceData.monthlyAllocationCents > 0 || balanceData.subscriptionAmount > 0) {
              // Firebase shows subscription but Stripe doesn't have active one - cancelled
              subscriptionAmount = balanceData.subscriptionAmount ??
                (balanceData.monthlyAllocationCents ? balanceData.monthlyAllocationCents / 100 : null);
              subscriptionStatus = 'cancelled';
            }

            const subscriptionCancelReason =
              balanceData.subscriptionCancellationReason ??
              balanceData.cancelReason ??
              null;

            user.financial = {
              hasSubscription: subscriptionStatus === 'active',
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

    // Resolve referrer usernames for users that have referredBy
    const referrerUids = [...new Set(userData.filter(u => u.referredBy).map(u => u.referredBy!))];
    if (referrerUids.length > 0) {
      console.log(`[Admin Users] Resolving ${referrerUids.length} unique referrer usernames`);
      const referrerUsernameMap = new Map<string, string>();

      // Batch fetch referrer documents (Firestore 'in' query supports up to 30 items)
      const batchSize = 30;
      for (let i = 0; i < referrerUids.length; i += batchSize) {
        const batch = referrerUids.slice(i, i + batchSize);
        try {
          const referrerDocs = await Promise.all(
            batch.map(uid => db.collection(usersCollectionName).doc(uid).get())
          );
          for (const doc of referrerDocs) {
            if (doc.exists) {
              const refData = doc.data();
              if (refData?.username) {
                referrerUsernameMap.set(doc.id, refData.username);
              }
            }
          }
        } catch (refErr) {
          console.warn('[Admin Users] Error fetching referrer usernames:', refErr);
        }
      }

      // Apply referrer usernames to user data
      for (const user of userData) {
        if (user.referredBy && referrerUsernameMap.has(user.referredBy)) {
          user.referredByUsername = referrerUsernameMap.get(user.referredBy);
        }
      }
      console.log(`[Admin Users] Resolved ${referrerUsernameMap.size} referrer usernames`);
    }

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

    // Verify admin access using session cookie
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
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
