import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from "firebase/firestore";

import { db } from "./core";

/**
 * Search for users by username or email
 */
export const searchUsers = async (searchQuery: string, limitCount: number = 10) => {
  if (!searchQuery || searchQuery.trim().length < 2) {
    return [];
  }

  try {
    const usersRef = collection(db, "users");
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
        results.set(doc.id, {
          id: doc.id,
          username: userData.username || "Anonymous",
          email: userData.email || "",
          photoURL: userData.photoURL || null
        });
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

            // Client-side filtering for partial matches
            if (username.toLowerCase().includes(searchLower) ||
                email.toLowerCase().includes(searchLower)) {
              results.set(doc.id, {
                id: doc.id,
                username: username || "Anonymous",
                email: email,
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
      const aUsernameExact = a.username.toLowerCase() === searchLower;
      const bUsernameExact = b.username.toLowerCase() === searchLower;
      const aEmailExact = a.email.toLowerCase() === searchLower;
      const bEmailExact = b.email.toLowerCase() === searchLower;

      // Exact matches first
      if (aUsernameExact || aEmailExact) return -1;
      if (bUsernameExact || bEmailExact) return 1;

      // Then by username starts with
      const aUsernameStarts = a.username.toLowerCase().startsWith(searchLower);
      const bUsernameStarts = b.username.toLowerCase().startsWith(searchLower);
      if (aUsernameStarts && !bUsernameStarts) return -1;
      if (bUsernameStarts && !aUsernameStarts) return 1;

      // Finally alphabetical
      return a.username.localeCompare(b.username);
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
    const pagesRef = collection(db, "pages");
    const searchLower = searchQuery.toLowerCase();
    const results = new Map();

    // Search by title (case insensitive)
    try {
      const titleQuery = query(
        pagesRef,
        where("isPublic", "==", true), // Only search public pages for now
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
    const pagesRef = collection(db, "pages");
    
    // For now, just get recent public pages
    // In the future, this could be based on view counts, pledge amounts, etc.
    const trendingQuery = query(
      pagesRef,
      where("isPublic", "==", true),
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
    const pagesRef = collection(db, "pages");
    
    // Get a larger set and then randomly select from it
    const randomQuery = query(
      pagesRef,
      where("isPublic", "==", true),
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
