import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/database/core';

export interface ShareEvent {
  pageId: string;
  userId?: string;
  username?: string;
  pageTitle: string;
  pageAuthor: string;
  shareMethod: string;
  eventType: 'share_succeeded' | 'share_aborted';
  abortReason?: string;
  timestamp: Date;
}

/**
 * Shares Tracking Service
 * 
 * Tracks page sharing events for analytics dashboard visualization.
 */
export class SharesTrackingService {
  
  /**
   * Track a successful share event
   */
  static async trackShareSucceeded(
    pageId: string,
    shareMethod: string,
    userId?: string,
    username?: string,
    pageTitle?: string,
    pageAuthor?: string
  ): Promise<void> {
    try {
      const shareEvent: ShareEvent = {
        pageId,
        userId,
        username,
        pageTitle: pageTitle || 'Untitled',
        pageAuthor: pageAuthor || 'Anonymous',
        shareMethod,
        eventType: 'share_succeeded',
        timestamp: new Date()
      };

      // Store in Firestore analytics collection
      const analyticsRef = collection(db, 'analytics_events');
      await addDoc(analyticsRef, {
        ...shareEvent,
        timestamp: Timestamp.fromDate(shareEvent.timestamp),
        eventType: 'share_event'
      });

    } catch (error) {
      console.error('Error tracking share succeeded event:', error);
      // Don't throw error to avoid disrupting the share process
    }
  }

  /**
   * Track an aborted share event
   */
  static async trackShareAborted(
    pageId: string,
    shareMethod: string,
    abortReason?: string,
    userId?: string,
    username?: string,
    pageTitle?: string,
    pageAuthor?: string
  ): Promise<void> {
    try {
      const shareEvent: ShareEvent = {
        pageId,
        userId,
        username,
        pageTitle: pageTitle || 'Untitled',
        pageAuthor: pageAuthor || 'Anonymous',
        shareMethod,
        eventType: 'share_aborted',
        abortReason,
        timestamp: new Date()
      };

      // Store in Firestore analytics collection
      const analyticsRef = collection(db, 'analytics_events');
      await addDoc(analyticsRef, {
        ...shareEvent,
        timestamp: Timestamp.fromDate(shareEvent.timestamp),
        eventType: 'share_event'
      });

    } catch (error) {
      console.error('Error tracking share aborted event:', error);
      // Don't throw error to avoid disrupting the user experience
    }
  }

  /**
   * Track a share event (generic method)
   */
  static async trackShareEvent(
    eventType: 'share_succeeded' | 'share_aborted',
    pageId: string,
    shareMethod: string,
    options: {
      userId?: string;
      username?: string;
      pageTitle?: string;
      pageAuthor?: string;
      abortReason?: string;
    } = {}
  ): Promise<void> {
    if (eventType === 'share_succeeded') {
      await this.trackShareSucceeded(
        pageId,
        shareMethod,
        options.userId,
        options.username,
        options.pageTitle,
        options.pageAuthor
      );
    } else {
      await this.trackShareAborted(
        pageId,
        shareMethod,
        options.abortReason,
        options.userId,
        options.username,
        options.pageTitle,
        options.pageAuthor
      );
    }
  }
}