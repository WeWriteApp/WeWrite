/**
 * Activity Service
 * 
 * Manages the activities collection with pre-computed diff data.
 * This service abstracts away the complexity of diff calculations and provides
 * a clean API for activity-related operations.
 */

import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/database/core';
import { diff } from '../utils/diffService';

export interface ActivityRecord {
  id?: string;
  pageId: string;
  pageName: string;
  userId: string;
  username: string;
  timestamp: Date;
  diff: {
    added: number;
    removed: number;
    hasChanges: boolean;
  };
  preview?: string;
  isPublic: boolean;
  isNewPage: boolean;
  versionId?: string;
}

export interface CreateActivityOptions {
  pageId: string;
  pageName: string;
  userId: string;
  username: string;
  currentContent: string;
  previousContent: string;
  isPublic: boolean;
  isNewPage?: boolean;
  versionId?: string;
  skipIfNoChanges?: boolean;
}

/**
 * Activity Service Class
 */
export class ActivityService {
  
  /**
   * Create a new activity record with pre-computed diff data
   */
  static async createActivity(options: CreateActivityOptions): Promise<ActivityRecord | null> {
    try {
      const {
        pageId,
        pageName,
        userId,
        username,
        currentContent,
        previousContent,
        isPublic,
        isNewPage = false,
        versionId,
        skipIfNoChanges = true
      } = options;

      // Calculate diff data
      const diffResult = await diff(currentContent, previousContent);
      
      // Skip if no changes and skipIfNoChanges is true
      if (skipIfNoChanges && !diffResult.added && !diffResult.removed && !isNewPage) {
        console.log('ActivityService: Skipping activity creation - no meaningful changes detected');
        return null;
      }

      // Create activity record
      const activityData = {
        pageId,
        pageName: pageName || 'Untitled',
        userId,
        username: username || 'Anonymous',
        timestamp: Timestamp.now(),
        diff: {
          added: diffResult.added,
          removed: diffResult.removed,
          hasChanges: diffResult.added > 0 || diffResult.removed > 0 || isNewPage
        },
        isPublic: isPublic || false,
        isNewPage,
        ...(versionId && { versionId })
      };

      // Store in activities collection
      const activitiesRef = collection(db, 'activities');
      const docRef = await addDoc(activitiesRef, activityData);

      console.log('ActivityService: Created activity record', {
        activityId: docRef.id,
        pageId,
        added: diffResult.added,
        removed: diffResult.removed,
        hasChanges: activityData.diff.hasChanges
      });

      return {
        id: docRef.id,
        ...activityData,
        timestamp: activityData.timestamp.toDate()
      };

    } catch (error) {
      console.error('ActivityService: Error creating activity record:', error);
      // Don't throw - activity creation shouldn't break page saves
      return null;
    }
  }

  /**
   * Get recent activities for the activity feed
   */
  static async getRecentActivities(options: {
    limitCount?: number;
    publicOnly?: boolean;
    userId?: string;
  } = {}): Promise<ActivityRecord[]> {
    try {
      const { limitCount = 20, publicOnly = true, userId } = options;

      let activitiesQuery = query(
        collection(db, 'activities'),
        orderBy('timestamp', 'desc'),
        limit(limitCount * 2) // Get extra to account for filtering
      );

      // Add public filter if needed
      if (publicOnly) {
        activitiesQuery = query(
          collection(db, 'activities'),
          where('isPublic', '==', true),
          orderBy('timestamp', 'desc'),
          limit(limitCount * 2)
        );
      }

      // Add user filter if specified
      if (userId) {
        activitiesQuery = query(
          collection(db, 'activities'),
          where('userId', '==', userId),
          orderBy('timestamp', 'desc'),
          limit(limitCount * 2)
        );
      }

      const snapshot = await getDocs(activitiesQuery);
      
      const activities: ActivityRecord[] = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate()
        } as ActivityRecord))
        .filter(activity => {
          // Filter out activities with no meaningful changes (unless it's a new page)
          return activity.isNewPage || activity.diff.hasChanges;
        })
        .slice(0, limitCount); // Limit to requested count after filtering

      console.log('ActivityService: Retrieved activities', {
        requested: limitCount,
        retrieved: activities.length,
        filtered: snapshot.docs.length - activities.length
      });

      return activities;

    } catch (error) {
      console.error('ActivityService: Error getting recent activities:', error);
      return [];
    }
  }

  /**
   * Get activities for a specific page
   */
  static async getPageActivities(pageId: string, limitCount: number = 10): Promise<ActivityRecord[]> {
    try {
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('pageId', '==', pageId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(activitiesQuery);
      
      const activities: ActivityRecord[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      } as ActivityRecord));

      return activities;

    } catch (error) {
      console.error('ActivityService: Error getting page activities:', error);
      return [];
    }
  }

  /**
   * Get activities for a specific user
   */
  static async getUserActivities(userId: string, limitCount: number = 20): Promise<ActivityRecord[]> {
    try {
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(activitiesQuery);
      
      const activities: ActivityRecord[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      } as ActivityRecord));

      return activities;

    } catch (error) {
      console.error('ActivityService: Error getting user activities:', error);
      return [];
    }
  }
}

export default ActivityService;
