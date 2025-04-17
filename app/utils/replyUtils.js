/**
 * Utility functions for handling reply functionality in WeWrite
 *
 * This module centralizes the reply logic to:
 * 1. Make the codebase more robust
 * 2. Ensure consistent behavior across the application
 * 3. Support extensibility for future reply types (agree/disagree/etc.)
 */

/**
 * Generates a reply title based on the original page title
 *
 * @param {string} originalTitle - The title of the original page
 * @returns {string} - Formatted reply title
 */
export const generateReplyTitle = (originalTitle) => {
  // Return empty string to allow user to set their own title
  return "";
};

/**
 * Creates standardized initial content for a reply
 *
 * @param {Object} options - Configuration options for the reply
 * @param {string} options.pageId - ID of the original page
 * @param {string} options.pageTitle - Title of the original page
 * @param {string} options.userId - ID of the original page author
 * @param {string} options.username - Username of the original page author
 * @param {string} options.replyType - Type of reply (default: "standard")
 * @returns {Array} - Slate editor nodes for the initial content
 */
export const createReplyContent = ({
  pageId,
  pageTitle = "Untitled",
  userId = "anonymous",
  username = "Anonymous",
  replyType = "standard"
}) => {
  // This structure allows for future reply types (agree/disagree/etc.)
  switch (replyType) {
    case "standard":
    default:
      // Ensure we have a valid username to display
      const displayUsername = username && username !== "Anonymous" ? username : "Anonymous";

      // Log the username being used
      console.log(`Creating reply content with username: ${displayUsername} (original: ${username}), userId: ${userId}`);

      return [
        {
          type: "paragraph",
          children: [
            { text: `Replying to ` },
            {
              type: "link",
              url: `/${pageId}`,
              pageId: pageId,
              pageTitle: pageTitle || "Untitled",
              className: "page-link",
              children: [{ text: pageTitle || "Untitled" }]
            },
            { text: ` by ` },
            {
              type: "link",
              url: `/u/${userId || "anonymous"}`,
              isUser: true,
              userId: userId || "anonymous",
              username: displayUsername,
              className: "user-link",
              children: [{ text: displayUsername }]
            }
          ]
        }
      ];
  }
};

/**
 * Encodes reply data for URL parameters
 *
 * @param {Object} replyData - Data needed for the reply
 * @param {string} replyData.title - Reply title
 * @param {Array} replyData.content - Reply content in Slate format
 * @param {string} replyData.username - Username of person replying
 * @returns {Object} - Encoded parameters ready for URL
 */
export const encodeReplyParams = ({
  title,
  content,
  username
}) => {
  try {
    return {
      title: encodeURIComponent(title),
      content: encodeURIComponent(JSON.stringify(content)),
      username: encodeURIComponent(username)
    };
  } catch (error) {
    console.error("Error encoding reply parameters:", error);
    throw error;
  }
};
