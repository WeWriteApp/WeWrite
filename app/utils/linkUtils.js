/**
 * Link Utilities
 *
 * This module provides utility functions for creating consistent link structures
 * across the application. It ensures that all links have the necessary properties
 * for proper styling and functionality.
 */

/**
 * Creates a standardized page link structure
 *
 * @param {Object} options - Configuration options for the page link
 * @param {string} options.pageId - ID of the page
 * @param {string} options.pageTitle - Title of the page
 * @param {string} options.url - URL for the link (defaults to /{pageId})
 * @returns {Object} - Standardized page link object for Slate
 */
export const createPageLink = ({
  pageId,
  pageTitle = "Untitled",
  url = null
}) => {
  const title = pageTitle || "Untitled";
  return {
    type: "link",
    url: url || `/pages/${pageId}`,
    pageId,
    pageTitle: title,
    originalPageTitle: title, // CRITICAL FIX: Include originalPageTitle for immediate display
    className: "page-link",
    isPageLink: true,
    children: [{ text: title }]
  };
};

/**
 * Creates a standardized user link structure
 *
 * @param {Object} options - Configuration options for the user link
 * @param {string} options.userId - ID of the user
 * @param {string} options.username - Username to display
 * @param {string} options.url - URL for the link (defaults to /user/{userId})
 * @returns {Object} - Standardized user link object for Slate
 */
export const createUserLink = ({
  userId,
  username = "Missing username",
  url = null
}) => {
  // Ensure we have a valid username to display
  // Never use "Anonymous" - use "Missing username" instead
  let displayUsername = "Missing username";

  if (username &&
      typeof username === 'string' &&
      username.trim() !== "" &&
      username.trim().toLowerCase() !== "anonymous" &&
      username.trim() !== "Missing username") {
    displayUsername = username.trim();
  }

  // Log the username being used
  console.log(`Creating user link with username: ${displayUsername} (original: ${username}), userId: ${userId}`);

  return {
    type: "link",
    url: url || `/user/${userId || "anonymous"}`,
    isUser: true,
    userId: userId || "anonymous",
    username: displayUsername,
    className: "user-link",
    children: [{ text: displayUsername }]
  };
};

/**
 * Creates a standardized reply attribution line
 *
 * @param {Object} options - Configuration options for the reply
 * @param {string} options.pageId - ID of the original page
 * @param {string} options.pageTitle - Title of the original page
 * @param {string} options.userId - ID of the original page author
 * @param {string} options.username - Username of the original page author
 * @returns {Object} - Standardized paragraph with attribution links
 */
export const createReplyAttribution = ({
  pageId,
  pageTitle = "Untitled",
  userId = "anonymous",
  username = "Missing username"
}) => {
  // Ensure we have a valid username - never use "Anonymous" as fallback
  let displayUsername = "Missing username";

  if (username &&
      typeof username === 'string' &&
      username.trim() !== "" &&
      username.trim().toLowerCase() !== "anonymous" &&
      username.trim() !== "Missing username") {
    displayUsername = username.trim();
  }

  console.log(`Creating reply attribution with username: ${displayUsername} (original: ${username})`);

  // Create the user link with explicit username
  const userLink = createUserLink({ userId, username: displayUsername });

  // Create the page link with originalPageTitle for immediate display
  const pageLink = createPageLink({ pageId, pageTitle });

  return {
    type: "paragraph",
    isAttribution: true, // Add a flag to identify this as an attribution paragraph
    attributionType: "reply", // Specify the type of attribution
    children: [
      { text: "Replying to " },
      pageLink,
      { text: " by " },
      userLink
    ]
  };
};
