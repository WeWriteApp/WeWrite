/**
 * API endpoint to verify token allocation data pipeline
 * Admin-only endpoint to check if token data is being properly collected
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, limit, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { isAdmin } from '../../../utils/isAdmin';
import { getServerSession } from 'next-auth/next';
import { AdminDataService } from '../../../services/adminDataService';

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const session = await getServerSession();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Admin verification: Checking token allocation data pipeline (PRODUCTION DATA)...');

    // Check token balances collection - always use production data for admin
    const balancesSnapshot = await AdminDataService.getTokenBalances(10);
    
    let sampleBalance = null;
    if (balancesSnapshot.size > 0) {
      const data = balancesSnapshot.docs[0].data();
      sampleBalance = {
        userId: data.userId,
        totalTokens: data.totalTokens,
        allocatedTokens: data.allocatedTokens,
        availableTokens: data.availableTokens,
        lastAllocationDate: data.lastAllocationDate
      };
    }

    // Check token allocations collection - always use production data for admin
    const allocationsSnapshot = await AdminDataService.getTokenAllocations(10);
    
    let sampleAllocation = null;
    if (allocationsSnapshot.size > 0) {
      const data = allocationsSnapshot.docs[0].data();
      sampleAllocation = {
        userId: data.userId,
        recipientUserId: data.recipientUserId,
        resourceType: data.resourceType,
        tokens: data.tokens,
        month: data.month,
        status: data.status,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    }

    // Check recent allocations (last 30 days) - always use production data for admin
    const recentSnapshot = await AdminDataService.getRecentTokenAllocations(30);

    // Calculate summary statistics
    let totalTokensAllocated = 0;
    const uniqueUsers = new Set();
    const uniqueRecipients = new Set();
    
    recentSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalTokensAllocated += data.tokens || 0;
      uniqueUsers.add(data.userId);
      uniqueRecipients.add(data.recipientUserId);
    });

    // Check analytics events for token allocations
    const analyticsQuery = query(
      collection(db, 'analytics_events'),
      where('category', '==', 'subscription'),
      where('action', 'in', ['first_token_allocation', 'ongoing_token_allocation']),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const analyticsSnapshot = await getDocs(analyticsQuery);

    const result = {
      tokenBalances: {
        count: balancesSnapshot.size,
        sample: sampleBalance
      },
      tokenAllocations: {
        count: allocationsSnapshot.size,
        sample: sampleAllocation
      },
      recentActivity: {
        allocationsLast30Days: recentSnapshot.size,
        totalTokensAllocated,
        uniqueAllocators: uniqueUsers.size,
        uniqueRecipients: uniqueRecipients.size
      },
      analyticsEvents: {
        count: analyticsSnapshot.size
      },
      status: 'healthy',
      timestamp: new Date().toISOString()
    };

    console.log('✅ Token data verification complete:', result);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error verifying token data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify token data'
    }, { status: 500 });
  }
}
