"use client";

import { db } from './database';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter
} from 'firebase/firestore';
import { calculateMatchScore, sortSearchResultsByScore } from '../utils/searchUtils';

/**
 * Search for pages that match the search term
 *
 * @param {string} searchTerm - The search term to search for
 * @param {string} userId - The ID of the current user
 * @param {number} limitCount - The maximum number of results to return
 * @param {number} minLength - Minimum length of search term required (default: 0)
 * @returns {Promise<Array>} - A promise that resolves to an array of matching pages
 */
export const searchPages = async (searchTerm, userId, limitCount = 10, minLength = 0) => {
  if (!searchTerm || searchTerm.trim().length < minLength) {
    return [];
  }

  try {
    // Format search term for case-insensitive search
    const searchTermLower = searchTerm.toLowerCase().trim();

    // Query for user's own pages
    const userPagesQuery = query(
      collection(db, "pages"),
      where("userId", "==", userId),
      orderBy("lastModified", "desc"),
      limit(limitCount)
    );

    // Query for public pages
    const publicPagesQuery = query(
      collection(db, "pages"),
      where("isPublic", "==", true),
      orderBy("lastModified", "desc"),
      limit(limitCount)
    );

    // Execute both queries
    const [userPagesSnapshot, publicPagesSnapshot] = await Promise.all([
      getDocs(userPagesQuery),
      getDocs(publicPagesQuery)
    ]);

    // Process user's own pages
    const userPages = [];
    userPagesSnapshot.forEach(doc => {
      const data = doc.data();
      const title = data.title || 'Untitled';

      // Only include if title matches search term
      if (title.toLowerCase().includes(searchTermLower)) {
        userPages.push({
          id: doc.id,
          title: title,
          userId: data.userId,
          username: data.username || 'Missing username',
          lastModified: data.lastModified?.toDate?.() || new Date(),
          isPublic: !!data.isPublic,
          isOwned: true,
          matchScore: calculateMatchScore(title, searchTerm)
        });
      }
    });

    // Process public pages
    const publicPages = [];
    publicPagesSnapshot.forEach(doc => {
      const data = doc.data();
      const title = data.title || 'Untitled';

      // Only include if title matches search term and it's not the user's own page
      if (data.userId !== userId && title.toLowerCase().includes(searchTermLower)) {
        publicPages.push({
          id: doc.id,
          title: title,
          userId: data.userId,
          username: data.username || 'Missing username',
          lastModified: data.lastModified?.toDate?.() || new Date(),
          isPublic: true,
          isOwned: false,
          matchScore: calculateMatchScore(title, searchTerm)
        });
      }
    });

    // Combine and sort results
    const combinedResults = [...userPages, ...publicPages];

    // Sort by match score (highest first)
    combinedResults.sort((a, b) => b.matchScore - a.matchScore);

    // Return the top results
    return combinedResults.slice(0, limitCount);
  } catch (error) {
    console.error("Error searching pages:", error);
    return [];
  }
};

/**
 * Search for users that match the search term
 *
 * @param {string} searchTerm - The search term to search for
 * @param {number} limitCount - The maximum number of results to return
 * @param {number} minLength - Minimum length of search term required (default: 2)
 * @returns {Promise<Array>} - A promise that resolves to an array of matching users
 */
export const searchUsers = async (searchTerm, limitCount = 10, minLength = 2) => {
  if (!searchTerm || searchTerm.trim().length < minLength) {
    return [];
  }

  try {
    const usersRef = collection(db, "users");

    // Search by username (case insensitive)
    const usernameQuery = query(
      usersRef,
      where("usernameLower", ">=", searchTerm.toLowerCase()),
      where("usernameLower", "<=", searchTerm.toLowerCase() + "\uf8ff"),
      limit(limitCount)
    );

    // Search by email (case insensitive)
    const emailQuery = query(
      usersRef,
      where("email", ">=", searchTerm.toLowerCase()),
      where("email", "<=", searchTerm.toLowerCase() + "\uf8ff"),
      limit(limitCount)
    );

    // Execute both queries
    const [usernameResults, emailResults] = await Promise.all([
      getDocs(usernameQuery),
      getDocs(emailQuery)
    ]);

    // Combine and deduplicate results
    const results = new Map();

    usernameResults.forEach(doc => {
      const userData = doc.data();
      results.set(doc.id, {
        id: doc.id,
        username: userData.username || "Missing username",
        email: userData.email || "",
        photoURL: userData.photoURL || null,
        matchScore: calculateMatchScore(userData.username || "", searchTerm)
      });
    });

    emailResults.forEach(doc => {
      if (!results.has(doc.id)) {
        const userData = doc.data();
        results.set(doc.id, {
          id: doc.id,
          username: userData.username || "Missing username",
          email: userData.email || "",
          photoURL: userData.photoURL || null,
          matchScore: calculateMatchScore(userData.email || "", searchTerm)
        });
      }
    });

    // Convert to array and sort by match score
    const sortedResults = Array.from(results.values())
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limitCount);

    return sortedResults;
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};
