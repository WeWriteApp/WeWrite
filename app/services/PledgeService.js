import { db } from '../firebase/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  onSnapshot,
  orderBy,
  Timestamp 
} from 'firebase/firestore';

class PledgeService {
  constructor() {
    this.listeners = new Map();
  }

  // Get total monthly pledge amount
  async getMonthlyPledgeAmount(pageId) {
    const pageRef = doc(db, "pages", pageId);
    const pledgesRef = collection(pageRef, "pledges");
    const snapshot = await getDocs(pledgesRef);
    
    return snapshot.docs.reduce((total, doc) => {
      const pledge = doc.data();
      return total + (pledge.amount || 0);
    }, 0);
  }

  // Get supporters count and details
  async getSupportersStats(pageId) {
    const pageRef = doc(db, "pages", pageId);
    const pledgesRef = collection(pageRef, "pledges");
    const snapshot = await getDocs(pledgesRef);

    const uniqueSupporters = new Set(
      snapshot.docs.map(doc => doc.data().userId)
    );
    
    return {
      count: uniqueSupporters.size,
      totalAmount: snapshot.docs.reduce((total, doc) => {
        const pledge = doc.data();
        return total + (pledge.amount || 0);
      }, 0)
    };
  }

  // Subscribe to supporters count and pledge amount
  subscribeToSupportersStats(pageId, callback) {
    if (this.listeners.has(pageId)) {
      return;
    }

    const pageRef = doc(db, "pages", pageId);
    const pledgesRef = collection(pageRef, "pledges");

    const unsubscribe = onSnapshot(pledgesRef, (snapshot) => {
      const uniqueSupporters = new Set(
        snapshot.docs.map(doc => doc.data().userId)
      );
      
      const stats = {
        count: uniqueSupporters.size,
        totalAmount: snapshot.docs.reduce((total, doc) => {
          const pledge = doc.data();
          return total + (pledge.amount || 0);
        }, 0)
      };

      callback(stats);
    });

    this.listeners.set(pageId, unsubscribe);
    return unsubscribe;
  }

  // Clean up listeners
  unsubscribeFromSupportersStats(pageId) {
    const unsubscribe = this.listeners.get(pageId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(pageId);
    }
  }
}

export const pledgeService = new PledgeService(); 