/**
 * Utility functions for validating content before display
 */

/**
 * Checks if a content item has valid username data
 * 
 * @param {Object} contentItem - The content item to check (page, activity, etc.)
 * @param {boolean} logMissingData - Whether to log missing data for debugging
 * @returns {boolean} - Whether the content item has valid username data
 */
export const hasValidUsernameData = (contentItem, logMissingData = true) => {
  if (!contentItem) return false;
  
  // Check if the content item has a userId but missing username
  const hasMissingUsername = contentItem.userId && 
    (!contentItem.username || 
     contentItem.username === 'undefined' || 
     contentItem.username === 'null' || 
     contentItem.username === 'Missing username');
  
  // Log missing data for debugging if enabled
  if (hasMissingUsername && logMissingData) {
    console.warn(`Content item with missing username data:`, {
      id: contentItem.id || contentItem.pageId,
      userId: contentItem.userId,
      username: contentItem.username,
      type: contentItem.pageName ? 'activity' : 'page'
    });
  }
  
  // Return true if the content has a userId and a valid username, or if it's anonymous content (no userId)
  return !hasMissingUsername;
};

/**
 * Filters an array of content items to remove those with missing username data
 * 
 * @param {Array} contentItems - Array of content items to filter
 * @param {boolean} logMissingData - Whether to log missing data for debugging
 * @returns {Array} - Filtered array of content items
 */
export const filterContentWithValidUsernames = (contentItems, logMissingData = true) => {
  if (!contentItems || !Array.isArray(contentItems)) return [];
  
  const filteredItems = contentItems.filter(item => hasValidUsernameData(item, logMissingData));
  
  // Log how many items were filtered out
  if (logMissingData && filteredItems.length < contentItems.length) {
    console.warn(`Filtered out ${contentItems.length - filteredItems.length} content items with missing username data`);
  }
  
  return filteredItems;
};
