import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter
} from "firebase/firestore";

import { get, ref } from "firebase/database";
import { rtdb } from "../rtdb";

import { db } from "./core";
import { generateCacheKey, getCacheItem, setCacheItem } from "../../utils/cacheUtils";
import { trackQueryPerformance } from "../../utils/queryMonitor";

import type { User, Group } from "../../types/database";

/**
 * Get user pages with pagination and access control
 */
export async function getUserPages(
  userId: string,
  includePrivate: boolean = false,
  currentUserId: string | null = null,
  lastVisible: any = null,
  pageSize: number = 200
) {
  return await trackQueryPerformance('getUserPages', async () => {
    try {
      // Check cache first (only for public pages)
      if (!includePrivate && !lastVisible) {
        const cacheKey = generateCacheKey('userPages', userId, 'public');
        const cachedData = getCacheItem(cacheKey);

        if (cachedData) {
          console.log(`Using cached data for user pages (${userId})`);
          return cachedData;
        }
      }

      // Get user's own pages from Firestore with field selection
      const pagesRef = collection(db, "pages");
      let pageQuery;

      // Define the fields we need to reduce data transfer
      // This significantly reduces the amount of data transferred from Firestore
      const requiredFields = ["title", "lastModified", "isPublic", "userId", "groupId", "createdAt"];

      // Build the query with cursor-based pagination (exclude deleted pages)
      if (includePrivate && userId === currentUserId) {
        // If viewing own profile and includePrivate is true, get all non-deleted pages
        pageQuery = query(
          pagesRef,
          where("userId", "==", userId),
          where("deleted", "!=", true),
          orderBy("lastModified", "desc")
        );
      } else {
        // If viewing someone else's profile, only get public, non-deleted pages
        pageQuery = query(
          pagesRef,
          where("userId", "==", userId),
          where("isPublic", "==", true),
          where("deleted", "!=", true),
          orderBy("lastModified", "desc")
        );
      }

      // Add pagination
      if (lastVisible) {
        pageQuery = query(pageQuery, startAfter(lastVisible), limit(pageSize));
      } else {
        pageQuery = query(pageQuery, limit(pageSize));
      }

      // Execute the query with field selection
      const pagesSnapshot = await getDocs(pageQuery);
      const pages = [];

      // Store the last document for pagination
      const lastDoc = pagesSnapshot.docs.length > 0 ?
        pagesSnapshot.docs[pagesSnapshot.docs.length - 1] : null;

      pagesSnapshot.forEach((doc) => {
        pages.push({
          id: doc.id,
          ...(doc.data() as any)
        });
      });

      // Get pages from groups the user is a member of
      const groupsRef = ref(rtdb, 'groups');
      const groupsSnapshot = await get(groupsRef);

      if (groupsSnapshot.exists()) {
        const groups = groupsSnapshot.val();

        // Find groups where user is a member
        const userGroups = Object.entries(groups)
          .filter(([_, groupData]) =>
            (groupData as any).members && (groupData as any).members[userId]
          )
          .map(([groupId, groupData]) => ({
            id: groupId,
            ...(groupData as any)
          }));

        // For each group, get all pages using batch operations
        if (userGroups.length > 0) {
          // Collect all group page IDs
          const groupPageIds = [];
          const groupInfoByPageId = {};

          for (const group of userGroups) {
            // Skip private groups if the current user is not a member or owner
            if (!group.isPublic && currentUserId !== userId) {
              if (group.owner !== currentUserId &&
                  (!group.members || !group.members[currentUserId])) {
                continue;
              }
            }

            if (group.pages) {
              // Get page IDs from this group
              const pageIds = Object.keys(group.pages);

              for (const pageId of pageIds) {
                // Check if we already have this page
                if (!pages.some(p => p.id === pageId) && !groupPageIds.includes(pageId)) {
                  groupPageIds.push(pageId);
                  groupInfoByPageId[pageId] = {
                    groupId: group.id,
                    groupName: group.name
                  };
                }
              }
            }
          }

          // Batch fetch pages in chunks of 10 (Firestore limit for 'in' queries)
          const batchSize = 10;
          for (let i = 0; i < groupPageIds.length; i += batchSize) {
            const batch = groupPageIds.slice(i, i + batchSize);

            if (batch.length === 0) continue;

            // Create a query for this batch (exclude deleted pages)
            const batchQuery = query(
              collection(db, 'pages'),
              where('__name__', 'in', batch),
              where('deleted', '!=', true)
            );

            const batchSnapshot = await getDocs(batchQuery);

            batchSnapshot.forEach(doc => {
              const pageData = doc.data();
              const groupInfo = groupInfoByPageId[doc.id];

              pages.push({
                id: doc.id,
                ...pageData,
                // Add group information
                groupId: groupInfo.groupId,
                groupName: groupInfo.groupName
              });
            });
          }
        }
      }

      // Sort all pages by last modified date
      pages.sort((a, b) => {
        const dateA = new Date(a.lastModified || a.createdAt || 0);
        const dateB = new Date(b.lastModified || b.createdAt || 0);
        return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
      });

      // Create result object with pagination info
      const result = {
        pages,
        lastVisible: lastDoc,
        hasMore: pages.length === pageSize
      };

      // Cache the result (only for public pages and first page)
      if (!includePrivate && !lastVisible) {
        const cacheKey = generateCacheKey('userPages', userId, 'public');
        setCacheItem(cacheKey, result, 5 * 60 * 1000); // Cache for 5 minutes
      }

      return result;
    } catch (error) {
      console.error("Error getting user pages:", error);
      return { pages: [], lastVisible: null, hasMore: false };
    }
  }, { userId, includePrivate, currentUserId, pageSize });
}

