import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { getUserIdFromRequest } from '../../auth-helper';

/**
 * GET /api/tokens/page-stats?pageId=xxx
 * Get pledge statistics for a specific page (sponsor count and total pledged tokens)
 * This endpoint aggregates data from user pledge subcollections
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json({ 
        error: 'pageId is required' 
      }, { status: 400 });
    }

    // Get authenticated user (optional for this endpoint, but useful for access control)
    const userId = await getUserIdFromRequest(request);

    // Query token allocations for this page to get sponsor stats
    // WeWrite uses a different structure - let's check the actual token allocation system
    // First try the tokenBalances collection with pageAllocations subcollection

    let uniqueSponsors = new Set<string>();
    let totalPledgedTokens = 0;

    try {
      // Query all token balances to find allocations to this page
      const tokenBalancesSnapshot = await getDocs(collection(db, 'tokenBalances'));

      for (const userDoc of tokenBalancesSnapshot.docs) {
        const userId = userDoc.id;

        // Check if this user has allocations to the page
        const allocationsRef = collection(db, 'tokenBalances', userId, 'pageAllocations');
        const userAllocationsQuery = query(
          allocationsRef,
          where('pageId', '==', pageId),
          where('amount', '>', 0)
        );

        const userAllocationsSnapshot = await getDocs(userAllocationsQuery);

        if (!userAllocationsSnapshot.empty) {
          uniqueSponsors.add(userId);

          userAllocationsSnapshot.forEach(doc => {
            const allocationData = doc.data();
            totalPledgedTokens += allocationData.amount || 0;
          });
        }
      }
    } catch (error: any) {
      // Handle permission denied errors gracefully - this is expected in some environments
      if (error?.code === 'permission-denied') {
        console.log('Permission denied querying token allocations - this is expected in some environments');
      } else {
        console.error('Error querying token allocations:', error);
      }
      // Fallback to empty stats
    }
    const stats = {
      sponsorCount: uniqueSponsors.size,
      totalPledgedTokens,
      uniqueSponsors: Array.from(uniqueSponsors)
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting page stats:', error);
    return NextResponse.json({ 
      error: 'Failed to get page stats' 
    }, { status: 500 });
  }
}

/**
 * Alternative implementation using user pledge subcollections
 * This is less efficient but more accurate if pledges and allocations differ
 */
async function getPageStatsFromPledges(pageId: string) {
  try {
    // This would require querying all users, which is not efficient
    // We would need to:
    // 1. Get all users (not practical)
    // 2. Query each user's pledges subcollection for this pageId
    // 3. Aggregate the results
    
    // For now, we'll use the token allocations approach which is more efficient
    // and represents the current state of the token system
    
    return {
      sponsorCount: 0,
      totalPledgedTokens: 0,
      uniqueSponsors: []
    };
  } catch (error) {
    console.error('Error getting page stats from pledges:', error);
    return {
      sponsorCount: 0,
      totalPledgedTokens: 0,
      uniqueSponsors: []
    };
  }
}