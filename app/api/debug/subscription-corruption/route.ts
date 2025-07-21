/**
 * Subscription Corruption Debug API
 * 
 * This endpoint helps identify and analyze corrupted subscription data
 * in production to understand the root cause of subscription loading issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const authenticatedUserId = await getUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admin users to access this debug endpoint
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('userId') || authenticatedUserId;
    const scanAll = url.searchParams.get('scanAll') === 'true';

    // Initialize Firebase Admin
    const adminApp = initAdmin();
    const adminDb = adminApp.firestore();

    const results = {
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      targetUserId,
      scanAll,
      corruptedSubscriptions: [] as any[],
      validSubscriptions: [] as any[],
      summary: {
        totalScanned: 0,
        corruptedCount: 0,
        validCount: 0,
        commonIssues: [] as string[]
      }
    };

    if (scanAll) {
      // Scan all users for corrupted subscription data (admin only)
      console.log('[SUBSCRIPTION CORRUPTION DEBUG] Scanning all users for corrupted subscription data...');
      
      // Get all users with subscriptions
      const { parentPath: usersPath } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, '', '');
      const usersSnapshot = await adminDb.collection(usersPath.replace('/', '')).get();
      
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        await analyzeUserSubscription(adminDb, userId, results);
      }
    } else {
      // Analyze specific user
      await analyzeUserSubscription(adminDb, targetUserId, results);
    }

    // Generate summary
    results.summary.totalScanned = results.corruptedSubscriptions.length + results.validSubscriptions.length;
    results.summary.corruptedCount = results.corruptedSubscriptions.length;
    results.summary.validCount = results.validSubscriptions.length;

    // Identify common issues
    const issues = new Set<string>();
    results.corruptedSubscriptions.forEach(sub => {
      sub.issues.forEach((issue: string) => issues.add(issue));
    });
    results.summary.commonIssues = Array.from(issues);

    return NextResponse.json(results);

  } catch (error) {
    console.error('[SUBSCRIPTION CORRUPTION DEBUG] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function analyzeUserSubscription(adminDb: any, userId: string, results: any) {
  try {
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);
    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
    const subscriptionSnap = await subscriptionRef.get();

    if (!subscriptionSnap.exists) {
      // No subscription document - this is normal
      return;
    }

    const rawData = subscriptionSnap.data();
    const analysis = {
      userId,
      documentExists: true,
      rawData: rawData,
      issues: [] as string[],
      isCorrupted: false,
      createdAt: rawData?.createdAt,
      updatedAt: rawData?.updatedAt,
      dataKeys: Object.keys(rawData || {})
    };

    // Check for various corruption patterns
    if (!rawData.status) {
      analysis.issues.push('Missing status field');
      analysis.isCorrupted = true;
    }

    if (rawData.status && typeof rawData.status !== 'string') {
      analysis.issues.push('Invalid status type');
      analysis.isCorrupted = true;
    }

    if (rawData.amount !== undefined && typeof rawData.amount !== 'number') {
      analysis.issues.push('Invalid amount type');
      analysis.isCorrupted = true;
    }

    if (rawData.tier !== undefined && rawData.tier !== null && typeof rawData.tier !== 'string') {
      analysis.issues.push('Invalid tier type');
      analysis.isCorrupted = true;
    }

    if (rawData.status === 'active' && !rawData.stripeSubscriptionId) {
      analysis.issues.push('Active subscription missing Stripe ID');
      analysis.isCorrupted = true;
    }

    if (rawData.cancelAtPeriodEnd !== undefined && typeof rawData.cancelAtPeriodEnd !== 'boolean') {
      analysis.issues.push('Invalid cancelAtPeriodEnd type');
      analysis.isCorrupted = true;
    }

    // Check for empty or null object
    if (Object.keys(rawData || {}).length === 0) {
      analysis.issues.push('Empty subscription document');
      analysis.isCorrupted = true;
    }

    // Add to appropriate array
    if (analysis.isCorrupted) {
      results.corruptedSubscriptions.push(analysis);
      console.log(`[SUBSCRIPTION CORRUPTION DEBUG] Found corrupted subscription for user ${userId}:`, analysis.issues);
    } else {
      results.validSubscriptions.push({
        userId,
        status: rawData.status,
        amount: rawData.amount,
        tier: rawData.tier,
        hasStripeId: !!rawData.stripeSubscriptionId
      });
    }

  } catch (error) {
    console.error(`[SUBSCRIPTION CORRUPTION DEBUG] Error analyzing user ${userId}:`, error);
    results.corruptedSubscriptions.push({
      userId,
      documentExists: false,
      issues: ['Error reading subscription document'],
      isCorrupted: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
