import { ref, onValue, set, onDisconnect } from 'firebase/database';
import { rtdb, db } from '../firebase/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';

class LiveReadersService {
  constructor() {
    this.listeners = new Map();
  }

  // Start tracking a reader on a page
  async trackReader(pageId, userId) {
    // Track live presence in RTDB
    const readerRef = ref(rtdb, `page_readers/${pageId}/${userId}`);
    
    // Set user as present
    set(readerRef, {
      lastActive: new Date().toISOString(),
      present: true
    });

    // Remove user when they disconnect
    onDisconnect(readerRef).remove();

    // Record reader in Firestore for total count
    const pageRef = doc(db, "pages", pageId);
    const readerDocRef = doc(collection(pageRef, "readers"), userId);
    await setDoc(readerDocRef, {
      firstVisit: new Date().toISOString(),
      lastVisit: new Date().toISOString()
    }, { merge: true });
  }

  // Listen to reader count changes for a page
  subscribeToReaderCount(pageId, callback) {
    if (this.listeners.has(pageId)) {
      return;
    }

    const readersRef = ref(rtdb, `page_readers/${pageId}`);
    const unsubscribe = onValue(readersRef, (snapshot) => {
      const readers = snapshot.val() || {};
      const count = Object.keys(readers).length;
      callback(count);
    });

    this.listeners.set(pageId, unsubscribe);
    return unsubscribe;
  }

  // Stop listening to reader count changes
  unsubscribeFromReaderCount(pageId) {
    const unsubscribe = this.listeners.get(pageId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(pageId);
    }
  }
}

export const liveReadersService = new LiveReadersService(); 