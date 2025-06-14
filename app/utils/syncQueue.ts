/**
 * Sync Queue System for WeWrite
 *
 * Handles queuing operations for users with unverified emails only
 * All other scenarios (offline, logged-out) are handled with error messages
 */

import { auth } from '../firebase/config';
import { createPage, updatePage, deletePage } from '../firebase/database';
import { getCurrentUser } from './currentUser';

// Types for queue operations
export interface QueueOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
  data: any;
  pageId?: string;
  userId?: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export interface SyncQueueState {
  operations: QueueOperation[];
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAttempt?: number;
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
}

// Storage keys
const STORAGE_KEYS = {
  STATE: 'wewrite_sync_state',
  USER_QUEUE: 'wewrite_user_queue_'
};

// Maximum queue size and retry limits
const MAX_QUEUE_SIZE = 1000;
const DEFAULT_MAX_RETRIES = 3;
const SYNC_RETRY_DELAY = 5000; // 5 seconds

/**
 * Generate a unique ID for queue operations
 */
function generateOperationId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the storage key for a user's queue
 */
function getUserQueueKey(userId: string): string {
  return `${STORAGE_KEYS.USER_QUEUE}${userId}`;
}

/**
 * Save queue to localStorage
 */
function saveQueue(queue: QueueOperation[], key: string = STORAGE_KEYS.QUEUE): void {
  try {
    localStorage.setItem(key, JSON.stringify(queue));
  } catch (error) {
    console.error('Error saving queue to localStorage:', error);
  }
}

/**
 * Load queue from localStorage
 */
function loadQueue(key: string = STORAGE_KEYS.QUEUE): QueueOperation[] {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading queue from localStorage:', error);
    return [];
  }
}

/**
 * Save sync state to localStorage
 */
function saveSyncState(state: Partial<SyncQueueState>): void {
  try {
    const currentState = loadSyncState();
    const newState = { ...currentState, ...state };
    localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(newState));
  } catch (error) {
    console.error('Error saving sync state:', error);
  }
}

/**
 * Load sync state from localStorage
 */
function loadSyncState(): SyncQueueState {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.STATE);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading sync state:', error);
  }
  
  return {
    operations: [],
    isOnline: navigator.onLine,
    isSyncing: false,
    totalOperations: 0,
    completedOperations: 0,
    failedOperations: 0
  };
}

/**
 * Check if user email is verified
 */
export function isEmailVerified(): boolean {
  const user = auth.currentUser;
  return user ? user.emailVerified : false;
}

/**
 * Check if user should use sync queue
 * Only users with unverified emails should use the queue
 */
export function shouldUseQueue(): boolean {
  const user = getCurrentUser();
  const emailVerified = isEmailVerified();

  // Only queue operations for authenticated users with unverified emails
  if (user && !emailVerified) {
    return true;
  }

  return false;
}

/**
 * Check if operation should be allowed
 * Returns error message if operation should be blocked, null if allowed
 */
export function checkOperationAllowed(): string | null {
  const user = getCurrentUser();
  const isOnline = navigator.onLine;

  // Block if user is not authenticated
  if (!user) {
    return "You must be logged in to create or edit pages.";
  }

  // Block if user is offline
  if (!isOnline) {
    return "You're offline. Please check your connection and try again.";
  }

  return null; // Operation is allowed
}

/**
 * Add operation to unverified user queue
 * Only for authenticated users with unverified emails
 */
export function addToQueue(
  type: QueueOperation['type'],
  data: any,
  pageId?: string
): string {
  const user = getCurrentUser();

  if (!user) {
    throw new Error('Cannot queue operation for unauthenticated user');
  }

  if (isEmailVerified()) {
    throw new Error('Cannot queue operation for user with verified email');
  }

  const operationId = generateOperationId();

  const operation: QueueOperation = {
    id: operationId,
    type,
    timestamp: Date.now(),
    data,
    pageId,
    userId: user.uid,
    retryCount: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
    status: 'pending'
  };

  // Only use user-specific queue for unverified email users
  const queueKey = getUserQueueKey(user.uid);
  const queue = loadQueue(queueKey);

  // Prevent queue from growing too large
  if (queue.length >= MAX_QUEUE_SIZE) {
    // Remove oldest completed operations
    const filteredQueue = queue.filter(op => op.status !== 'completed').slice(-MAX_QUEUE_SIZE + 1);
    queue.splice(0, queue.length, ...filteredQueue);
  }

  queue.push(operation);
  saveQueue(queue, queueKey);

  // Update sync state
  const state = loadSyncState();
  state.totalOperations = queue.length;
  saveSyncState(state);

  return operationId;
}

