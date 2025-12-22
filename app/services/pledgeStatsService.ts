/**
 * Pledge Statistics Service
 * Provides real-time statistics for page owners including sponsor counts and total pledged tokens
 */

import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase/database/core';
import { getCollectionName, PAYMENT_COLLECTIONS } from '../utils/environmentConfig';

export interface PagePledgeStats {
  sponsorCount: number;
  totalPledgedTokens: number;
  uniqueSponsors: string[];
}

export interface PledgeData {
  id: string;
  userId: string;
  pageId: string;
  amount: number;
  status: string;
  createdAt: any;
  updatedAt?: any;
}

/**
 * Get page pledge statistics (sponsor count and total pledged tokens)
 * This function queries all active pledges for a specific page
 *
 * Note: WeWrite currently uses user subcollections for pledges (users/{userId}/pledges)
 * This approach requires querying multiple collections, so we'll use a more efficient method
 * by leveraging the existing token allocation system
 */
export const getPagePledgeStats = async (pageId: string): Promise<PagePledgeStats> => {
  try {
    // Try the global pledges collection first (if it exists)
    try {
      const pledgesQuery = query(
        collection(db, getCollectionName('pledges')),
        where('pageId', '==', pageId),
        where('status', 'in', ['active', 'completed'])
      );

      const querySnapshot = await getDocs(pledgesQuery);

      if (!querySnapshot.empty) {
        const uniqueSponsors = new Set<string>();
        let totalPledgedTokens = 0;

        querySnapshot.forEach(doc => {
          const pledgeData = doc.data() as PledgeData;

          // Add to unique sponsors set
          if (pledgeData.userId) {
            uniqueSponsors.add(pledgeData.userId);
          }

          // Add to total pledged tokens
          totalPledgedTokens += pledgeData.amount || 0;
        });

        return {
          sponsorCount: uniqueSponsors.size,
          totalPledgedTokens,
          uniqueSponsors: Array.from(uniqueSponsors)
        };
      }
    } catch (globalError) {
      // Global pledges collection not available, using fallback method
    }

    // Fallback: Use the token allocation API to get page stats
    // This is more efficient than querying all user subcollections
    const response = await fetch(`/api/tokens/page-stats?pageId=${pageId}`);
    if (response.ok) {
      const data = await response.json();
      return {
        sponsorCount: data.data?.sponsorCount || 0,
        totalPledgedTokens: data.data?.totalPledgedTokens || 0,
        uniqueSponsors: data.data?.uniqueSponsors || []
      };
    }

    // Final fallback: return empty stats
    return {
      sponsorCount: 0,
      totalPledgedTokens: 0,
      uniqueSponsors: []
    };
  } catch (error) {
    console.error('Error getting page pledge stats:', error);
    return {
      sponsorCount: 0,
      totalPledgedTokens: 0,
      uniqueSponsors: []
    };
  }
};

/**
 * Subscribe to real-time page pledge statistics updates
 * Returns an unsubscribe function to clean up the listener
 */
export const subscribeToPagePledgeStats = (
  pageId: string,
  callback: (stats: PagePledgeStats) => void
): Unsubscribe => {
  // DISABLED FOR COST OPTIMIZATION - Real-time listener causing excessive reads
  console.warn('🚨 COST OPTIMIZATION: Pledge stats real-time listener disabled');

  // Return mock data and no-op unsubscribe
  setTimeout(() => callback({
    sponsorCount: 0,
    totalPledgedTokens: 0,
    uniqueSponsors: []
  }), 100);
  return () => {};
};


/**
 * Get historical supporter data for sparkline (last 24 hours)
 * Returns hourly buckets of unique supporter counts
 */
export const getSupporterSparklineData = async (pageId: string): Promise<number[]> => {
  if (!pageId) return Array(24).fill(0);

  try {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Create 24 hourly buckets
    const hourlyBuckets = Array(24).fill(0);

    // Query token allocations for the last 24 hours
    const collectionName = getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS);

    const allocationsQuery = query(
      collection(db, collectionName),
      where('resourceId', '==', pageId),
      where('resourceType', '==', 'page'),
      where('status', '==', 'active'),
      where('tokens', '>', 0)
    );

    const querySnapshot = await getDocs(allocationsQuery);

    // Track supporters by hour
    const supportersByHour: { [hour: number]: Set<string> } = {};

    querySnapshot.forEach(doc => {
      const allocationData = doc.data();

      if (allocationData.createdAt && allocationData.userId) {
        const allocationDate = allocationData.createdAt instanceof Date ?
          allocationData.createdAt : new Date(allocationData.createdAt.seconds * 1000);

        if (allocationDate >= yesterday && allocationDate <= now) {
          const hourDiff = 23 - Math.floor((now.getTime() - allocationDate.getTime()) / (1000 * 60 * 60));
          if (hourDiff >= 0 && hourDiff < 24) {
            if (!supportersByHour[hourDiff]) {
              supportersByHour[hourDiff] = new Set();
            }
            supportersByHour[hourDiff].add(allocationData.userId);
          }
        }
      }
    });

    // Convert to counts
    for (let i = 0; i < 24; i++) {
      hourlyBuckets[i] = supportersByHour[i] ? supportersByHour[i].size : 0;
    }

    return hourlyBuckets;
  } catch (error) {
    console.error('Error getting supporter sparkline data:', error);
    return Array(24).fill(0);
  }
};

/**
 * Alternative implementation using user subcollections
 * This is a fallback if the global pledges collection doesn't exist
 */
export const getPagePledgeStatsFromUserCollections = async (pageId: string): Promise<PagePledgeStats> => {
  try {
    // This approach would require querying all users, which is not efficient
    // We'll implement this only if needed as a fallback
    console.warn('getPagePledgeStatsFromUserCollections not implemented - use global pledges collection');
    
    return {
      sponsorCount: 0,
      totalPledgedTokens: 0,
      uniqueSponsors: []
    };
  } catch (error) {
    console.error('Error getting page pledge stats from user collections:', error);
    return {
      sponsorCount: 0,
      totalPledgedTokens: 0,
      uniqueSponsors: []
    };
  }
};

/**
 * Format token count for display
 */
export const formatTokenCount = (count: number): string => {
  if (count === 0) return '0';
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
};

/**
 * Format sponsor count for display
 */
export const formatSponsorCount = (count: number): string => {
  if (count === 0) return 'No sponsors';
  if (count === 1) return '1 sponsor';
  return `${count} sponsors`;
};