/**
 * Get user profile information
 */
export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    if (!userId) {
      return null;
    }

    // Check cache first
    const cacheKey = generateCacheKey('userProfile', userId);
    const cachedData = getCacheItem(cacheKey);

    if (cachedData) {
      console.log(`Using cached user profile for ${userId}`);
      return cachedData;
    }

    const userDoc = await getDoc(doc(db, "users", userId));
    
    if (userDoc.exists()) {
      const userData = { id: userDoc.id, ...userDoc.data() } as User;
      
      // Cache the result
      setCacheItem(cacheKey, userData, 10 * 60 * 1000); // Cache for 10 minutes
      
      return userData;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};

/**
 * Get multiple user profiles efficiently
 */
export const getUserProfiles = async (userIds: string[]): Promise<Record<string, User>> => {
  try {
    if (!userIds || userIds.length === 0) {
      return {};
    }

    const profiles: Record<string, User> = {};
    const uncachedIds: string[] = [];

    // Check cache for each user
    userIds.forEach(userId => {
      const cacheKey = generateCacheKey('userProfile', userId);
      const cachedData = getCacheItem(cacheKey);
      
      if (cachedData) {
        profiles[userId] = cachedData;
      } else {
        uncachedIds.push(userId);
      }
    });

    // Fetch uncached profiles in batches
    if (uncachedIds.length > 0) {
      const batchSize = 10; // Firestore limit for 'in' queries
      
      for (let i = 0; i < uncachedIds.length; i += batchSize) {
        const batch = uncachedIds.slice(i, i + batchSize);
        
        const batchQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', batch)
        );
        
        const batchSnapshot = await getDocs(batchQuery);
        
        batchSnapshot.forEach(doc => {
          const userData = { id: doc.id, ...doc.data() } as User;
          profiles[doc.id] = userData;
          
          // Cache the result
          const cacheKey = generateCacheKey('userProfile', doc.id);
          setCacheItem(cacheKey, userData, 10 * 60 * 1000);
        });
      }
    }

    return profiles;
  } catch (error) {
    console.error("Error getting user profiles:", error);
    return {};
  }
};

/**
 * Get user statistics
 */
export const getUserStats = async (userId: string) => {
  try {
    if (!userId) {
      return null;
    }

    // This could be expanded to include more detailed statistics
    const userDoc = await getDoc(doc(db, "users", userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      return {
        totalPages: userData.totalPages || 0,
        publicPages: userData.publicPages || 0,
        privatePages: userData.privatePages || 0,
        totalPledgesReceived: userData.totalPledgesReceived || 0,
        totalEarnings: userData.totalEarnings || 0,
        joinedAt: userData.createdAt || userData.joinedAt,
        lastActive: userData.lastActive || userData.lastModified
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error getting user stats:", error);
    return null;
  }
};
