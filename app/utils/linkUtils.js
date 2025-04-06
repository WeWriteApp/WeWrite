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
  return {
    type: "link",
    url: url || `/${pageId}`,
    pageId,
    pageTitle: pageTitle || "Untitled",
    className: "page-link",
    children: [{ text: pageTitle || "Untitled" }]
  };
};

/**
 * Creates a standardized user link structure
 *
 * @param {Object} options - Configuration options for the user link
 * @param {string} options.userId - ID of the user
 * @param {string} options.username - Username to display
 * @param {string} options.url - URL for the link (defaults to /u/{userId})
 * @returns {Object} - Standardized user link object for Slate
 */
export const createUserLink = ({
  userId,
  username = "Anonymous",
  url = null
}) => {
  // Ensure we have a valid username to display
  const displayUsername = username && username !== "Anonymous" ? username : "Anonymous";

  // Log the username being used
  console.log(`Creating user link with username: ${displayUsername} (original: ${username}), userId: ${userId}`);

  return {
    type: "link",
    url: url || `/u/${userId || "anonymous"}`,
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
  username = "Anonymous"
}) => {
  // Log the username being used in the attribution
  console.log(`Creating reply attribution with username: ${username}, userId: ${userId}`);

  // Create the user link with explicit username
  const userLink = createUserLink({ userId, username });

  // Log the created user link to verify structure
  console.log('Created user link for attribution:', JSON.stringify(userLink, null, 2));

  return {
    type: "paragraph",
    children: [
      { text: "Replying to " },
      createPageLink({ pageId, pageTitle }),
      { text: " by " },
      userLink
    ]
  };
};
