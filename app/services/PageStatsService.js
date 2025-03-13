import { db } from '../firebase/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  limit,
  Timestamp 
} from 'firebase/firestore';

class PageStatsService {
  constructor() {
    this.listeners = new Map();
  }

  // Get recent changes count (last 24 hours)
  async getRecentChangesCount(pageId) {
    const pageRef = doc(db, "pages", pageId);
    const versionsRef = collection(pageRef, "versions");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const q = query(
      versionsRef,
      where("createdAt", ">=", yesterday.toISOString()),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  // Subscribe to recent changes count
  subscribeToRecentChanges(pageId, callback) {
    if (this.listeners.has(`recent_${pageId}`)) {
      return;
    }

    const pageRef = doc(db, "pages", pageId);
    const versionsRef = collection(pageRef, "versions");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const q = query(
      versionsRef,
      where("createdAt", ">=", yesterday.toISOString()),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      callback(snapshot.size);
    });

    this.listeners.set(`recent_${pageId}`, unsubscribe);
    return unsubscribe;
  }

  // Get total unique readers count
  async getTotalReadersCount(pageId) {
    try {
      const pageRef = doc(db, "pages", pageId);
      const readersRef = collection(pageRef, "readers");
      const snapshot = await getDocs(readersRef);
      return snapshot.size;
    } catch (error) {
      console.error("Error getting total readers count:", error);
      return 0;
    }
  }

  // Get editors count and details
  async getEditorsStats(pageId) {
    const pageRef = doc(db, "pages", pageId);
    const editorsRef = collection(pageRef, "editors");
    const snapshot = await getDocs(editorsRef);
    
    return {
      count: snapshot.size,
      editors: snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()
      }))
    };
  }

  // Subscribe to editors count
  subscribeToEditorsCount(pageId, callback) {
    if (this.listeners.has(`editors_${pageId}`)) {
      return;
    }

    const pageRef = doc(db, "pages", pageId);
    const editorsRef = collection(pageRef, "editors");

    const unsubscribe = onSnapshot(editorsRef, (snapshot) => {
      callback(snapshot.size);
    });

    this.listeners.set(`editors_${pageId}`, unsubscribe);
    return unsubscribe;
  }

  // Clean up listeners
  unsubscribeFromStats(pageId) {
    const recentUnsubscribe = this.listeners.get(`recent_${pageId}`);
    if (recentUnsubscribe) {
      recentUnsubscribe();
      this.listeners.delete(`recent_${pageId}`);
    }

    const editorsUnsubscribe = this.listeners.get(`editors_${pageId}`);
    if (editorsUnsubscribe) {
      editorsUnsubscribe();
      this.listeners.delete(`editors_${pageId}`);
    }
  }
}

export const pageStatsService = new PageStatsService(); 