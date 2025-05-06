import { getDatabase, ref, onValue, set, get, increment, serverTimestamp } from 'firebase/database';

/**
 * Service for tracking and managing page statistics
 */
class PageStatsService {
  constructor() {
    this.db = getDatabase();
    this.activeSubscriptions = new Map();
  }

  /**
   * Subscribe to recent changes for a page
   * @param {string} pageId - The ID of the page
   * @param {Function} callback - The callback to call when the count changes
   * @returns {Function} - The unsubscribe function
   */
  subscribeToRecentChanges(pageId, callback) {
    if (!pageId || !callback) return null;

    try {
      const changesRef = ref(this.db, `pageStats/${pageId}/recentChanges`);
      
      // Subscribe to changes in the recent changes count
      const unsubscribe = onValue(changesRef, (snapshot) => {
        const count = snapshot.exists() ? snapshot.val() : 0;
        callback(count);
      });

      // Store the subscription for cleanup
      this.activeSubscriptions.set(`${pageId}-recentChanges`, unsubscribe);

      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to recent changes:', error);
      return null;
    }
  }

  /**
   * Subscribe to editors count for a page
   * @param {string} pageId - The ID of the page
   * @param {Function} callback - The callback to call when the count changes
   * @returns {Function} - The unsubscribe function
   */
  subscribeToEditorsCount(pageId, callback) {
    if (!pageId || !callback) return null;

    try {
      const editorsRef = ref(this.db, `pageStats/${pageId}/editors`);
      
      // Subscribe to changes in the editors count
      const unsubscribe = onValue(editorsRef, (snapshot) => {
        const count = snapshot.exists() ? snapshot.val() : 0;
        callback(count);
      });

      // Store the subscription for cleanup
      this.activeSubscriptions.set(`${pageId}-editors`, unsubscribe);

      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to editors count:', error);
      return null;
    }
  }

  /**
   * Get the total readers count for a page
   * @param {string} pageId - The ID of the page
   * @returns {Promise<number>} - The total readers count
   */
  async getTotalReadersCount(pageId) {
    if (!pageId) return 0;

    try {
      const readersRef = ref(this.db, `pageStats/${pageId}/totalReaders`);
      const snapshot = await get(readersRef);
      
      return snapshot.exists() ? snapshot.val() : 0;
    } catch (error) {
      console.error('Error getting total readers count:', error);
      return 0;
    }
  }

  /**
   * Unsubscribe from all stats for a page
   * @param {string} pageId - The ID of the page
   */
  unsubscribeFromStats(pageId) {
    if (!pageId) return;

    try {
      // Unsubscribe from all subscriptions for this page
      const keys = Array.from(this.activeSubscriptions.keys())
        .filter(key => key.startsWith(`${pageId}-`));
      
      keys.forEach(key => {
        const unsubscribe = this.activeSubscriptions.get(key);
        if (unsubscribe) {
          unsubscribe();
          this.activeSubscriptions.delete(key);
        }
      });
    } catch (error) {
      console.error('Error unsubscribing from stats:', error);
    }
  }
}

// Create a singleton instance
export const pageStatsService = new PageStatsService();
