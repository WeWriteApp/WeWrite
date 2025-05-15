/**
 * Client-side search utility for fallback when API search is unavailable
 * This provides basic search functionality that works without server calls
 */

// Empty arrays for when database is unavailable
const mockPages = [];
const mockUsers = [];

/**
 * Calculate a match score for a search result
 * @param {string} title - The title of the item
 * @param {string} searchTerm - The search term
 * @returns {number} - A score between 0 and 100, where 100 is a perfect match
 */
export const calculateMatchScore = (title, searchTerm) => {
  if (!title || !searchTerm) return 0;

  const normalizedTitle = title.toLowerCase();
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();

  // Check for exact match (case insensitive)
  if (normalizedTitle === normalizedSearchTerm) {
    return 100;
  }

  // Check if title starts with the search term
  if (normalizedTitle.startsWith(normalizedSearchTerm)) {
    return 90;
  }

  // Check if any word in the title starts with the search term
  const titleWords = normalizedTitle.split(/\s+/);
  for (const word of titleWords) {
    if (word.startsWith(normalizedSearchTerm)) {
      return 85;
    }
  }

  // Check if title contains the search term as a substring
  if (normalizedTitle.includes(normalizedSearchTerm)) {
    return 80;
  }

  // Check if any word in the title contains the search term
  for (const word of titleWords) {
    if (word.includes(normalizedSearchTerm)) {
      return 60;
    }
  }

  return 0;
};

/**
 * Search for pages that match the search term
 * @param {string} searchTerm - The search term to search for
 * @param {string} currentUserId - The ID of the current user
 * @returns {Array} - An array of matching pages
 */
export const searchPagesClientSide = (searchTerm, currentUserId) => {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  const normalizedSearchTerm = searchTerm.toLowerCase().trim();

  // Filter pages that match the search term
  const matchingPages = mockPages.filter(page => {
    // Only include public pages or pages owned by the current user
    if (!page.isPublic && page.userId !== currentUserId) {
      return false;
    }

    const normalizedTitle = page.title.toLowerCase();

    // Check if title contains the search term
    if (normalizedTitle.includes(normalizedSearchTerm)) {
      return true;
    }

    // Check if any word in the title starts with the search term
    const titleWords = normalizedTitle.split(/\s+/);
    return titleWords.some(word => word.startsWith(normalizedSearchTerm));
  });

  // Calculate match scores and add them to the results
  const scoredPages = matchingPages.map(page => {
    const score = calculateMatchScore(page.title, searchTerm);
    return {
      ...page,
      matchScore: score,
      isOwned: page.userId === currentUserId,
      isEditable: page.userId === currentUserId,
      type: page.userId === currentUserId ? 'user' : 'public'
    };
  });

  // Sort by match score (highest first)
  return scoredPages.sort((a, b) => b.matchScore - a.matchScore);
};

/**
 * Search for users that match the search term
 * @param {string} searchTerm - The search term to search for
 * @returns {Array} - An array of matching users
 */
export const searchUsersClientSide = (searchTerm) => {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  const normalizedSearchTerm = searchTerm.toLowerCase().trim();

  // Filter users that match the search term
  const matchingUsers = mockUsers.filter(user => {
    const normalizedUsername = user.username.toLowerCase();
    return normalizedUsername.includes(normalizedSearchTerm);
  });

  // Calculate match scores and add them to the results
  const scoredUsers = matchingUsers.map(user => {
    const score = calculateMatchScore(user.username, searchTerm);
    return {
      ...user,
      matchScore: score,
      type: 'user'
    };
  });

  // Sort by match score (highest first)
  return scoredUsers.sort((a, b) => b.matchScore - a.matchScore);
};

/**
 * Perform a client-side search for both pages and users
 * @param {string} searchTerm - The search term to search for
 * @param {string} currentUserId - The ID of the current user
 * @returns {Object} - An object containing matching pages and users
 */
export const performClientSideSearch = (searchTerm, currentUserId) => {
  const pages = searchPagesClientSide(searchTerm, currentUserId);
  const users = searchUsersClientSide(searchTerm);

  return {
    pages,
    users
  };
};
