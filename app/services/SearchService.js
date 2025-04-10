/**
 * Centralized Search Service
 * 
 * This service provides standardized search functionality across the application.
 * It handles searching for pages, users, and groups with consistent behavior.
 */

// Debounce function to limit API calls
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

/**
 * Search for pages and users
 * 
 * @param {string} searchTerm - The search term
 * @param {object} options - Search options
 * @param {string} options.userId - The current user's ID
 * @param {array} options.groupIds - Array of group IDs the user belongs to
 * @param {boolean} options.includeUsers - Whether to include users in search results
 * @param {boolean} options.includePages - Whether to include pages in search results
 * @param {boolean} options.editableOnly - Whether to only include pages the user can edit
 * @param {function} options.onResults - Callback function for search results
 * @param {function} options.onError - Callback function for errors
 * @param {function} options.onLoading - Callback function for loading state
 */
export const search = debounce(async (searchTerm, options = {}) => {
  const {
    userId,
    groupIds = [],
    includeUsers = true,
    includePages = true,
    editableOnly = false,
    onResults,
    onError,
    onLoading
  } = options;

  // Validate inputs
  if (!searchTerm?.trim()) {
    if (onResults) onResults({
      userPages: [],
      groupPages: [],
      publicPages: [],
      users: []
    });
    return;
  }

  if (!userId) {
    if (onError) onError(new Error("User ID is required for search"));
    return;
  }

  try {
    if (onLoading) onLoading(true);

    // Prepare API requests
    const requests = [];
    
    // Pages search
    if (includePages) {
      const groupIdsParam = groupIds.join(',');
      const pagesUrl = `/api/search?userId=${userId}&searchTerm=${encodeURIComponent(searchTerm)}&groupIds=${groupIdsParam}`;
      requests.push(fetch(pagesUrl));
    } else {
      requests.push(Promise.resolve({ json: () => ({ pages: [] }) }));
    }
    
    // Users search
    if (includeUsers) {
      const usersUrl = `/api/search-users?searchTerm=${encodeURIComponent(searchTerm)}`;
      requests.push(fetch(usersUrl));
    } else {
      requests.push(Promise.resolve({ json: () => ({ users: [] }) }));
    }

    // Use Promise.allSettled to handle partial failures
    const [pagesResponse, usersResponse] = await Promise.allSettled(requests);
    
    // Process pages results
    let userPages = [];
    let groupPages = [];
    let publicPages = [];
    
    if (pagesResponse.status === 'fulfilled') {
      const pagesResult = await pagesResponse.value.json();
      
      // Prioritize exact matches by moving them to the top
      const exactMatchFilter = (page) => {
        const title = page.title.toLowerCase();
        const term = searchTerm.toLowerCase().trim();
        return title === term;
      };
      
      const sortByExactMatch = (pages) => {
        const exactMatches = pages.filter(exactMatchFilter);
        const otherMatches = pages.filter(page => !exactMatchFilter(page));
        return [...exactMatches, ...otherMatches];
      };
      
      // Apply exact match prioritization to each category
      userPages = sortByExactMatch(pagesResult.userPages || []);
      groupPages = sortByExactMatch(pagesResult.groupPages || []);
      publicPages = sortByExactMatch(pagesResult.publicPages || []);
      
      // Filter for editable pages if needed
      if (editableOnly) {
        publicPages = publicPages.filter(page => page.isOwned || page.isEditable);
      }
    }
    
    // Process users results
    let users = [];
    
    if (usersResponse.status === 'fulfilled') {
      const usersResult = await usersResponse.value.json();
      
      // Prioritize exact matches for users too
      const exactMatchFilter = (user) => {
        const username = user.username?.toLowerCase() || '';
        const name = user.name?.toLowerCase() || '';
        const term = searchTerm.toLowerCase().trim();
        return username === term || name === term;
      };
      
      const exactMatches = (usersResult.users || []).filter(exactMatchFilter);
      const otherMatches = (usersResult.users || []).filter(user => !exactMatchFilter(user));
      users = [...exactMatches, ...otherMatches];
    }
    
    // Combine results
    const results = {
      userPages,
      groupPages,
      publicPages,
      users
    };
    
    // Call the results callback
    if (onResults) onResults(results);
    
  } catch (error) {
    console.error("Error performing search:", error);
    if (onError) onError(error);
  } finally {
    if (onLoading) onLoading(false);
  }
}, 300);

/**
 * Format search results for display
 * 
 * @param {object} results - The search results
 * @param {string} searchTerm - The search term
 * @returns {array} - Formatted search results
 */
export const formatSearchResults = (results, searchTerm) => {
  const { userPages = [], groupPages = [], publicPages = [], users = [] } = results;
  
  // Format users for display
  const formattedUsers = users.map(user => ({
    id: user.id,
    name: user.username || user.name || 'Anonymous',
    type: 'user',
    highlight: searchTerm
  }));
  
  // Format pages for display
  const formatPage = (page, category) => ({
    id: page.id,
    name: page.title || 'Untitled',
    username: page.username || page.ownerName || 'Anonymous',
    category,
    isOwned: page.isOwned,
    isEditable: page.isEditable,
    highlight: searchTerm
  });
  
  const formattedUserPages = userPages.map(page => formatPage(page, 'Your Pages'));
  const formattedGroupPages = groupPages.map(page => formatPage(page, 'Group Pages'));
  const formattedPublicPages = publicPages.map(page => formatPage(page, 'Public Pages'));
  
  // Combine all results
  return [
    ...formattedUsers,
    ...formattedUserPages,
    ...formattedGroupPages,
    ...formattedPublicPages
  ];
};

export default {
  search,
  formatSearchResults
};
