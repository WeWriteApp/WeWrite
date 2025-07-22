/**
 * Real-time Database Module - DEPRECATED
 *
 * ⚠️  MIGRATION NOTICE: This module is deprecated in favor of API routes.
 *
 * Use rtdbApi from utils/apiClient.ts instead of direct Firebase RTDB calls.
 * The API route provides environment-aware access and better error handling.
 *
 * Migration:
 * - Replace direct RTDB calls with rtdbApi.read(), rtdbApi.write(), etc.
 * - Use /api/rtdb endpoint for all real-time database operations
 */

import {
  getDatabase,
  type Database,
  ref,
  push,
  onValue,
  get,
  set,
  update,
  type DatabaseReference,
  type DataSnapshot,
  type Unsubscribe
} from "firebase/database";
import { rtdb as firebaseRTDB } from "./config";
import type { User } from "../types/database";

// Get RTDB instance
const getFirebaseRTDB = (): Database => {
  return firebaseRTDB;
};

// Connection pooling and batching for cost optimization
class RTDBConnectionManager {
  private static instance: RTDBConnectionManager;
  private batchedWrites: Map<string, any> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 2000; // 2 seconds batch delay

  static getInstance(): RTDBConnectionManager {
    if (!RTDBConnectionManager.instance) {
      RTDBConnectionManager.instance = new RTDBConnectionManager();
    }
    return RTDBConnectionManager.instance;
  }

  // Batch multiple writes to reduce RTDB operations
  batchWrite(path: string, data: any): void {
    this.batchedWrites.set(path, data);

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.flushBatchedWrites();
    }, this.BATCH_DELAY);
  }

  private async flushBatchedWrites(): Promise<void> {
    if (this.batchedWrites.size === 0) return;

    try {
      const updates: Record<string, any> = {};
      for (const [path, data] of this.batchedWrites.entries()) {
        updates[path] = data;
      }

      await update(ref(getFirebaseRTDB()), updates);
      console.log(`[RTDB] Batched ${this.batchedWrites.size} writes to reduce costs`);

      this.batchedWrites.clear();
    } catch (error) {
      console.error('[RTDB] Error flushing batched writes:', error);
    }
  }
}

const connectionManager = RTDBConnectionManager.getInstance();

export const add = async (path: string, data: any): Promise<DatabaseReference> => {
  const dbRef = ref(getFirebaseRTDB(), path);
  const newRef = push(dbRef);
  await set(newRef, data);
  return newRef;
};

export const updateData = async (path: string, data: any): Promise<void> => {
  const dbRef = ref(getFirebaseRTDB(), path);
  await update(dbRef, data);
};

// Optimized batch update function for cost reduction
export const batchUpdateData = (path: string, data: any): void => {
  connectionManager.batchWrite(path, data);
};

export const getDoc = async (path: string): Promise<any> => {
  const dbRef = ref(getFirebaseRTDB(), path);
  const snapshot = await get(dbRef);
  return snapshot.val();
};

export const setDoc = async (path: string, data: any): Promise<void> => {
  const dbRef = ref(getFirebaseRTDB(), path);
  await set(dbRef, data);
};

export const removeDoc = async (path: string): Promise<void> => {
  const dbRef = ref(getFirebaseRTDB(), path);
  await set(dbRef, null);
};

export const listen = (path: string, callback: (snapshot: DataSnapshot) => void): Unsubscribe => {
  const dbRef = ref(getFirebaseRTDB(), path);
  return onValue(dbRef, callback);
};

export const fetchProfileFromFirebase = async (userId: string): Promise<User | null> => {
  try {
    const profileRef = ref(getFirebaseRTDB(), `users/${userId}`);
    const snapshot = await get(profileRef);
    if (!snapshot.exists()) {
      return null;
    }
    return {
      uid: snapshot.key as string,
      ...snapshot.val()} as User;
  } catch (error) {
    console.error("Error fetching profile from Firebase", error);
    return null;
  }
}

// Export the RTDB instance for backward compatibility
export const rtdb = getFirebaseRTDB();