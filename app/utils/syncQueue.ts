/**
 * Sync Queue System for WeWrite
 * 
 * Handles offline changes, unverified user states, and logged-out user queues
 * Provides persistent storage and automatic sync when conditions are met
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
  QUEUE: 'wewrite_sync_queue',
  STATE: 'wewrite_sync_state',
  USER_QUEUE: 'wewrite_user_queue_',
  OFFLINE_QUEUE: 'wewrite_offline_queue'
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
  // Check for demo mode override (admin testing)
  if (typeof window !== 'undefined') {
    const demoOverride = localStorage.getItem('demo_unverified_email');
    if (demoOverride === 'true') {
      return false; // Simulate unverified email
    }
  }

  const user = auth.currentUser;
  return user ? user.emailVerified : false;
}

/**
 * Check if user should use sync queue
 */
export function shouldUseQueue(): boolean {
  const user = getCurrentUser();
  
  // Use queue if offline
  if (!navigator.onLine) {
    return true;
  }
  
  // Use queue if logged out
  if (!user) {
    return true;
  }
  
  // Use queue if email not verified
  if (user && !isEmailVerified()) {
    return true;
  }
  
  return false;
}

/**
 * Add operation to appropriate queue
 */
export function addToQueue(
  type: QueueOperation['type'],
  data: any,
  pageId?: string
): string {
  const user = getCurrentUser();
  const operationId = generateOperationId();
  
  const operation: QueueOperation = {
    id: operationId,
    type,
    timestamp: Date.now(),
    data,
    pageId,
    userId: user?.uid,
    retryCount: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
    status: 'pending'
  };
  
  // Determine which queue to use
  let queueKey = STORAGE_KEYS.QUEUE;
  
  if (!navigator.onLine) {
    queueKey = STORAGE_KEYS.OFFLINE_QUEUE;
  } else if (user && !isEmailVerified()) {
    queueKey = getUserQueueKey(user.uid);
  } else if (!user) {
    queueKey = STORAGE_KEYS.QUEUE; // General queue for logged-out users
  }
  
  // Load current queue and add operation
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
  
  console.log(`Added ${type} operation to queue:`, operationId);
  return operationId;
}

/**
 * Get current queue for user
 */
export function getCurrentQueue(): QueueOperation[] {
  const user = getCurrentUser();
  
  let queueKey = STORAGE_KEYS.QUEUE;
  
  if (!navigator.onLine) {
    queueKey = STORAGE_KEYS.OFFLINE_QUEUE;
  } else if (user && !isEmailVerified()) {
    queueKey = getUserQueueKey(user.uid);
  }
  
  return loadQueue(queueKey);
}

/**
 * Get queue count for current user
 */
export function getQueueCount(): number {
  return getCurrentQueue().filter(op => op.status === 'pending').length;
}

/**
 * Clear completed operations from queue
 */
export function clearCompletedOperations(): void {
  const user = getCurrentUser();
  let queueKey = STORAGE_KEYS.QUEUE;

  if (!navigator.onLine) {
    queueKey = STORAGE_KEYS.OFFLINE_QUEUE;
  } else if (user && !isEmailVerified()) {
    queueKey = getUserQueueKey(user.uid);
  }

  const queue = loadQueue(queueKey);
  const filteredQueue = queue.filter(op => op.status !== 'completed');
  saveQueue(filteredQueue, queueKey);
}

/**
 * Execute a single queue operation
 */
async function executeOperation(operation: QueueOperation): Promise<boolean> {
  try {
    console.log(`Executing ${operation.type} operation:`, operation.id);

    switch (operation.type) {
      case 'create':
        const pageId = await createPage(operation.data);
        if (pageId) {
          console.log(`Successfully created page: ${pageId}`);
          return true;
        }
        break;

      case 'update':
        if (operation.pageId) {
          await updatePage(operation.pageId, operation.data);
          console.log(`Successfully updated page: ${operation.pageId}`);
          return true;
        }
        break;

      case 'delete':
        if (operation.pageId) {
          await deletePage(operation.pageId);
          console.log(`Successfully deleted page: ${operation.pageId}`);
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
 * Process sync queue
 */
export async function processSyncQueue(): Promise<void> {
  const user = getCurrentUser();

  // Don't sync if conditions aren't met
  if (!navigator.onLine || !user || !isEmailVerified()) {
    console.log('Sync conditions not met, skipping queue processing');
    return;
  }

  let queueKey = getUserQueueKey(user.uid);
  const queue = loadQueue(queueKey);
  const pendingOperations = queue.filter(op => op.status === 'pending');

  if (pendingOperations.length === 0) {
    console.log('No pending operations to sync');
    return;
  }

  console.log(`Processing ${pendingOperations.length} pending operations`);

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

  console.log(`Sync completed: ${successCount} successful, ${failureCount} failed`);

  // Dispatch custom event for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('syncQueueUpdated', {
      detail: { successCount, failureCount }
    }));
  }
}

/**
 * Get sync queue state
 */
export function getSyncQueueState(): SyncQueueState {
  const state = loadSyncState();
  const queue = getCurrentQueue();

  return {
    ...state,
    operations: queue,
    totalOperations: queue.length,
    isOnline: navigator.onLine
  };
}

/**
 * Manual sync trigger
 */
export async function triggerManualSync(): Promise<void> {
  console.log('Manual sync triggered');
  await processSyncQueue();
}

/**
 * Initialize sync queue system
 */
export function initializeSyncQueue(): void {
  // Listen for online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      console.log('Device came online, processing sync queue');
      saveSyncState({ isOnline: true });
      processSyncQueue();
    });

    window.addEventListener('offline', () => {
      console.log('Device went offline');
      saveSyncState({ isOnline: false });
    });

    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
      if (user && user.emailVerified) {
        console.log('User email verified, processing sync queue');
        processSyncQueue();
      }
    });
  }
}