/**
 * Get current queue for user
 * Only returns queue for authenticated users with unverified emails
 */
export function getCurrentQueue(): QueueOperation[] {
  const user = getCurrentUser();

  // Only return queue for authenticated users with unverified emails
  if (user && !isEmailVerified()) {
    const queueKey = getUserQueueKey(user.uid);
    return loadQueue(queueKey);
  }

  return []; // No queue for other scenarios
}

/**
 * Get queue count for current user
 */
export function getQueueCount(): number {
  return getCurrentQueue().filter(op => op.status === 'pending').length;
}

/**
 * Clear completed operations from queue
 * Only for authenticated users with unverified emails
 */
export function clearCompletedOperations(): void {
  const user = getCurrentUser();

  // Only clear queue for authenticated users with unverified emails
  if (user && !isEmailVerified()) {
    const queueKey = getUserQueueKey(user.uid);
    const queue = loadQueue(queueKey);
    const filteredQueue = queue.filter(op => op.status !== 'completed');
    saveQueue(filteredQueue, queueKey);
  }
}

/**
 * Execute a single queue operation
 */
async function executeOperation(operation: QueueOperation): Promise<boolean> {
  try {
    switch (operation.type) {
      case 'create':
        const pageId = await createPage(operation.data);
        return !!pageId;

      case 'update':
        if (operation.pageId) {
          await updatePage(operation.pageId, operation.data);
          return true;
        }
        break;

      case 'delete':
        if (operation.pageId) {
          await deletePage(operation.pageId);
          return true;
        }
        break;

      default:
        console.error(`Unknown operation type: ${operation.type}`);
        return false;
    }

    return false;
  } catch (error) {
    console.error(`Error executing operation ${operation.id}:`, error);
    return false;
  }
}

/**
 * Process sync queue for users who just verified their email
 */
export async function processSyncQueue(): Promise<void> {
  const user = getCurrentUser();

  // Only process queue for authenticated users who just verified their email
  if (!user || !isEmailVerified()) {
    return;
  }

  const queueKey = getUserQueueKey(user.uid);
  const queue = loadQueue(queueKey);
  const pendingOperations = queue.filter(op => op.status === 'pending');

  if (pendingOperations.length === 0) {
    return;
  }

  // Update sync state
  saveSyncState({
    isSyncing: true,
    lastSyncAttempt: Date.now()
  });

  let successCount = 0;
  let failureCount = 0;

  for (const operation of pendingOperations) {
    // Update operation status
    operation.status = 'syncing';
    saveQueue(queue, queueKey);

    const success = await executeOperation(operation);

    if (success) {
      operation.status = 'completed';
      successCount++;
    } else {
      operation.retryCount++;

      if (operation.retryCount >= operation.maxRetries) {
        operation.status = 'failed';
        operation.error = 'Max retries exceeded';
        failureCount++;
      } else {
        operation.status = 'pending';
        // Add delay before retry
        await new Promise(resolve => setTimeout(resolve, SYNC_RETRY_DELAY));
      }
    }

    saveQueue(queue, queueKey);
  }

  // Update final sync state
  saveSyncState({
    isSyncing: false,
    completedOperations: successCount,
    failedOperations: failureCount
  });

  // Dispatch custom event for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('syncQueueUpdated', {
      detail: { successCount, failureCount }
    }));
  }
}

/**
 * Get sync queue state
 * Only returns meaningful data for users with unverified emails
 */
export function getSyncQueueState(): SyncQueueState {
  const state = loadSyncState();
  const queue = getCurrentQueue();

  return {
    ...state,
    operations: queue,
    totalOperations: queue.length,
    isOnline: typeof window !== 'undefined' ? navigator.onLine : true
  };
}

/**
 * Manual sync trigger for unverified email users
 */
export async function triggerManualSync(): Promise<void> {
  await processSyncQueue();
}



/**
 * Initialize sync queue system
 * Only handles email verification state changes
 */
export function initializeSyncQueue(): void {
  if (typeof window !== 'undefined') {
    // Listen for auth state changes to process queue when email is verified
    auth.onAuthStateChanged((user) => {
      if (user && user.emailVerified) {
        processSyncQueue();
      }
    });
  }
}
