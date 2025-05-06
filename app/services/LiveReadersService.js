import { getDatabase, ref, onValue, set, remove, onDisconnect, increment, serverTimestamp } from 'firebase/database';

/**
 * Service for tracking and managing live readers on a page
 */
class LiveReadersService {
  constructor() {
    this.db = getDatabase();
    this.activeSubscriptions = new Map();
  }

  /**
   * Track a reader on a page
   * @param {string} pageId - The ID of the page
   * @param {string} userId - The ID of the user
   */
  trackReader(pageId, userId) {
    if (!pageId || !userId) return;

    try {
      const readerRef = ref(this.db, `liveReaders/${pageId}/readers/${userId}`);
      
      // Set the reader's presence with a timestamp
      set(readerRef, {
        timestamp: serverTimestamp()
      });

      // Remove the reader when they disconnect
      onDisconnect(readerRef).remove();

      // Update the reader count
      const countRef = ref(this.db, `liveReaders/${pageId}/count`);
      set(countRef, increment(1));
      
      // Remove the reader count when they disconnect
      onDisconnect(countRef).set(increment(-1));
    } catch (error) {
      console.error('Error tracking reader:', error);
    }
  }

  /**
   * Subscribe to the reader count for a page
   * @param {string} pageId - The ID of the page
   * @param {Function} callback - The callback to call when the count changes
   * @returns {Function} - The unsubscribe function
   */
  subscribeToReaderCount(pageId, callback) {
    if (!pageId || !callback) return null;

    try {
      const countRef = ref(this.db, `liveReaders/${pageId}/count`);
      
      // Subscribe to changes in the reader count
      const unsubscribe = onValue(countRef, (snapshot) => {
        const count = snapshot.exists() ? snapshot.val() : 0;
        callback(count);
      });

      // Store the subscription for cleanup
      this.activeSubscriptions.set(`${pageId}-count`, unsubscribe);

      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to reader count:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from the reader count for a page
   * @param {string} pageId - The ID of the page
   */
  unsubscribeFromReaderCount(pageId) {
    if (!pageId) return;

    try {
      const key = `${pageId}-count`;
      const unsubscribe = this.activeSubscriptions.get(key);
      
      if (unsubscribe) {
        unsubscribe();
        this.activeSubscriptions.delete(key);
      }
    } catch (error) {
      console.error('Error unsubscribing from reader count:', error);
    }
  }
}

// Create a singleton instance
export const liveReadersService = new LiveReadersService();
