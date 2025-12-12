import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from "firebase/firestore";

import { db } from "./core";
import { getCollectionName } from "../../utils/environmentConfig";

/**
 * Search for users by username or email
 */
export const searchUsers = async (searchQuery: string, limitCount: number = 10) => {
  if (!searchQuery || searchQuery.trim().length < 2) {
    return [];
  }

  try {
    const usersRef = collection(db, getCollectionName("users"));
    const searchLower = searchQuery.toLowerCase();
    const results = new Map();

    // Search by usernameLower field (for users who have it)
    try {
      const usernameQuery = query(
        usersRef,
        where("usernameLower", ">=", searchLower),
        where("usernameLower", "<=", searchLower + "\uf8ff"),
        limit(limitCount)
      );

      const usernameResults = await getDocs(usernameQuery);
      usernameResults.forEach(doc => {
        const userData = doc.data();
        const username = userData.username || '';

        // SECURITY: Only include users with valid usernames
        if (username && !username.includes('@') && username !== 'Anonymous' && !username.toLowerCase().includes('missing')) {
          results.set(doc.id, {
            id: doc.id,
            username,
            // SECURITY: Never include email in search results
            photoURL: userData.photoURL || null
          });
        }
      });
    } catch (error) {
      console.warn("Error searching by usernameLower field:", error);
    }

    // Search by email (case insensitive)
    try {
      const emailQuery = query(
        usersRef,
        where("email", ">=", searchLower),
        where("email", "<=", searchLower + "\uf8ff"),
        limit(limitCount)
      );

      const emailResults = await getDocs(emailQuery);
      emailResults.forEach(doc => {
        if (!results.has(doc.id)) {
          const userData = doc.data();
          results.set(doc.id, {
            id: doc.id,
            username: userData.username || "Anonymous",
            email: userData.email || "",
            photoURL: userData.photoURL || null
          });
        }
      });
    } catch (error) {
      console.warn("Error searching by email field:", error);
    }

    // If we have few results, do a broader search by fetching more users and filtering client-side
    // This helps find users who don't have usernameLower field or have indexing issues
    if (results.size < 3) {
      try {
        const broadQuery = query(usersRef, limit(100));
        const broadResults = await getDocs(broadQuery);

        broadResults.forEach(doc => {
          if (!results.has(doc.id)) {
            const userData = doc.data();
            const username = userData.username || "";
            const email = userData.email || "";

            // ENHANCED: Client-side filtering with out-of-order word support
            const usernameLower = username.toLowerCase();
            const emailLower = email.toLowerCase();

            let isMatch = false;

            // SECURITY: Only search by username, never by email
            // Also filter out users without proper usernames
            if (!username || username.includes('@') || username === 'Anonymous' || username.toLowerCase().includes('missing')) {
              return; // Skip users without proper usernames
            }

            // Check for exact phrase match in username only
            if (usernameLower.includes(searchLower)) {
              isMatch = true;
            } else {
              // Check for out-of-order word matching in username only
              const searchWords = searchLower.split(/\s+/).filter(word => word.length > 1);
              if (searchWords.length > 1) {
                // Count how many search words are found in username
                let usernameMatches = 0;

                for (const word of searchWords) {
                  if (usernameLower.includes(word)) {
                    usernameMatches++;
                  }
                }

                // If most words are found in username, consider it a match
                const requiredMatches = Math.ceil(searchWords.length * 0.7);
                isMatch = usernameMatches >= requiredMatches;
              }
            }

            if (isMatch) {
              results.set(doc.id, {
                id: doc.id,
                username,
                // SECURITY: Never include email in search results
                photoURL: userData.photoURL || null
              });
            }
          }
        });
      } catch (error) {
        console.warn("Error in broad search:", error);
      }
    }

    // Sort results by relevance (exact matches first, then partial matches)
    const sortedResults = Array.from(results.values()).sort((a, b) => {
      const aUsername = a.username || '';
      const bUsername = b.username || '';
      const aUsernameExact = aUsername.toLowerCase() === searchLower;
      const bUsernameExact = bUsername.toLowerCase() === searchLower;

      // Exact username matches first
      if (aUsernameExact) return -1;
      if (bUsernameExact) return 1;

      // Then by username starts with
      const aUsernameStarts = aUsername.toLowerCase().startsWith(searchLower);
      const bUsernameStarts = bUsername.toLowerCase().startsWith(searchLower);
      if (aUsernameStarts && !bUsernameStarts) return -1;
      if (bUsernameStarts && !aUsernameStarts) return 1;

      // Finally alphabetical
      return aUsername.localeCompare(bUsername);
    });

    return sortedResults.slice(0, limitCount);
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};

/**
 * Search for pages by title or content
 */
export const searchPages = async (
  searchQuery: string,
  userId: string | null = null,
  limitCount: number = 20
) => {
  if (!searchQuery || searchQuery.trim().length < 2) {
    return [];
  }

  try {
    const pagesRef = collection(db, getCollectionName("pages"));
    const searchLower = searchQuery.toLowerCase();
    const results = new Map();

    // Search by title (case insensitive)
    try {
      const titleQuery = query(
        pagesRef,
        where("isPublic", "==", true), // Only search pages for now
        where("title", ">=", searchQuery),
        where("title", "<=", searchQuery + "\uf8ff"),
        limit(limitCount)
      );

      const titleResults = await getDocs(titleQuery);
      titleResults.forEach(doc => {
        const pageData = doc.data();
        results.set(doc.id, {
          id: doc.id,
          title: pageData.title || "Untitled",
          userId: pageData.userId,
          username: pageData.username || "Anonymous",
          lastModified: pageData.lastModified,
          isPublic: pageData.isPublic,
          matchType: 'title'
        });
      });
    } catch (error) {
      console.warn("Error searching by title:", error);
    }

    // If we have few results, do a broader search
    if (results.size < 5) {
      try {
        const broadQuery = query(
          pagesRef,
          where("isPublic", "==", true),
          limit(100)
        );
        const broadResults = await getDocs(broadQuery);

        broadResults.forEach(doc => {
          if (!results.has(doc.id)) {
            const pageData = doc.data();
            const title = pageData.title || "";

            // Client-side filtering for partial matches
            if (title.toLowerCase().includes(searchLower)) {
              results.set(doc.id, {
                id: doc.id,
                title: pageData.title || "Untitled",
                userId: pageData.userId,
                username: pageData.username || "Anonymous",
                lastModified: pageData.lastModified,
                isPublic: pageData.isPublic,
                matchType: 'partial'
              });
            }
          }
        });
      } catch (error) {
        console.warn("Error in broad page search:", error);
      }
    }

    // Sort results by relevance
    const sortedResults = Array.from(results.values()).sort((a, b) => {
      // Exact title matches first
      const aExact = a.title.toLowerCase() === searchLower;
      const bExact = b.title.toLowerCase() === searchLower;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      // Then by title starts with
      const aStarts = a.title.toLowerCase().startsWith(searchLower);
      const bStarts = b.title.toLowerCase().startsWith(searchLower);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      // Finally by last modified (newest first)
      const dateA = new Date(a.lastModified || 0);
      const dateB = new Date(b.lastModified || 0);
      return dateB.getTime() - dateA.getTime();
    });

    return sortedResults.slice(0, limitCount);
  } catch (error) {
    console.error("Error searching pages:", error);
    return [];
  }
};

/**
 * Get trending or popular pages
 */
export const getTrendingPages = async (limitCount: number = 10) => {
  try {
    const pagesRef = collection(db, getCollectionName("pages"));
    
    // For now, just get recent pages (exclude deleted)
    // In the future, this could be based on view counts, pledge amounts, etc.
    const trendingQuery = query(
      pagesRef,
      where("isPublic", "==", true),
      where("deleted", "!=", true),
      orderBy("lastModified", "desc"),
      limit(limitCount)
    );

    const snapshot = await getDocs(trendingQuery);
    const pages = [];

    snapshot.forEach(doc => {
      const pageData = doc.data();
      pages.push({
        id: doc.id,
        title: pageData.title || "Untitled",
        userId: pageData.userId,
        username: pageData.username || "Anonymous",
        lastModified: pageData.lastModified,
        totalPledged: pageData.totalPledged || 0,
        pledgeCount: pageData.pledgeCount || 0
      });
    });

    return pages;
  } catch (error) {
    console.error("Error getting trending pages:", error);
    return [];
  }
};

/**
 * Get random pages for discovery
 */
export const getRandomPages = async (limitCount: number = 10) => {
  try {
    const pagesRef = collection(db, getCollectionName("pages"));
    
    // Get a larger set and then randomly select from it (exclude deleted)
    const randomQuery = query(
      pagesRef,
      where("isPublic", "==", true),
      where("deleted", "!=", true),
      limit(limitCount * 3) // Get 3x more to have better randomization
    );

    const snapshot = await getDocs(randomQuery);
    const allPages = [];

    snapshot.forEach(doc => {
      const pageData = doc.data();
      allPages.push({
        id: doc.id,
        title: pageData.title || "Untitled",
        userId: pageData.userId,
        username: pageData.username || "Anonymous",
        lastModified: pageData.lastModified
      });
    });

    // Shuffle and return the requested number
    const shuffled = allPages.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limitCount);
  } catch (error) {
    console.error("Error getting random pages:", error);
    return [];
  }
};