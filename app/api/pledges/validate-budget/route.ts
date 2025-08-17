import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';

/**
 * API endpoint to validate pledge budget
 * Returns budget validation result with categorized pledges
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Get user's subscription budget
    const subscriptionRef = db.collection('users').doc(userId).collection('subscription').doc('current');
    const subscriptionDoc = await subscriptionRef.get();

    let subscriptionBudget = 0;
    let subscriptionStatus = 'none';
    let isActive = false;
    let cancelAtPeriodEnd = false;
    let currentPeriodEnd: string | null = null;

    if (subscriptionDoc.exists) {
      const subData = subscriptionDoc.data();
      // Convert subscription amount (dollars) to USD cents for comparison
      subscriptionBudget = (subData?.amount || 0) * 100;
      subscriptionStatus = subData?.status || 'none';
      cancelAtPeriodEnd = subData?.cancelAtPeriodEnd || false;
      currentPeriodEnd = subData?.currentPeriodEnd || null;

      // Check if subscription is active or cancelled but still in billing period
      isActive = ['active', 'trialing'].includes(subscriptionStatus);

      // If cancelled but still in billing period, treat as active for pledge purposes
      if ((subscriptionStatus === 'cancelled' || subscriptionStatus === 'canceled') &&
          cancelAtPeriodEnd && currentPeriodEnd) {
        const periodEndDate = new Date(currentPeriodEnd);
        const now = new Date();
        if (periodEndDate > now) {
          isActive = true; // Still active until period end
        }
      }
    }

    // Get user's pledges from USD allocations
    const { getCurrentMonth } = await import('../../../utils/usdConstants');
    const { getCollectionName, USD_COLLECTIONS } = await import('../../../utils/environmentConfig');

    const currentMonth = getCurrentMonth();
    const allocationsQuery = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS))
      .where('userId', '==', userId)
      .where('resourceType', '==', 'page')
      .where('month', '==', currentMonth)
      .where('status', '==', 'active');

    const allocationsSnapshot = await allocationsQuery.get();
    const pledges: any[] = [];

    // PERFORMANCE OPTIMIZATION: Batch fetch page and user data
    const pageIds = new Set<string>();
    const userIds = new Set<string>();

    // Collect all unique page IDs
    allocationsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.resourceId) pageIds.add(data.resourceId);
    });

    // Batch fetch pages
    const pagePromises = Array.from(pageIds).map(async (pageId) => {
      try {
        const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();
        if (pageDoc.exists) {
          const pageData = pageDoc.data();
          if (pageData?.userId) userIds.add(pageData.userId);
          return { id: pageId, data: pageData };
        }
      } catch (error) {
        console.warn(`Error fetching page ${pageId}:`, error);
      }
      return { id: pageId, data: null };
    });

    const pageResults = await Promise.all(pagePromises);

    // Batch fetch users
    const userPromises = Array.from(userIds).map(async (userId) => {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          return { id: userId, data: userDoc.data() };
        }
      } catch (error) {
        console.warn(`Error fetching user ${userId}:`, error);
      }
      return { id: userId, data: null };
    });

    const userResults = await Promise.all(userPromises);

    // Create lookup maps
    const pageMap = new Map();
    const userMap = new Map();

    pageResults.forEach(result => {
      pageMap.set(result.id, result.data);
    });

    userResults.forEach(result => {
      userMap.set(result.id, result.data);
    });

    // Process pledges using lookup maps
    for (const doc of allocationsSnapshot.docs) {
      const data = doc.data();

      const pageData = pageMap.get(data.resourceId);
      const pageTitle = pageData?.title || 'Unknown Page';
      const authorData = userMap.get(pageData?.userId);
      const authorUsername = authorData?.username || 'Unknown Author';

      pledges.push({
        id: doc.id,
        pageId: data.resourceId,
        pageTitle,
        authorId: data.recipientUserId || '',
        authorUsername,
        amount: data.usdCents || 0, // Use USD cents directly
        status: data.status || 'active',
        originalAmount: data.usdCents || 0, // Use USD cents directly
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        month: data.month
      });
    }

    // Calculate budget validation
    const sortedPledges = [...pledges].sort((a, b) => b.amount - a.amount);
    const totalPledges = pledges.reduce((sum, pledge) => sum + pledge.amount, 0);
    const overBudgetAmount = Math.max(0, totalPledges - subscriptionBudget);
    const isOverBudget = overBudgetAmount > 0;

    let activePledges: any[] = [];
    let suspendedPledges: any[] = [];
    let runningTotal = 0;

    // If subscription is inactive, all pledges are suspended
    if (!isActive) {
      suspendedPledges = sortedPledges.map(pledge => ({
        ...pledge,
        status: 'suspended',
        suspensionReason: 'subscription_inactive'
      }));
    } else {
      // Categorize pledges based on budget constraints
      // Prioritize smallest pledges (keep them active), suspend largest ones first
      const smallestFirst = [...sortedPledges].reverse(); // Smallest first

      for (const pledge of smallestFirst) {
        if (runningTotal + pledge.amount <= subscriptionBudget) {
          // Can afford this pledge - keep it active
          activePledges.push({
            ...pledge,
            status: 'active'
          });
          runningTotal += pledge.amount;
        } else {
          // Cannot afford this pledge - suspend it (largest pledges get suspended first)
          suspendedPledges.push({
            ...pledge,
            status: 'over_budget',
            suspensionReason: 'insufficient_budget'
          });
        }
      }

      // Sort results for display:
      // Active pledges: largest first (for easy management)
      // Suspended pledges: largest first (so users can reduce largest ones first)
      activePledges.sort((a, b) => b.amount - a.amount);
      suspendedPledges.sort((a, b) => b.amount - a.amount);
    }

    const validation = {
      totalPledges,
      subscriptionBudget,
      overBudgetAmount,
      activePledges,
      suspendedPledges,
      isOverBudget,
      canAffordAll: !isOverBudget && isActive
    };

    return NextResponse.json({ validation });
  } catch (error) {
    console.error('Error validating pledge budget:', error);
    return NextResponse.json(
      { error: 'Failed to validate pledge budget' },
      { status: 500 }
    );
  }
}