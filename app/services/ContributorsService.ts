import { db } from "../firebase/config";
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { updateUserContributorCount } from '../firebase/counters';
import { getCollectionName } from "../utils/environmentConfig";

// Types
interface ContributorStats {
  count: number;
  uniqueContributors: string[];
}

/**
 * Service for managing contributor statistics and real-time updates
 */
class ContributorsService {
  private activeSubscriptions: Map<string, Unsubscribe>;

  constructor() {
    this.activeSubscriptions = new Map();
  }

  /**
   * Subscribe to contributor count changes for a user
   * This listens to pledge changes and updates the contributor count in real-time
   */
  subscribeToContributorCount(userId: string, callback: (count: number) => void): Unsubscribe | null {
    if (!userId || !callback) return null;

    try {
      // Query pledges where this user is the recipient (page author)
      const pledgesQuery = query(
        collection(db, getCollectionName('pledges')),
        where('metadata.authorUserId', '==', userId),
        where('status', 'in', ['active', 'completed'])
      );

      // Subscribe to changes in pledges
      // DISABLED FOR COST OPTIMIZATION - Real-time listener causing excessive reads
    console.warn('🚨 COST OPTIMIZATION: Contributors real-time listener disabled');

    // Return mock data and no-op unsubscribe
    setTimeout(() => callback([]), 100);
    return () => {};

    /* DISABLED FOR COST OPTIMIZATION
    const unsubscribe = onSnapshot(pledgesQuery, (snapshot) => {
        // Count unique contributors (pledgers)
        const uniqueContributors = new Set<string>();
        snapshot.forEach(doc => {
          const pledgeData = doc.data();
          if (pledgeData.userId) {
            uniqueContributors.add(pledgeData.userId);
          }
        });

        const count = uniqueContributors.size;
        
        // Update the counter in the background (don't await to avoid blocking the callback)
        updateUserContributorCount(userId).catch(error => {
          console.error('Error updating contributor count in background:', error);
        });

        callback(count);
      });

      // Store the subscription for cleanup
      this.activeSubscriptions.set(`${userId}-contributors`, unsubscribe);

      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to contributor count:', error);
      return null;
    }
  }

  /**
   * Get contributor stats for a user (one-time fetch)
   */
  async getContributorStats(userId: string): Promise<ContributorStats> {
    if (!userId) return { count: 0, uniqueContributors: [] };

    try {
      // Query pledges where this user is the recipient (page author)
      const pledgesQuery = query(
        collection(db, getCollectionName('pledges')),
        where('metadata.authorUserId', '==', userId),
        where('status', 'in', ['active', 'completed'])
      );

      return new Promise((resolve, reject) => {
        // DISABLED FOR COST OPTIMIZATION - Real-time listener causing excessive reads
    console.warn('🚨 COST OPTIMIZATION: Contributors real-time listener disabled');

    // Return mock data and no-op unsubscribe
    setTimeout(() => callback([]), 100);
    return () => {};

    /* DISABLED FOR COST OPTIMIZATION
    const unsubscribe = onSnapshot(pledgesQuery, (snapshot) => {
          // Count unique contributors (pledgers)
          const uniqueContributors = new Set<string>();
          snapshot.forEach(doc => {
            const pledgeData = doc.data();
            if (pledgeData.userId) {
              uniqueContributors.add(pledgeData.userId);
            }
          });

          const result = {
            count: uniqueContributors.size,
            uniqueContributors: Array.from(uniqueContributors)
          };

          // Unsubscribe immediately since this is a one-time fetch
          unsubscribe();
          resolve(result);
        }, reject);
      });
    } catch (error) {
      console.error('Error getting contributor stats:', error);
      return { count: 0, uniqueContributors: [] };
    }
  }

  /**
   * Unsubscribe from contributor count updates for a user
   */
  unsubscribeFromContributorCount(userId: string): void {
    const subscriptionKey = `${userId}-contributors`;
    const unsubscribe = this.activeSubscriptions.get(subscriptionKey);
    
    if (unsubscribe) {
      unsubscribe();
      this.activeSubscriptions.delete(subscriptionKey);
    }
  }

  /**
   * Clean up all active subscriptions
   */
  cleanup(): void {
    this.activeSubscriptions.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.activeSubscriptions.clear();
  }
}

// Export a singleton instance
export const contributorsService = new ContributorsService();
export default contributorsService;