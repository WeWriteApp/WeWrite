/**
 * Unfunded Token Earnings API
 * 
 * Aggregates unfunded tokens from logged-out users and users without active subscriptions
 * to provide writers with a complete view of their potential earnings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getLoggedOutTokenBalance, getUserTokenBalance } from '../../../utils/simulatedTokens';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { getCollectionName } from '../../../utils/environmentConfig';

interface UnfundedAllocation {
  fromUserId?: string;
  fromUsername?: string;
  resourceType: 'page';
  resourceId: string;
  resourceTitle?: string;
  tokens: number;
  usdValue: number;
  source: 'logged_out' | 'no_subscription';
  timestamp: number;
}

interface UnfundedEarningsData {
  totalUnfundedTokens: number;
  totalUnfundedUsdValue: number;
  loggedOutTokens: number;
  loggedOutUsdValue: number;
  noSubscriptionTokens: number;
  noSubscriptionUsdValue: number;
  allocations: UnfundedAllocation[];
  message: string;
}

// GET - Get unfunded earnings for a writer
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const unfundedData: UnfundedEarningsData = {
      totalUnfundedTokens: 0,
      totalUnfundedUsdValue: 0,
      loggedOutTokens: 0,
      loggedOutUsdValue: 0,
      noSubscriptionTokens: 0,
      noSubscriptionUsdValue: 0,
      allocations: [],
      message: ''
    };

    // Get unfunded allocations from logged-out users (localStorage)
    try {
      const loggedOutBalance = getLoggedOutTokenBalance();
      
      // Filter allocations for this user's content
      const userPages = await getUserPageIds(userId);
      const loggedOutAllocations = loggedOutBalance.allocations.filter(
        allocation => userPages.includes(allocation.pageId)
      );

      for (const allocation of loggedOutAllocations) {
        const usdValue = allocation.tokens * 0.1; // 10 tokens = $1
        unfundedData.allocations.push({
          resourceType: 'page',
          resourceId: allocation.pageId,
          resourceTitle: allocation.pageTitle,
          tokens: allocation.tokens,
          usdValue,
          source: 'logged_out',
          timestamp: allocation.timestamp
        });
        
        unfundedData.loggedOutTokens += allocation.tokens;
        unfundedData.loggedOutUsdValue += usdValue;
      }
    } catch (error) {
      console.warn('Error getting logged-out unfunded tokens:', error);
    }

    // Get unfunded allocations from users without subscriptions
    try {
      const noSubscriptionAllocations = await getNoSubscriptionAllocations(userId);
      
      for (const allocation of noSubscriptionAllocations) {
        const usdValue = allocation.tokens * 0.1;
        unfundedData.allocations.push({
          fromUserId: allocation.fromUserId,
          fromUsername: allocation.fromUsername,
          resourceType: 'page',
          resourceId: allocation.resourceId,
          resourceTitle: allocation.resourceTitle,
          tokens: allocation.tokens,
          usdValue,
          source: 'no_subscription',
          timestamp: allocation.timestamp
        });
        
        unfundedData.noSubscriptionTokens += allocation.tokens;
        unfundedData.noSubscriptionUsdValue += usdValue;
      }
    } catch (error) {
      console.warn('Error getting no-subscription unfunded tokens:', error);
    }

    // Calculate totals
    unfundedData.totalUnfundedTokens = unfundedData.loggedOutTokens + unfundedData.noSubscriptionTokens;
    unfundedData.totalUnfundedUsdValue = unfundedData.loggedOutUsdValue + unfundedData.noSubscriptionUsdValue;

    // Generate message
    const sources = [];
    if (unfundedData.loggedOutTokens > 0) sources.push('logged-out users');
    if (unfundedData.noSubscriptionTokens > 0) sources.push('users without subscriptions');
    
    if (sources.length > 0) {
      const sourceText = sources.length === 1 ? sources[0] : sources.join(' and ');
      unfundedData.message = `You have ${unfundedData.totalUnfundedTokens} unfunded tokens from ${sourceText}. These tokens will become funded when those users sign up and subscribe.`;
    } else {
      unfundedData.message = 'No unfunded tokens found.';
    }

    return NextResponse.json({
      success: true,
      data: unfundedData
    });

  } catch (error) {
    console.error('Error getting unfunded earnings:', error);
    return NextResponse.json(
      { error: 'Failed to get unfunded earnings' },
      { status: 500 }
    );
  }
}

/**
 * Get all page IDs owned by a user
 */
async function getUserPageIds(userId: string): Promise<string[]> {
  try {
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('userId', '==', userId)
    );
    
    const pagesSnapshot = await getDocs(pagesQuery);
    return pagesSnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.error('Error getting user pages:', error);
    return [];
  }
}

/**
 * Get unfunded allocations from users without active subscriptions
 * This would check localStorage for each user without a subscription
 * In a real implementation, this might be stored in a separate collection
 */
async function getNoSubscriptionAllocations(recipientUserId: string): Promise<any[]> {
  // For now, return empty array as this would require checking localStorage
  // for all users without subscriptions, which isn't feasible from server-side
  // This could be implemented by having users without subscriptions store
  // their allocations in a temporary database collection instead of localStorage
  return [];
}
