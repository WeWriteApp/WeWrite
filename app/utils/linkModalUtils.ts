/**
 * Utility functions for determining link modal behavior based on user permissions and context
 */

export interface User {
  uid: string;
  groups?: Record<string, any>;
  [key: string]: any;
}

export interface Page {
  userId?: string;
  groupId?: string;
  [key: string]: any;
}

export type LinkModalType = 'preview' | 'editor';

export interface LinkInteractionContext {
  user: User | null;
  currentPage: Page | null;
  isEditMode: boolean;
  linkType: 'external' | 'page' | 'user' | 'compound';
  linkOwnership: 'own' | 'other' | 'unknown';
  actionType: 'view' | 'edit';
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
 * Determine which modal type to show for link interactions
 */
export const determineLinkModalType = (context: LinkInteractionContext): LinkModalType => {
  const { user, currentPage, isEditMode, linkType, actionType } = context;

  // If user explicitly wants to edit and has permissions, show editor
  if (actionType === 'edit' && user && currentPage) {
    const canEdit = canUserEditPage(user, currentPage);
    if (canEdit && isEditMode) {
      return 'editor';
    }
  }

  // For external links in view mode (or when user can't edit), show preview
  if (linkType === 'external' && (actionType === 'view' || !isEditMode)) {
    return 'preview';
  }

  // For external links when user can edit and is in edit mode, show editor
  if (linkType === 'external' && actionType === 'edit' && isEditMode && user && currentPage) {
    const canEdit = canUserEditPage(user, currentPage);
    if (canEdit) {
      return 'editor';
    }
  }

  // Default to preview for safety
  return 'preview';
};

/**
 * Create link interaction context from current state
 */
export const createLinkInteractionContext = (
  user: User | null,
  currentPage: Page | null,
  isEditMode: boolean,
  linkElement: HTMLElement | null,
  actionType: 'view' | 'edit' = 'view'
): LinkInteractionContext => {
  let linkType: 'external' | 'page' | 'user' | 'compound' = 'external';
  let linkOwnership: 'own' | 'other' | 'unknown' = 'unknown';

  if (linkElement) {
    // Determine link type from element attributes
    const dataLinkType = linkElement.getAttribute('data-link-type');
    const isCompound = linkElement.classList.contains('compound-link');
    
    if (isCompound) {
      linkType = 'compound';
    } else if (dataLinkType === 'page') {
      linkType = 'page';
    } else if (dataLinkType === 'user') {
      linkType = 'user';
    } else if (dataLinkType === 'external') {
      linkType = 'external';
    }

    // For external links, ownership is not really applicable
    // For page/user links, we could check if the current user created the link
    // but this would require additional data tracking
    linkOwnership = 'unknown';
  }

  return {
    user,
    currentPage,
    isEditMode,
    linkType,
    linkOwnership,
    actionType
  };
};

/**
 * Handle link click with appropriate modal behavior
 */
export const handleLinkClick = (
  linkElement: HTMLElement,
  context: LinkInteractionContext,
  callbacks: {
    showPreviewModal: (url: string, displayText?: string) => void;
    showEditorModal: (linkData: any) => void;
    navigateToPage?: (url: string) => void;
  }
) => {
  const modalType = determineLinkModalType(context);
  const { linkType } = context;

  if (linkType === 'external') {
    const url = linkElement.getAttribute('data-url');
    const displayText = linkElement.textContent || undefined;

    if (!url) {
      console.error('External link missing URL');
      return;
    }

    if (modalType === 'preview') {
      callbacks.showPreviewModal(url, displayText);
    } else {
      // For editor modal, we need to prepare link data
      const linkData = {
        element: linkElement,
        type: 'external',
        url,
        text: displayText
      };
      callbacks.showEditorModal(linkData);
    }
  } else if (linkType === 'page' || linkType === 'user' || linkType === 'compound') {
    // For internal links, behavior depends on edit mode and permissions
    if (modalType === 'editor' && context.isEditMode) {
      // Prepare link data for editing
      const linkData = {
        element: linkElement,
        type: linkType,
        text: linkElement.textContent || ''
      };

      if (linkType === 'page' || linkType === 'compound') {
        linkData.pageId = linkElement.getAttribute('data-id') || 
                          linkElement.getAttribute('data-page-id');
      } else if (linkType === 'user') {
        linkData.userId = linkElement.getAttribute('data-id');
      }

      if (linkType === 'compound') {
        linkData.authorUsername = linkElement.getAttribute('data-author');
      }

      callbacks.showEditorModal(linkData);
    } else {
      // Navigate to the page/user
      const href = linkElement.getAttribute('href');
      if (href && callbacks.navigateToPage) {
        callbacks.navigateToPage(href);
      }
    }
  }
};

/**
 * Get link data from element for editing
 */
export const extractLinkDataFromElement = (linkElement: HTMLElement): any => {
  const linkType = linkElement.getAttribute('data-link-type');
  const isCompound = linkElement.classList.contains('compound-link');
  
  const linkData: any = {
    element: linkElement,
    text: linkElement.textContent || ''
  };

  if (isCompound) {
    linkData.type = 'compound';
    linkData.pageId = linkElement.getAttribute('data-page-id');
    linkData.authorUsername = linkElement.getAttribute('data-author');
  } else if (linkType === 'external') {
    linkData.type = 'external';
    linkData.url = linkElement.getAttribute('data-url');
  } else if (linkType === 'page') {
    linkData.type = 'page';
    linkData.pageId = linkElement.getAttribute('data-id');
  } else if (linkType === 'user') {
    linkData.type = 'user';
    linkData.userId = linkElement.getAttribute('data-id');
  }

  return linkData;
};
