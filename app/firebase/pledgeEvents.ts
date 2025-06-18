import { updateUserContributorCount } from './counters';
import { db } from './config';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';

/**
 * Set up listeners for pledge changes to automatically update contributor counts
 * This ensures contributor counts stay in sync when pledges are created, updated, or deleted
 */

/**
 * Listen to pledge changes for a specific user and update their contributor count
 * @param userId - The user ID (page author) to monitor pledges for
 * @returns Unsubscribe function
 */
export const listenToPledgeChangesForUser = (userId: string) => {
  if (!userId) return null;

  try {
    // Query pledges where this user is the recipient (page author)
    const pledgesQuery = query(
      collection(db, 'pledges'),
      where('metadata.authorUserId', '==', userId)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(pledgesQuery, (snapshot) => {
      console.log(`Pledge changes detected for user ${userId}, updating contributor count...`);
      
      // Update contributor count in the background
      updateUserContributorCount(userId).catch(error => {
        console.error('Error updating contributor count after pledge change:', error);
      });
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up pledge change listener:', error);
    return null;
  }
};

/**
 * Handle pledge creation - update contributor count for the page author
 * @param pledgeData - The pledge data
 */
export const handlePledgeCreated = async (pledgeData: any) => {
  try {
    const authorUserId = pledgeData.metadata?.authorUserId;
    if (authorUserId) {
      await updateUserContributorCount(authorUserId);
      console.log(`Updated contributor count for user ${authorUserId} after pledge creation`);
    }
  } catch (error) {
    console.error('Error handling pledge creation:', error);
  }
};

/**
 * Handle pledge status change - update contributor count for the page author
 * @param pledgeData - The pledge data
 * @param oldStatus - The previous status
 * @param newStatus - The new status
 */
export const handlePledgeStatusChange = async (pledgeData: any, oldStatus: string, newStatus: string) => {
  try {
    const authorUserId = pledgeData.metadata?.authorUserId;
    if (authorUserId) {
      // Only update if the status change affects whether the pledge counts as active
      const oldIsActive = ['active', 'completed'].includes(oldStatus);
      const newIsActive = ['active', 'completed'].includes(newStatus);
      
      if (oldIsActive !== newIsActive) {
        await updateUserContributorCount(authorUserId);
        console.log(`Updated contributor count for user ${authorUserId} after pledge status change: ${oldStatus} -> ${newStatus}`);
      }
    }
  } catch (error) {
    console.error('Error handling pledge status change:', error);
  }
};

/**
 * Handle pledge deletion - update contributor count for the page author
 * @param pledgeData - The pledge data
 */
export const handlePledgeDeleted = async (pledgeData: any) => {
  try {
    const authorUserId = pledgeData.metadata?.authorUserId;
    if (authorUserId) {
      await updateUserContributorCount(authorUserId);
      console.log(`Updated contributor count for user ${authorUserId} after pledge deletion`);
    }
  } catch (error) {
    console.error('Error handling pledge deletion:', error);
  }
};
