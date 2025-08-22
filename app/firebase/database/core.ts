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

import { firestore } from "../config";
import { rtdb } from "../rtdb";
import { get, ref } from "firebase/database";
import { getCollectionName } from "../../utils/environmentConfig";
import { protectedFirebaseOperation } from "../../utils/firebaseCircuitBreaker";

// Import utility functions
import { generateCacheKey, getCacheItem, setCacheItem } from "../../utils/cacheUtils";
import { trackQueryPerformance } from "../../utils/queryMonitor";
// Removed circular import - recordUserActivity will be called directly where needed
// Notifications functionality removed

// Import types
import type {
  Page,
  User,
  EditorContent,
  PageVersion,
  LinkData
} from "../../types/database";

// Get Firestore instance
const getFirebaseDB = (): Firestore => {
  return firestore;
};

export const db: Firestore = getFirebaseDB();

// Type definitions for database operations
export interface PageAccessResult {
  hasAccess: boolean;
  error?: string;
  reason?: string;
  isDeleted?: boolean;
}

/**
 * Helper function to create page queries that automatically exclude deleted pages
 * This ensures consistent soft delete behavior across the entire application
 */
export const createPageQuery = (baseQuery: any[], includeDeleted: boolean = false) => {
  if (!includeDeleted) {
    // Add filter to exclude deleted pages
    baseQuery.push(where('deleted', '!=', true));
  }
  return query(collection(db, getCollectionName('pages')), ...baseQuery);
};

/**
 * Helper function to create user page queries with soft delete filtering
 */
export const createUserPageQuery = (userId: string, includeDeleted: boolean = false, additionalFilters: any[] = []) => {
  const baseQuery = [
    where('userId', '==', userId),
    ...additionalFilters
  ];
  return createPageQuery(baseQuery, includeDeleted);
};

/**
 * Helper function to create page queries with soft delete filtering
 * All pages are now public, so this is equivalent to createPageQuery
 */
export const createPublicPageQuery = (includeDeleted: boolean = false, additionalFilters: any[] = []) => {
  const baseQuery = [
    // All pages are now public - no isPublic filter needed
    ...additionalFilters
  ];
  return createPageQuery(baseQuery, includeDeleted);
};

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
  userId: string;
  username?: string;
  // Groups functionality removed
  location?: string | null;
  fundraisingGoal?: number;
  isReply?: boolean;
  replyTo?: string | null;
  replyToTitle?: string | null;
  replyToUsername?: string | null;
  customDate?: string; // YYYY-MM-DD format for daily notes and date-based pages
}

export interface PageUpdateData {
  content: string;
  userId: string;
  username?: string;
  // Groups functionality removed
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
 * Uses environment-aware collection naming
 */
export const createDoc = async (collectionName: string, data: any): Promise<string | Error> => {
  try {
    // Use environment-aware collection name
    const envCollectionName = getCollectionName(collectionName);
    const docRef = await addDoc(collection(db, envCollectionName), data);
    return docRef.id;
  } catch (e) {
    return e as Error;
  }
};

/**
 * Generic function to get a document by ID
 * Uses environment-aware collection naming
 */
export const getDocById = async (collectionName: string, docId: string): Promise<any | null> => {
  return await protectedFirebaseOperation(async () => {
    try {
      // Use environment-aware collection name
      const envCollectionName = getCollectionName(collectionName);
      const docRef = doc(db, envCollectionName, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error fetching document from ${envCollectionName}:`, error);
      return null;
    }
  }, `getDocById:${collectionName}:${docId}`);
};

/**
 * Generic function to update a document
 * Uses environment-aware collection naming
 */
export const updateDoc = async (collectionName: string, docId: string, data: any): Promise<boolean> => {
  try {
    // Use environment-aware collection name
    const envCollectionName = getCollectionName(collectionName);
    const docRef = doc(db, envCollectionName, docId);
    await setDoc(docRef, data, { merge: true });
    return true;
  } catch (error) {
    console.error(`Error updating ${envCollectionName} document:`, error);
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