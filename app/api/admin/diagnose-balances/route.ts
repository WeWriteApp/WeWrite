/**
 * Balance Diagnosis API
 * 
 * Diagnoses current balance state and determines what needs to be migrated
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { isAdminUser } from '../../../utils/adminUtils';
import { earningsVisualizationService } from '../../../services/earningsVisualizationService';
import { stripeStorageBalanceService } from '../../../services/stripeStorageBalanceService';
import { db } from '../../../firebase/config';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getCollectionName } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      // Verify admin access
      const userId = await getUserIdFromRequest(request);
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const isAdmin = await isAdminUser(userId);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

    console.log(`🔍 [ADMIN] Diagnosing balance state`);

    // Get current Stripe balances
    const stripeBalances = await stripeStorageBalanceService.getBalanceBreakdown();
    
    // Get current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().slice(0, 7);

    // Check for active subscriptions
    const subscriptionsQuery = query(
      collection(db, getCollectionName('subscriptions')),
      where('status', '==', 'active'),
      limit(10)
    );
    const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
    const activeSubscriptions = subscriptionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Check for current month allocations
    const allocationsQuery = query(
      collection(db, getCollectionName('usdAllocations')),
      where('month', '==', currentMonth),
      where('status', '==', 'active'),
      limit(10)
    );
    const allocationsSnapshot = await getDocs(allocationsQuery);
    const currentAllocations = allocationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Check for user balances
    const balancesQuery = query(
      collection(db, getCollectionName('userUsdBalances')),
      limit(10)
    );
    const balancesSnapshot = await getDocs(balancesQuery);
    const userBalances = balancesSnapshot.docs.map(doc => ({
      userId: doc.id,
      ...doc.data()
    }));

    // Try to get financial overview
    let financialOverview = null;
    try {
      financialOverview = await earningsVisualizationService.getPlatformFinancialOverview();
    } catch (error) {
      console.warn('Financial overview not available:', error);
    }

    // Calculate total outstanding obligations
    let totalOutstandingEarnings = 0;
    let totalCurrentAllocations = 0;
    let totalUserBalances = 0;

    // Sum up current allocations
    currentAllocations.forEach(allocation => {
      totalCurrentAllocations += (allocation.usdCents || 0) / 100;
    });

    // Sum up user balances
    userBalances.forEach(balance => {
      totalUserBalances += (balance.availableUsdCents || 0) / 100;
    });

    // Use financial overview if available
    if (financialOverview) {
      totalOutstandingEarnings = financialOverview.outstandingObligations.totalUnpaidEarnings;
    } else {
      // Fallback calculation
      totalOutstandingEarnings = Math.max(totalCurrentAllocations, totalUserBalances);
    }

    const diagnosis = {
      stripeBalances: stripeBalances ? {
        paymentsBalance: stripeBalances.paymentsBalance,
        storageBalance: stripeBalances.storageBalance,
        totalBalance: stripeBalances.totalBalance
      } : null,
      
      systemData: {
        activeSubscriptions: activeSubscriptions.length,
        currentMonthAllocations: currentAllocations.length,
        totalCurrentAllocations,
        usersWithBalances: userBalances.length,
        totalUserBalances,
        totalOutstandingEarnings
      },

      migrationNeeded: {
        needed: totalOutstandingEarnings > 0 && (!stripeBalances || stripeBalances.storageBalance < totalOutstandingEarnings),
        reason: totalOutstandingEarnings > 0 
          ? `Outstanding earnings of $${totalOutstandingEarnings.toFixed(2)} need to be moved to Storage Balance`
          : 'No outstanding earnings found',
        fundsToMove: Math.max(0, totalOutstandingEarnings - (stripeBalances?.storageBalance || 0))
      },

      recommendations: []
    };

    // Generate recommendations
    if (diagnosis.stripeBalances?.paymentsBalance < 0) {
      diagnosis.recommendations.push('Negative Payments Balance detected - may need to add funds to account');
    }

    if (diagnosis.systemData.totalOutstandingEarnings > 0) {
      diagnosis.recommendations.push(`Move $${diagnosis.systemData.totalOutstandingEarnings.toFixed(2)} to Storage Balance for creator obligations`);
    }

    if (diagnosis.systemData.activeSubscriptions === 0) {
      diagnosis.recommendations.push('No active subscriptions found - this may be a test environment');
    }

    if (diagnosis.systemData.currentMonthAllocations === 0) {
      diagnosis.recommendations.push('No current month allocations found - users may not be actively allocating');
    }

    // Sample data for debugging
    const sampleData = {
      sampleSubscription: activeSubscriptions[0] || null,
      sampleAllocation: currentAllocations[0] || null,
      sampleUserBalance: userBalances[0] || null
    };

    return NextResponse.json({
      success: true,
      diagnosis,
      sampleData,
      currentMonth,
      lastMonth: lastMonthStr,
      financialOverviewAvailable: !!financialOverview,
      nextSteps: diagnosis.migrationNeeded.needed 
        ? [
            'Execute historical fund migration',
            'Move outstanding earnings to Storage Balance',
            'Verify fund separation after migration'
          ]
        : [
            'System appears to be in correct state',
            'Monitor for new allocations',
            'Verify monthly processing is working'
          ]
    });

    } catch (error) {
      console.error('❌ [ADMIN] Error diagnosing balances:', error);
      return NextResponse.json({
        error: 'Failed to diagnose balance state',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }); // End withAdminContext
}
