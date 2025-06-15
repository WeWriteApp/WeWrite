import {
  getFirestore,
  type Firestore,
  addDoc,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
  type QueryDocumentSnapshot
} from "firebase/firestore";

import { app } from "../config";
import { rtdb } from "../rtdb";
import { get, ref } from "firebase/database";

// Import utility functions
import { generateCacheKey, getCacheItem, setCacheItem } from "../../utils/cacheUtils";
import { trackQueryPerformance } from "../../utils/queryMonitor";
import { recordUserActivity } from "../streaks";
import { createLinkNotification, createAppendNotification } from "../notifications";

// Import types
import type {
  Page,
  User,
  Group,
  SlateContent,
  PageVersion,
  LinkData
} from "../../types/database";

export const db: Firestore = getFirestore(app);

// Type definitions for database operations
export interface PageAccessResult {
  hasAccess: boolean;
  error?: string;
  reason?: string;
}

export type PageData = Page;

export interface VersionData {
  content: string;
  createdAt: string;
  userId: string;
  username?: string;
  groupId?: string | null;
}

export interface CreatePageData {
  title?: string;
  content?: string;
  isPublic?: boolean;
  userId: string;
  username?: string;
  groupId?: string | null;
  groupName?: string | null;
  location?: string | null;
  fundraisingGoal?: number;
  isReply?: boolean;
  replyTo?: string | null;
  replyToTitle?: string | null;
  replyToUsername?: string | null;
}

export interface PageUpdateData {
  content: string;
  userId: string;
  username?: string;
  groupId?: string | null;
}

export interface PageStats {
  totalPledged: number;
  pledgeCount: number;
  views: number;
  lastModified: string;
}

export interface PageWithLinks {
  pageData?: PageData | null;
  versionData?: VersionData | null;
  links?: LinkData[];
  error?: string;
}

/**
 * Generic function to create a document in any collection
 */
export const createDoc = async (collectionName: string, data: any): Promise<string | Error> => {
  try {
    const docRef = await addDoc(collection(db, collectionName), data);
    return docRef.id;
  } catch (e) {
    return e as Error;
  }
};

/**
 * Generic function to get a document by ID
 */
export const getDocById = async (collectionName: string, docId: string): Promise<any | null> => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error fetching document from ${collectionName}:`, error);
    return null;
  }
};

/**
 * Generic function to update a document
 */
export const updateDoc = async (collectionName: string, docId: string, data: any): Promise<boolean> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, data, { merge: true });
    return true;
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error);
    return false;
  }
};

/**
 * Generic function to delete a document
 */
export const deleteDocById = async (collectionName: string, docId: string): Promise<boolean> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    return false;
  }
};

/**
 * Utility function to batch write operations
 */
export const batchWrite = async (operations: Array<{
  type: 'set' | 'update' | 'delete';
  collection: string;
  docId: string;
  data?: any;
}>): Promise<boolean> => {
  try {
    const batch = writeBatch(db);
    
    operations.forEach(op => {
      const docRef = doc(db, op.collection, op.docId);
      
      switch (op.type) {
        case 'set':
          batch.set(docRef, op.data);
          break;
        case 'update':
          batch.update(docRef, op.data);
          break;
        case 'delete':
          batch.delete(docRef);
          break;
      }
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error in batch write operation:', error);
    return false;
  }
};

// Re-export commonly used Firestore functions
export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  Timestamp
};
