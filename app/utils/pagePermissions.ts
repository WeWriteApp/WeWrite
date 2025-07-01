/**
 * Page permissions utility functions
 * Handles checking if users can edit pages based on ownership and group membership
 */

// Type definitions
export interface User {
  uid: string;
  groups?: Record<string, any>;
  [key: string]: any;
}

export interface Page {
  userId?: string;
  // Groups functionality removed
  [key: string]: any;
}

export interface Router {
  push: (url: string) => void;
}

/**
 * Check if a user can edit a specific page
 */
export const canUserEditPage = (
  user: User | null,
  page: Page | null,
  userGroups: Record<string, any> | null = null
): boolean => {
  if (!user || !page) {
    return false;
  }

  // Only the page owner can edit
  return page.userId && user.uid === page.userId;
};

/**
 * Generate the appropriate URL for a page based on edit permissions
 */
export const getPageUrl = (
  pageId: string,
  user: User | null,
  page: Page | null = null,
  userGroups: Record<string, any> | null = null
): string => {
  const baseUrl = `/${pageId}`;

  // Always return the base URL without edit=true parameter
  // Pages should load in view mode by default, with click-to-edit functionality
  // handling the transition to edit mode when the user clicks on the content
  return baseUrl;
};

/**
 * Navigate to a page with appropriate edit permissions
 */
export const navigateToPage = (
  pageId: string,
  currentAccount: User | null,
  page: Page | null = null,
  userGroups: Record<string, any> | null = null,
  router: Router | null = null
): void => {
  const url = getPageUrl(pageId, currentAccount, page, userGroups);

  console.log('Navigating to page with permissions:', {
    pageId,
    url,
    canEdit: page ? canUserEditPage(currentAccount, page, userGroups) : 'unknown',
    userId: currentAccount?.uid,
    pageUserId: page?.userId
  });

  // Navigate without scrolling the current page
  // Scroll restoration will be handled by the destination page
  if (router && typeof router.push === 'function') {
    router.push(url);
  } else if (typeof window !== 'undefined') {
    window.location.href = url;
  }
};