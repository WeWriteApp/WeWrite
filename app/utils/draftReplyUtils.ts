/**
 * Draft Reply Utilities
 *
 * This module provides utilities for handling draft replies from non-authenticated users.
 * It manages storing and retrieving draft replies in local storage, and handles the
 * workflow for posting replies after authentication.
 */

// Type definitions
interface DraftReply {
  pageId: string;
  pageTitle: string;
  content: any[]; // Slate format content
  returnUrl: string;
  timestamp?: number;
}

interface PendingReplyAction {
  pageId: string;
  returnUrl: string;
}

// Storage keys
const STORAGE_KEYS = {
  DRAFT_REPLY: 'wewrite_draft_reply',
  PENDING_REPLY_ACTION: 'wewrite_pending_reply_action'
} as const;

/**
 * Save a draft reply to local storage
 */
export const saveDraftReply = (draftReply: Omit<DraftReply, 'timestamp'>): boolean => {
  try {
    if (!draftReply || !draftReply.pageId || !draftReply.content) {
      console.error('Invalid draft reply data:', draftReply);
      return false;
    }

    // Add timestamp to track when the draft was created
    const draftWithTimestamp: DraftReply = {
      ...draftReply,
      timestamp: Date.now()
    };

    localStorage.setItem(STORAGE_KEYS.DRAFT_REPLY, JSON.stringify(draftWithTimestamp));
    return true;
  } catch (error) {
    console.error('Error saving draft reply:', error);
    return false;
  }
};

/**
 * Get the current draft reply from local storage
 */
export const getDraftReply = (): DraftReply | null => {
  try {
    const draftReplyJson = localStorage.getItem(STORAGE_KEYS.DRAFT_REPLY);
    if (!draftReplyJson) return null;

    const draftReply: DraftReply = JSON.parse(draftReplyJson);

    // Check if the draft is still valid (less than 24 hours old)
    const now = Date.now();
    const draftAge = now - (draftReply.timestamp || 0);
    const MAX_DRAFT_AGE = 24 * 60 * 60 * 1000; // 24 hours

    if (draftAge > MAX_DRAFT_AGE) {
      // Draft is too old, clear it
      clearDraftReply();
      return null;
    }

    return draftReply;
  } catch (error) {
    console.error('Error getting draft reply:', error);
    return null;
  }
};

/**
 * Clear the draft reply from local storage
 */
export const clearDraftReply = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.DRAFT_REPLY);
  } catch (error) {
    console.error('Error clearing draft reply:', error);
  }
};

/**
 * Set a pending reply action to indicate we're in the middle of posting a reply
 */
export const setPendingReplyAction = (actionData: PendingReplyAction): boolean => {
  try {
    if (!actionData || !actionData.pageId) {
      console.error('Invalid pending reply action data:', actionData);
      return false;
    }

    localStorage.setItem(STORAGE_KEYS.PENDING_REPLY_ACTION, JSON.stringify(actionData));
    return true;
  } catch (error) {
    console.error('Error setting pending reply action:', error);
    return false;
  }
};

/**
 * Get the current pending reply action
 */
export const getPendingReplyAction = (): PendingReplyAction | null => {
  try {
    const actionJson = localStorage.getItem(STORAGE_KEYS.PENDING_REPLY_ACTION);
    if (!actionJson) return null;

    return JSON.parse(actionJson);
  } catch (error) {
    console.error('Error getting pending reply action:', error);
    return null;
  }
};

/**
 * Clear the pending reply action
 */
export const clearPendingReplyAction = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.PENDING_REPLY_ACTION);
  } catch (error) {
    console.error('Error clearing pending reply action:', error);
  }
};

/**
 * Check if there's a pending reply that needs to be posted after authentication
 */
export const hasPendingReply = (): boolean => {
  return !!getDraftReply() && !!getPendingReplyAction();
};