"use client";

/**
 * Reply Manager
 *
 * This module centralizes all reply-related functionality to ensure consistent behavior
 * across the application and make future maintenance easier.
 */

import { createReplyAttribution } from './linkUtils';
import { getUsernameById } from './userUtils';
import type { Page } from '../types/database';

/**
 * Page data type for reply operations - uses centralized Page type
 */
type PageData = Pick<Page, 'id' | 'title' | 'userId'> & { username?: string };

interface VersionData {
  content: string;
  createdAt: string;
  userId: string;
}

interface ReplyContentResult {
  replyContent: any[];
  originalPage: PageData;
  originalVersion: VersionData;
}

/**
 * Fetches the original page and creates the reply content with proper attribution
 */
export const prepareReplyContent = async (pageId: string): Promise<ReplyContentResult> => {
  if (!pageId) {
    throw new Error("No page ID provided for reply");
  }

  try {
    // Import the database module to get page details
    const { getPageById } = await import('../firebase/database');
    const { pageData, versionData } = await getPageById(pageId);

    if (!pageData) {
      throw new Error("Could not find the original page");
    }

    // Get username from the page or user record
    const displayUsername = await fetchUsernameForPage(pageData);

    // Create reply content with attribution
    const replyContent = [
      createReplyAttribution({
        pageId: pageData.id,
        pageTitle: pageData.title,
        userId: pageData.userId,
        username: displayUsername
      })
    ];

    return {
      replyContent,
      originalPage: pageData,
      originalVersion: versionData
    };
  } catch (error) {
    console.error("Error preparing reply content:", error);
    throw error;
  }
};

/**
 * Fetches the username for a page using the centralized getUsernameById utility
 * This function now delegates to the authoritative implementation in userUtils.js
 */
export const fetchUsernameForPage = async (pageData: PageData): Promise<string> => {
  if (!pageData) return "Missing username";

  // First check if the page object already has a valid username
  if (pageData.username &&
      pageData.username !== "Anonymous" &&
      pageData.username !== "Missing username" &&
      pageData.username.trim() !== "") {
    console.log("Using username from page object:", pageData.username);
    return pageData.username.trim();
  }

  // If no valid username on page, fetch it using the centralized utility
  if (pageData.userId) {
    try {
      const fetchedUsername = await getUsernameById(pageData.userId);
      console.log("Fetched username from centralized utility:", fetchedUsername);
      return fetchedUsername;
    } catch (error) {
      console.error("Error fetching username for page:", error);
      return "Missing username";
    }
  }

  return "Missing username";
};

/**
 * Validates and protects the reply content to ensure the attribution line is preserved
 */
export const validateReplyContent = (originalContent: any[], newContent: any[]): any[] => {
  if (!originalContent || !newContent) return newContent;

  if (originalContent.length > 0 && newContent.length > 0) {
    // Always preserve the attribution line (first paragraph)
    if (JSON.stringify(newContent[0]) !== JSON.stringify(originalContent[0])) {
      console.log('Protecting attribution line from changes');
      newContent[0] = originalContent[0];
    }
  }

  return newContent;
};