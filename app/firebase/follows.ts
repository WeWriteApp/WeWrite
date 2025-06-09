"use client";

import { db } from './database';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  type Firestore,
  type DocumentData,
  type DocumentSnapshot,
  type QuerySnapshot,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
import type { Page, User } from '../types/database';

// Type definitions for follow operations
interface UserFollowsData {
  userId: string;
  followedPages: string[];
  createdAt?: any;
  updatedAt?: any;
}

interface UserFollowingData {
  userId: string;
  following: string[];
  createdAt?: any;
  updatedAt?: any;
}

interface UserFollowersData {
  userId: string;
  followers: string[];
  createdAt?: any;
  updatedAt?: any;
}

interface PageFollowerData {
  pageId: string;
  userId: string;
  followedAt?: any;
  deleted?: boolean;
  deletedAt?: any;
}

interface FollowRecordData {
  followerId: string;
  followedId: string;
  followedAt?: any;
  deleted?: boolean;
  deletedAt?: any;
}

interface UnfollowResult {
  success: boolean;
  count: number;
}

/**
 * Follow a page
 *
 * @param userId - The ID of the user following the page
 * @param pageId - The ID of the page to follow
 * @returns Promise that resolves to true if successful
 */
export const followPage = async (userId: string, pageId: string): Promise<boolean> => {
  if (!userId || !pageId) {
    throw new Error('User ID and Page ID are required');
  }

  try {
    // Add the page to the user's followed pages
    const userFollowsRef = doc(db, 'userFollows', userId);
    const userFollowsDoc = await getDoc(userFollowsRef);

    if (userFollowsDoc.exists()) {
      // Update existing document
      await updateDoc(userFollowsRef, {
        followedPages: arrayUnion(pageId),
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new document
      await setDoc(userFollowsRef, {
        userId,
        followedPages: [pageId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // Increment the follower count for the page
    const pageRef = doc(db, 'pages', pageId);
    const pageDoc = await getDoc(pageRef);

    if (pageDoc.exists()) {
      const pageData = pageDoc.data() as Page;

      // Check if followerCount field exists
      if (typeof pageData.followerCount === 'undefined') {
        // Initialize followerCount to 1 if it doesn't exist
        await updateDoc(pageRef, {
          followerCount: 1
        });
      } else {
        // Increment existing followerCount
        await updateDoc(pageRef, {
          followerCount: increment(1)
        });
      }
    } else {
      // If the page document doesn't exist, we can't follow it
      throw new Error('Page not found');
    }

    // Add a record to the pageFollowers collection
    const pageFollowerRef = doc(db, 'pageFollowers', `${pageId}_${userId}`);
    await setDoc(pageFollowerRef, {
      pageId,
      userId,
      followedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error following page:', error);
    throw error;
  }
};

/**
 * Unfollow a page
 *
 * @param userId - The ID of the user unfollowing the page
 * @param pageId - The ID of the page to unfollow
 * @returns Promise that resolves to true if successful
 */
export const unfollowPage = async (userId: string, pageId: string): Promise<boolean> => {
  if (!userId || !pageId) {
    throw new Error('User ID and Page ID are required');
  }

  try {
    // Remove the page from the user's followed pages
    const userFollowsRef = doc(db, 'userFollows', userId);

    // Check if the document exists first
    const userFollowsDoc = await getDoc(userFollowsRef);

    if (userFollowsDoc.exists()) {
      await updateDoc(userFollowsRef, {
        followedPages: arrayRemove(pageId),
        updatedAt: serverTimestamp()
      });
    } else {
      console.warn('User follows document does not exist for user:', userId);
      // Create an empty document if it doesn't exist
      await setDoc(userFollowsRef, {
        followedPages: [],
        updatedAt: serverTimestamp()
      });
    }

    // Decrement the follower count for the page
    const pageRef = doc(db, 'pages', pageId);
    const pageDoc = await getDoc(pageRef);

    if (pageDoc.exists()) {
      const pageData = pageDoc.data() as Page;

      // Check if followerCount field exists
      if (typeof pageData.followerCount === 'undefined' || pageData.followerCount <= 0) {
        // If followerCount doesn't exist or is already 0, set it to 0
        await updateDoc(pageRef, {
          followerCount: 0
        });
      } else {
        // Decrement existing followerCount
        await updateDoc(pageRef, {
          followerCount: increment(-1)
        });
      }
    } else {
      // If the page document doesn't exist, we can't unfollow it
      throw new Error('Page not found');
    }

    // Remove the record from the pageFollowers collection
    try {
      const pageFollowerRef = doc(db, 'pageFollowers', `${pageId}_${userId}`);

      // Check if the document exists first
      const pageFollowerDoc = await getDoc(pageFollowerRef);

      // If it exists, mark as deleted; if not, create a new deleted record
      if (pageFollowerDoc.exists()) {
        await updateDoc(pageFollowerRef, {
          deleted: true,
          deletedAt: serverTimestamp()
        });
      } else {
        await setDoc(pageFollowerRef, {
          pageId,
          userId,
          deleted: true,
          deletedAt: serverTimestamp(),
          followedAt: serverTimestamp() // Add this for consistency
        });
      }
    } catch (err) {
      // Log but don't throw - we want the unfollow to succeed even if this part fails
      console.warn('Error updating pageFollowers record:', err);
    }

    return true;
  } catch (error) {
    console.error('Error unfollowing page:', error);
    throw error;
  }
};

/**
 * Check if a user is following a page
 *
 * @param userId - The ID of the user
 * @param pageId - The ID of the page
 * @returns True if the user is following the page
 */
export const isFollowingPage = async (userId: string, pageId: string): Promise<boolean> => {
  if (!userId || !pageId) {
    return false;
  }

  try {
    const userFollowsRef = doc(db, 'userFollows', userId);
    const userFollowsDoc = await getDoc(userFollowsRef);

    if (userFollowsDoc.exists()) {
      const data = userFollowsDoc.data() as UserFollowsData;
      return data.followedPages && data.followedPages.includes(pageId);
    }

    return false;
  } catch (error) {
    console.error('Error checking if following page:', error);
    return false;
  }
};

/**
 * Get all pages followed by a user
 *
 * @param userId - The ID of the user
 * @returns Array of page IDs
 */
export const getFollowedPages = async (userId: string): Promise<string[]> => {
  if (!userId) {
    return [];
  }

  try {
    const userFollowsRef = doc(db, 'userFollows', userId);
    const userFollowsDoc = await getDoc(userFollowsRef);

    if (userFollowsDoc.exists()) {
      const data = userFollowsDoc.data() as UserFollowsData;
      return data.followedPages || [];
    }

    return [];
  } catch (error) {
    console.error('Error getting followed pages:', error);
    return [];
  }
};

/**
 * Get the follower count for a page
 *
 * @param pageId - The ID of the page
 * @returns The number of followers
 */
export const getPageFollowerCount = async (pageId: string): Promise<number> => {
  if (!pageId) {
    return 0;
  }

  try {
    const pageRef = doc(db, 'pages', pageId);
    const pageDoc = await getDoc(pageRef);

    if (pageDoc.exists()) {
      const data = pageDoc.data() as Page;
      return data.followerCount || 0;
    }

    return 0;
  } catch (error) {
    console.error('Error getting page follower count:', error);
    return 0;
  }
};

/**
 * Get the count of pages a user follows
 *
 * @param userId - The ID of the user
 * @returns The number of pages the user follows
 */
export const getUserFollowingCount = async (userId: string): Promise<number> => {
  if (!userId) {
    return 0;
  }

  try {
    const userFollowsRef = doc(db, 'userFollows', userId);
    const userFollowsDoc = await getDoc(userFollowsRef);

    if (userFollowsDoc.exists()) {
      const data = userFollowsDoc.data() as UserFollowsData;
      return data.followedPages?.length || 0;
    }

    return 0;
  } catch (error) {
    console.error('Error getting user following count:', error);
    return 0;
  }
};

/**
 * Get the count of followers for a user
 * This counts unique users who follow any page created by this user
 *
 * @param userId - The ID of the user
 * @returns The number of unique followers
 */
export const getUserFollowerCount = async (userId: string): Promise<number> => {
  if (!userId) {
    return 0;
  }

  try {
    // First get all pages created by this user
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId)
    );

    const pagesSnapshot = await getDocs(pagesQuery);

    if (pagesSnapshot.empty) {
      return 0;
    }

    // Get all page IDs created by this user
    const pageIds = pagesSnapshot.docs.map(doc => doc.id);

    // For each page, get the followers
    const uniqueFollowers = new Set();

    // Query the pageFollowers collection for all followers of these pages
    // We need to do this in batches since Firestore 'in' queries are limited to 10 items
    const batchSize = 10;
    for (let i = 0; i < pageIds.length; i += batchSize) {
      const batch = pageIds.slice(i, i + batchSize);

      // Only proceed if we have valid page IDs in the batch
      if (batch.length === 0) continue;

      try {
        // First query without the deleted field filter
        const followersQuery = query(
          collection(db, 'pageFollowers'),
          where('pageId', 'in', batch)
        );

        const followersSnapshot = await getDocs(followersQuery);

        // Add each unique follower to the set, filtering out deleted ones in memory
        followersSnapshot.forEach(doc => {
          const data = doc.data() as PageFollowerData;
          // Only count followers that aren't deleted and aren't self-follows
          if (data.userId && data.userId !== userId && data.deleted !== true) {
            uniqueFollowers.add(data.userId);
          }
        });
      } catch (batchError) {
        console.error(`Error processing batch ${i}:`, batchError);
        // Continue with the next batch instead of failing completely
      }
    }

    return uniqueFollowers.size;
  } catch (error) {
    console.error('Error getting user follower count:', error);
    return 0;
  }
};

/**
 * Unfollow all pages by a specific user
 * This is useful for removing self-follows
 *
 * @param userId - The ID of the user
 * @returns Result with success status and count of unfollowed pages
 */
export const unfollowAllPagesByUser = async (userId: string): Promise<UnfollowResult> => {
  if (!userId) {
    return { success: false, count: 0 };
  }

  try {
    // Get all pages the user is following
    const followedPages = await getFollowedPages(userId);

    if (followedPages.length === 0) {
      return { success: true, count: 0 };
    }

    // Get all pages created by this user
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId)
    );

    const pagesSnapshot = await getDocs(pagesQuery);
    const userPageIds = pagesSnapshot.docs.map(doc => doc.id);

    // Find self-follows (pages created by the user that they are also following)
    const selfFollows = followedPages.filter(pageId => userPageIds.includes(pageId));

    if (selfFollows.length === 0) {
      return { success: true, count: 0 };
    }

    // Unfollow each self-followed page
    const unfollowPromises = selfFollows.map(pageId => unfollowPage(userId, pageId));
    await Promise.all(unfollowPromises);

    return { success: true, count: selfFollows.length };
  } catch (error) {
    console.error('Error unfollowing all pages by user:', error);
    return { success: false, count: 0 };
  }
};

/**
 * Follow a user
 *
 * @param followerId - The ID of the user doing the following
 * @param followedId - The ID of the user being followed
 * @returns Whether the operation was successful
 */
export const followUser = async (followerId: string, followedId: string): Promise<boolean> => {
  if (!followerId || !followedId) {
    throw new Error('Follower ID and Followed ID are required');
  }

  if (followerId === followedId) {
    throw new Error('Users cannot follow themselves');
  }

  try {
    // Add the followed user to the follower's following list
    const userFollowingRef = doc(db, 'userFollowing', followerId);
    const userFollowingDoc = await getDoc(userFollowingRef);

    if (userFollowingDoc.exists()) {
      // Update existing document
      await updateDoc(userFollowingRef, {
        following: arrayUnion(followedId),
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new document
      await setDoc(userFollowingRef, {
        userId: followerId,
        following: [followedId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // Add the follower to the followed user's followers list
    const userFollowersRef = doc(db, 'userFollowers', followedId);
    const userFollowersDoc = await getDoc(userFollowersRef);

    if (userFollowersDoc.exists()) {
      // Update existing document
      await updateDoc(userFollowersRef, {
        followers: arrayUnion(followerId),
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new document
      await setDoc(userFollowersRef, {
        userId: followedId,
        followers: [followerId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // Increment follower count for the followed user
    const followedUserRef = doc(db, 'users', followedId);
    const followedUserDoc = await getDoc(followedUserRef);

    if (followedUserDoc.exists()) {
      const userData = followedUserDoc.data() as User;

      // Check if followerCount field exists
      if (typeof userData.followerCount === 'undefined') {
        // Initialize followerCount to 1 if it doesn't exist
        await updateDoc(followedUserRef, {
          followerCount: 1
        });
      } else {
        // Increment existing followerCount
        await updateDoc(followedUserRef, {
          followerCount: increment(1)
        });
      }
    }

    // Create a follow record
    const followRecordRef = doc(db, 'follows', `${followerId}_${followedId}`);
    await setDoc(followRecordRef, {
      followerId,
      followedId,
      followedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error following user:', error);
    throw error;
  }
};

/**
 * Unfollow a user
 *
 * @param followerId - The ID of the user doing the unfollowing
 * @param followedId - The ID of the user being unfollowed
 * @returns Whether the operation was successful
 */
export const unfollowUser = async (followerId: string, followedId: string): Promise<boolean> => {
  if (!followerId || !followedId) {
    throw new Error('Follower ID and Followed ID are required');
  }

  try {
    // Remove the followed user from the follower's following list
    const userFollowingRef = doc(db, 'userFollowing', followerId);
    const userFollowingDoc = await getDoc(userFollowingRef);

    if (userFollowingDoc.exists()) {
      await updateDoc(userFollowingRef, {
        following: arrayRemove(followedId),
        updatedAt: serverTimestamp()
      });
    }

    // Remove the follower from the followed user's followers list
    const userFollowersRef = doc(db, 'userFollowers', followedId);
    const userFollowersDoc = await getDoc(userFollowersRef);

    if (userFollowersDoc.exists()) {
      await updateDoc(userFollowersRef, {
        followers: arrayRemove(followerId),
        updatedAt: serverTimestamp()
      });
    }

    // Decrement follower count for the followed user
    const followedUserRef = doc(db, 'users', followedId);
    const followedUserDoc = await getDoc(followedUserRef);

    if (followedUserDoc.exists()) {
      const userData = followedUserDoc.data() as User;

      // Check if followerCount field exists
      if (typeof userData.followerCount === 'undefined' || userData.followerCount <= 0) {
        // If followerCount doesn't exist or is already 0, set it to 0
        await updateDoc(followedUserRef, {
          followerCount: 0
        });
      } else {
        // Decrement existing followerCount
        await updateDoc(followedUserRef, {
          followerCount: increment(-1)
        });
      }
    }

    // Mark follow record as deleted
    const followRecordRef = doc(db, 'follows', `${followerId}_${followedId}`);
    const followRecordDoc = await getDoc(followRecordRef);

    if (followRecordDoc.exists()) {
      await updateDoc(followRecordRef, {
        deleted: true,
        deletedAt: serverTimestamp()
      });
    }

    return true;
  } catch (error) {
    console.error('Error unfollowing user:', error);
    throw error;
  }
};

/**
 * Get users that a user follows
 *
 * @param userId - The ID of the user
 * @returns Array of user IDs that the user follows
 */
export const getFollowedUsers = async (userId: string): Promise<string[]> => {
  if (!userId) {
    return [];
  }

  try {
    const userFollowingRef = doc(db, 'userFollowing', userId);
    const userFollowingDoc = await getDoc(userFollowingRef);

    if (userFollowingDoc.exists()) {
      const data = userFollowingDoc.data() as UserFollowingData;
      return data.following || [];
    }

    return [];
  } catch (error) {
    console.error('Error getting followed users:', error);
    return [];
  }
};

/**
 * Get users that follow a user
 *
 * @param userId - The ID of the user
 * @returns Array of user IDs that follow the user
 */
export const getFollowers = async (userId: string): Promise<string[]> => {
  if (!userId) {
    return [];
  }

  try {
    const userFollowersRef = doc(db, 'userFollowers', userId);
    const userFollowersDoc = await getDoc(userFollowersRef);

    if (userFollowersDoc.exists()) {
      const data = userFollowersDoc.data() as UserFollowersData;
      return data.followers || [];
    }

    return [];
  } catch (error) {
    console.error('Error getting followers:', error);
    return [];
  }
};

/**
 * Check if a user follows another user
 *
 * @param followerId - The ID of the potential follower
 * @param followedId - The ID of the potentially followed user
 * @returns Whether the follower follows the followed user
 */
export const checkIfFollowing = async (followerId: string, followedId: string): Promise<boolean> => {
  if (!followerId || !followedId) {
    return false;
  }

  try {
    const userFollowingRef = doc(db, 'userFollowing', followerId);
    const userFollowingDoc = await getDoc(userFollowingRef);

    if (userFollowingDoc.exists()) {
      const data = userFollowingDoc.data() as UserFollowingData;
      return data.following && data.following.includes(followedId);
    }

    return false;
  } catch (error) {
    console.error('Error checking if following:', error);
    return false;
  }
};
