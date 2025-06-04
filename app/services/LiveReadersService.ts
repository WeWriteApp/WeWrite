import { getDatabase, ref, onValue, set, remove, onDisconnect, increment, serverTimestamp, Database, Unsubscribe } from 'firebase/database';

/**
 * Service for tracking and managing live readers on a page
 */
class LiveReadersService {
  private db: Database;
  private activeSubscriptions: Map<string, Unsubscribe>;

  constructor() {
    this.db = getDatabase();
    this.activeSubscriptions = new Map();
  }

  /**
   * Track a reader on a page
   */
  trackReader(pageId: string, userId: string): void {
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
   */
  subscribeToReaderCount(pageId: string, callback: (count: number) => void): Unsubscribe | null {
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
   */
  unsubscribeFromReaderCount(pageId: string): void {
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
