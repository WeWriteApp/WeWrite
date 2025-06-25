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
        collection(db, 'pledges'),
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
      console.log('Global pledges collection not available, using fallback method');
    }

    // Fallback: Use the token allocation API to get page stats
    // This is more efficient than querying all user subcollections
    const response = await fetch(`/api/tokens/page-stats?pageId=${pageId}`);
    if (response.ok) {
      const data = await response.json();
      return {
        sponsorCount: data.sponsorCount || 0,
        totalPledgedTokens: data.totalPledgedTokens || 0,
        uniqueSponsors: data.uniqueSponsors || []
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
  try {
    // Try to subscribe to global pledges collection first
    try {
      const pledgesQuery = query(
        collection(db, 'pledges'),
        where('pageId', '==', pageId),
        where('status', 'in', ['active', 'completed'])
      );

      return onSnapshot(pledgesQuery, (querySnapshot) => {
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

        const stats: PagePledgeStats = {
          sponsorCount: uniqueSponsors.size,
          totalPledgedTokens,
          uniqueSponsors: Array.from(uniqueSponsors)
        };

        callback(stats);
      }, (error) => {
        console.error('Error in page pledge stats subscription:', error);
        // Call callback with empty stats on error
        callback({
          sponsorCount: 0,
          totalPledgedTokens: 0,
          uniqueSponsors: []
        });
      });
    } catch (globalError) {
      console.log('Global pledges collection not available for subscription');
    }

    // Fallback: Subscribe to token allocations for real-time updates
    const allocationsQuery = query(
      collection(db, 'tokenAllocations'),
      where('pageId', '==', pageId),
      where('amount', '>', 0)
    );

    return onSnapshot(allocationsQuery, (querySnapshot) => {
      const uniqueSponsors = new Set<string>();
      let totalPledgedTokens = 0;

      querySnapshot.forEach(doc => {
        const allocationData = doc.data();

        // Add to unique sponsors set
        if (allocationData.userId) {
          uniqueSponsors.add(allocationData.userId);
        }

        // Add to total pledged tokens
        totalPledgedTokens += allocationData.amount || 0;
      });

      const stats: PagePledgeStats = {
        sponsorCount: uniqueSponsors.size,
        totalPledgedTokens,
        uniqueSponsors: Array.from(uniqueSponsors)
      };

      callback(stats);
    }, (error) => {
      console.error('Error in token allocations subscription:', error);
      // Call callback with empty stats on error
      callback({
        sponsorCount: 0,
        totalPledgedTokens: 0,
        uniqueSponsors: []
      });
    });
  } catch (error) {
    console.error('Error setting up page pledge stats subscription:', error);
    // Return a no-op unsubscribe function
    return () => {};
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
