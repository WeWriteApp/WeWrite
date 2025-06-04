import { getDatabase, ref, onValue, get, Database, Unsubscribe } from 'firebase/database';
import { db } from "../firebase/config";
import { collection, query, where, getDocs, doc, getDoc, Firestore } from 'firebase/firestore';

// Types
interface SupportersStats {
  count: number;
  totalAmount: number;
}

/**
 * Service for managing pledges and supporter statistics
 */
class PledgeService {
  private db: Database;
  private firestore: Firestore;
  private activeSubscriptions: Map<string, Unsubscribe>;

  constructor() {
    this.db = getDatabase();
    this.firestore = db;
    this.activeSubscriptions = new Map();
  }

  /**
   * Subscribe to supporters stats for a page
   */
  subscribeToSupportersStats(pageId: string, callback: (stats: SupportersStats) => void): Unsubscribe | null {
    if (!pageId || !callback) return null;

    try {
      const supportersRef = ref(this.db, `pageStats/${pageId}/supporters`);

      // Subscribe to changes in the supporters stats
      const unsubscribe = onValue(supportersRef, (snapshot) => {
        if (snapshot.exists()) {
          const stats = snapshot.val();
          callback({
            count: stats.count || 0,
            totalAmount: stats.totalAmount || 0
          });
        } else {
          callback({
            count: 0,
            totalAmount: 0
          });
        }
      });

      // Store the subscription for cleanup
      this.activeSubscriptions.set(`${pageId}-supporters`, unsubscribe);

      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to supporters stats:', error);
      return null;
    }
  }

  /**
   * Get supporters stats for a page
   */
  async getSupportersStats(pageId: string): Promise<SupportersStats> {
    if (!pageId) return { count: 0, totalAmount: 0 };

    try {
      const supportersRef = ref(this.db, `pageStats/${pageId}/supporters`);
      const snapshot = await get(supportersRef);

      if (snapshot.exists()) {
        const stats = snapshot.val();
        return {
          count: stats.count || 0,
          totalAmount: stats.totalAmount || 0
        };
      } else {
        return {
          count: 0,
          totalAmount: 0
        };
      }
    } catch (error) {
      console.error('Error getting supporters stats:', error);
      return { count: 0, totalAmount: 0 };
    }
  }

  /**
   * Unsubscribe from supporters stats for a page
   */
  unsubscribeFromSupportersStats(pageId: string): void {
    if (!pageId) return;

    try {
      const key = `${pageId}-supporters`;
      const unsubscribe = this.activeSubscriptions.get(key);

      if (unsubscribe) {
        unsubscribe();
        this.activeSubscriptions.delete(key);
      }
    } catch (error) {
      console.error('Error unsubscribing from supporters stats:', error);
    }
  }
}

// Create a singleton instance
export const pledgeService = new PledgeService();
