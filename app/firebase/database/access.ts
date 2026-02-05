import type { PageAccessResult, PageData } from "./core";

/**
 * Utility function to check if a user has access to a page
 */
export const checkPageAccess = async (pageData: PageData | null, userId: string | null): Promise<PageAccessResult> => {
  console.log('🔍 checkPageAccess called:', {
    pageExists: !!pageData,
    pageId: pageData?.id,
    userId: userId || 'anonymous',
    isDeleted: pageData?.deleted
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

  // Private group pages: check group membership
  if (pageData.visibility === 'private' && pageData.groupId) {
    if (!userId) {
      console.log('🔍 checkPageAccess: Private group page, anonymous user denied');
      return {
        hasAccess: false,
        error: "Page not found"
      };
    }

    // Check group membership via the group's memberIds array
    try {
      const { getGroupById } = await import('./groups');
      const group = await getGroupById(pageData.groupId);
      if (group && group.memberIds.includes(userId)) {
        console.log('🔍 checkPageAccess: Group member accessing private page');
        return {
          hasAccess: true,
          reason: "group_member"
        };
      }
    } catch (error) {
      console.error('🔍 checkPageAccess: Error checking group membership:', error);
    }

    console.log('🔍 checkPageAccess: Non-member denied access to private group page');
    return {
      hasAccess: false,
      error: "Page not found"
    };
  }

  // All other pages are public by default
  console.log('🔍 checkPageAccess: Page access granted');
  return {
    hasAccess: true,
    reason: "page"
  };
};

/**
 * Check if a user can edit a specific page
 */
export const canUserEditPage = async (pageData: PageData | null, userId: string | null): Promise<boolean> => {
  if (!pageData || !userId) {
    return false;
  }

  // Page owner can always edit
  if (pageData.userId === userId) {
    return true;
  }

  // Group members can edit group pages
  if (pageData.groupId) {
    try {
      const { isGroupMember } = await import('./groups');
      return await isGroupMember(pageData.groupId, userId);
    } catch {
      return false;
    }
  }

  return false;
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
