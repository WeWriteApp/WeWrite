import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/database/core';
import { extractTextContent } from '../utils/text-extraction';
import { hasContentChanged } from '../utils/contentNormalization';

export interface ContentChangeEvent {
  pageId: string;
  userId: string;
  username: string;
  charactersAdded: number;
  charactersDeleted: number;
  netChange: number;
  timestamp: Date;
  previousContentLength: number;
  newContentLength: number;
}

/**
 * Content Changes Tracking Service
 * 
 * Tracks character additions and deletions during page edits
 * for analytics dashboard visualization.
 */
export class ContentChangesTrackingService {
  
  /**
   * Track content changes when a page is saved
   */
  static async trackContentChange(
    pageId: string,
    userId: string,
    username: string,
    previousContent: any,
    newContent: any
  ): Promise<void> {
    try {
      // Enhanced no-op detection: Use robust content normalization
      if (!hasContentChanged(newContent, previousContent)) {
        console.log('Content tracking: No meaningful changes detected, skipping analytics recording');
        return;
      }

      // Extract text content from both versions
      const previousText = extractTextContent(previousContent);
      const newText = extractTextContent(newContent);

      // Calculate character changes
      const previousLength = previousText.length;
      const newLength = newText.length;

      // Simple character diff calculation
      let charactersAdded = 0;
      let charactersDeleted = 0;

      if (newLength > previousLength) {
        charactersAdded = newLength - previousLength;
      } else if (previousLength > newLength) {
        charactersDeleted = previousLength - newLength;
      }

      // Additional check: Only track if there are actual character changes
      if (charactersAdded === 0 && charactersDeleted === 0) {
        console.log('Content tracking: No character changes detected, skipping analytics recording');
        return;
      }
      
      const netChange = charactersAdded - charactersDeleted;
      
      // Create content change event
      const changeEvent: ContentChangeEvent = {
        pageId,
        userId,
        username,
        charactersAdded,
        charactersDeleted,
        netChange,
        timestamp: new Date(),
        previousContentLength: previousLength,
        newContentLength: newLength
      };
      
      // Store in Firestore analytics collection
      const analyticsRef = collection(db, 'analytics_events');
      await addDoc(analyticsRef, {
        ...changeEvent,
        timestamp: Timestamp.fromDate(changeEvent.timestamp),
        eventType: 'content_change'
      });
      
      console.log('📊 Content change tracked:', {
        pageId,
        charactersAdded,
        charactersDeleted,
        netChange
      });
      
    } catch (error) {
      console.error('Error tracking content change:', error);
      // Don't throw error to avoid disrupting the save process
    }
  }
  
  /**
   * Track content changes with more sophisticated diff calculation
   * This version uses a simple LCS-based approach for better accuracy
   */
  static async trackContentChangeAdvanced(
    pageId: string,
    userId: string,
    username: string,
    previousContent: any,
    newContent: any
  ): Promise<void> {
    try {
      // Enhanced no-op detection: Use robust content normalization
      if (!hasContentChanged(newContent, previousContent)) {
        console.log('Advanced content tracking: No meaningful changes detected, skipping analytics recording');
        return;
      }

      // Extract text content from both versions
      const previousText = extractTextContent(previousContent);
      const newText = extractTextContent(newContent);

      // Calculate more accurate character changes using LCS
      const { added, removed } = this.calculateCharacterDiff(previousText, newText);

      // Additional check: Only track if there are actual character changes
      if (added === 0 && removed === 0) {
        console.log('Advanced content tracking: No character changes detected, skipping analytics recording');
        return;
      }
      
      const netChange = added - removed;
      
      // Create content change event
      const changeEvent: ContentChangeEvent = {
        pageId,
        userId,
        username,
        charactersAdded: added,
        charactersDeleted: removed,
        netChange,
        timestamp: new Date(),
        previousContentLength: previousText.length,
        newContentLength: newText.length
      };
      
      // Store in Firestore analytics collection
      const analyticsRef = collection(db, 'analytics_events');
      await addDoc(analyticsRef, {
        ...changeEvent,
        timestamp: Timestamp.fromDate(changeEvent.timestamp),
        eventType: 'content_change'
      });
      
      console.log('📊 Advanced content change tracked:', {
        pageId,
        charactersAdded: added,
        charactersDeleted: removed,
        netChange
      });
      
    } catch (error) {
      console.error('Error tracking advanced content change:', error);
      // Don't throw error to avoid disrupting the save process
    }
  }
  
  /**
   * Simple character diff calculation using LCS approach
   */
  private static calculateCharacterDiff(oldText: string, newText: string): { added: number; removed: number } {
    // For performance, use a simplified approach for large texts
    if (oldText.length > 10000 || newText.length > 10000) {
      // Fall back to simple length comparison for very large texts
      const lengthDiff = newText.length - oldText.length;
      return {
        added: Math.max(0, lengthDiff),
        removed: Math.max(0, -lengthDiff)
      };
    }
    
    // Use a simplified LCS-based approach
    const lcs = this.longestCommonSubsequence(oldText, newText);
    const added = newText.length - lcs;
    const removed = oldText.length - lcs;
    
    return { added, removed };
  }
  
  /**
   * Calculate longest common subsequence length
   */
  private static longestCommonSubsequence(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    return dp[m][n];
  }
}
