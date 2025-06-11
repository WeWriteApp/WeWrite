/**
 * Page permissions utility functions
 * Handles checking if users can edit pages based on ownership and group membership
 */

/**
 * Check if a user can edit a specific page
 * @param {Object} user - The current user object
 * @param {Object} page - The page object to check permissions for
 * @param {Object} userGroups - The user's group memberships (optional)
 * @returns {boolean} - True if user can edit the page
 */
export const canUserEditPage = (user, page, userGroups = null) => {
  if (!user || !page) {
    return false;
  }

  // User is the page owner
  if (page.userId && user.uid === page.userId) {
    return true;
  }

  // Page belongs to a group and user is a member of that group
  if (page.groupId) {
    // Check if user has group memberships
    const groups = userGroups || user.groups;
    if (groups && groups[page.groupId]) {
      return true;
    }
  }

  return false;
};

/**
 * Generate the appropriate URL for a page based on edit permissions
 * @param {string} pageId - The page ID
 * @param {Object} user - The current user object
 * @param {Object} page - The page object (optional, for permission checking)
 * @param {Object} userGroups - The user's group memberships (optional)
 * @returns {string} - The URL to navigate to (always returns base URL for view mode)
 */
export const getPageUrl = (pageId, user, page = null, userGroups = null) => {
  const baseUrl = `/${pageId}`;

  // Always return the base URL without edit=true parameter
  // Pages should load in view mode by default, with click-to-edit functionality
  // handling the transition to edit mode when the user clicks on the content
  return baseUrl;
};

/**
 * Navigate to a page with appropriate edit permissions
 * @param {string} pageId - The page ID
 * @param {Object} user - The current user object
 * @param {Object} page - The page object (optional, for permission checking)
 * @param {Object} userGroups - The user's group memberships (optional)
 * @param {Object} router - Next.js router object (optional)
 */
export const navigateToPage = (pageId, user, page = null, userGroups = null, router = null) => {
  const url = getPageUrl(pageId, user, page, userGroups);

  console.log('Navigating to page with permissions:', {
    pageId,
    url,
    canEdit: page ? canUserEditPage(user, page, userGroups) : 'unknown',
    userId: user?.uid,
    pageUserId: page?.userId,
    pageGroupId: page?.groupId,
    userGroups: userGroups || user?.groups
  });

  // Navigate without scrolling the current page
  // Scroll restoration will be handled by the destination page
  if (router && typeof router.push === 'function') {
    router.push(url);
  } else if (typeof window !== 'undefined') {
    window.location.href = url;
  }
};
