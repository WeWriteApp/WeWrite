import type { PageAccessResult, PageData } from "./core";

/**
 * Utility function to check if a user has access to a page
 */
export const checkPageAccess = async (pageData: PageData | null, userId: string | null): Promise<PageAccessResult> => {
  console.log('🔍 checkPageAccess called:', {
    pageExists: !!pageData,
    pageId: pageData?.id,
    userId: userId || 'anonymous',
    isDeleted: pageData?.deleted,
    isPublic: pageData?.isPublic
  });

  // If page doesn't exist, no one has access
  if (!pageData) {
    console.log('🔍 checkPageAccess: Page not found');
    return {
      hasAccess: false,
      error: "Page not found"
    };
  }

  // CRITICAL: Check if page is soft-deleted
  // Only page owners can access their own deleted pages through the "Recently Deleted Pages" section
  if (pageData.deleted === true) {
    console.log('🔍 checkPageAccess: Page is deleted');
    // Allow page owners to access their deleted pages only in specific contexts
    if (userId && pageData.userId === userId) {
      // This will be handled by the calling code to determine if it's in the right context
      // For now, we'll allow access but the calling code should check the context
      console.log('🔍 checkPageAccess: Owner accessing deleted page');
      return {
        hasAccess: true,
        reason: "owner accessing deleted page",
        isDeleted: true
      };
    }

    // For all other users, deleted pages are not accessible
    console.log('🔍 checkPageAccess: Deleted page access denied');
    return {
      hasAccess: false,
      error: "Page not found"
    };
  }

  // Private pages are accessible to their owners regardless of other settings
  if (userId && pageData.userId === userId) {
    console.log('🔍 checkPageAccess: Owner accessing own page');
    return {
      hasAccess: true,
      reason: "owner"
    };
  }

  // All pages are now public by default - simplified access model
  console.log('🔍 checkPageAccess: Public page access granted');
  return {
    hasAccess: true,
    reason: "public page"
  };
};

/**
 * Check if a user can edit a specific page
 */
export const canUserEditPage = async (pageData: PageData | null, userId: string | null): Promise<boolean> => {
  if (!pageData || !userId) {
    return false;
  }

  // Only page owner can edit
  return pageData.userId === userId;
};

/**
 * Check if a user can delete a specific page
 */
export const canUserDeletePage = async (pageData: PageData | null, userId: string | null): Promise<boolean> => {
  if (!pageData || !userId) {
    return false;
  }

  // Only page owner can delete
  return pageData.userId === userId;
};