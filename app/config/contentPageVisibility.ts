/**
 * Content Page Visibility Configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for what elements are visible
 * on ContentPageView based on page state.
 *
 * To change visibility rules:
 * 1. Update this config
 * 2. The design system table will automatically reflect changes
 * 3. ContentPageView imports and uses these rules
 *
 * Page States:
 * - myPageSaved: Viewing/editing my own saved page
 * - myPageNew: Creating a new page (not yet saved)
 * - otherPage: Viewing someone else's page
 */

export type PageState = 'myPageSaved' | 'myPageNew' | 'otherPage';

export interface VisibilityRule {
  id: string;
  label: string;
  description: string;
  componentPath?: string;
  visibility: Record<PageState, boolean | 'conditional'>;
  condition?: string; // Description of condition when visibility is 'conditional'
}

/**
 * Content Page Element Visibility Rules
 *
 * true = always visible in this state
 * false = never visible in this state
 * 'conditional' = visible based on additional conditions (see `condition` field)
 */
export const CONTENT_PAGE_VISIBILITY: VisibilityRule[] = [
  // Header Elements
  {
    id: 'contentPageHeader',
    label: 'Page Header',
    description: 'Title and author info',
    componentPath: 'app/components/pages/ContentPageHeader.tsx',
    visibility: {
      myPageSaved: true,
      myPageNew: true,
      otherPage: true,
    },
  },
  {
    id: 'titleEditable',
    label: 'Editable Title',
    description: 'Title input field vs read-only text',
    visibility: {
      myPageSaved: true,
      myPageNew: true,
      otherPage: false,
    },
  },
  {
    id: 'backButton',
    label: 'Back Button',
    description: 'Back arrow in header for new page mode',
    visibility: {
      myPageSaved: false,
      myPageNew: true,
      otherPage: false,
    },
  },

  // Save/Edit Controls
  {
    id: 'stickySaveHeader',
    label: 'Sticky Save Header',
    description: 'Save/Cancel bar when manual save mode',
    componentPath: 'app/components/layout/StickySaveHeader.tsx',
    visibility: {
      myPageSaved: 'conditional',
      myPageNew: 'conditional',
      otherPage: false,
    },
    condition: 'Only when auto-save is disabled AND hasUnsavedChanges',
  },
  {
    id: 'autoSaveIndicator',
    label: 'Auto-Save Indicator',
    description: 'Shows save status when auto-save enabled',
    componentPath: 'app/components/layout/AutoSaveIndicator.tsx',
    visibility: {
      myPageSaved: 'conditional',
      myPageNew: 'conditional',
      otherPage: false,
    },
    condition: 'Only when auto_save feature flag is enabled',
  },

  // Content Area
  {
    id: 'contentDisplay',
    label: 'Content Display',
    description: 'Main content editor/viewer',
    componentPath: 'app/components/content/ContentDisplay.tsx',
    visibility: {
      myPageSaved: true,
      myPageNew: true,
      otherPage: true,
    },
  },
  {
    id: 'contentEditable',
    label: 'Content Editable',
    description: 'Content is editable vs read-only',
    visibility: {
      myPageSaved: true,
      myPageNew: true,
      otherPage: false,
    },
  },
  {
    id: 'denseModeToggle',
    label: 'Dense Mode Toggle',
    description: 'Toggle for compact text display',
    componentPath: 'app/components/viewer/DenseModeToggle.tsx',
    visibility: {
      myPageSaved: false,
      myPageNew: false,
      otherPage: true,
    },
  },
  {
    id: 'writingIdeasBanner',
    label: 'Writing Ideas Banner',
    description: 'Topic suggestions for new pages',
    componentPath: 'app/components/writing/WritingIdeasBanner.tsx',
    visibility: {
      myPageSaved: false,
      myPageNew: 'conditional',
      otherPage: false,
    },
    condition: 'Only for new pages that are NOT replies',
  },

  // Footer/Actions
  {
    id: 'contentPageFooter',
    label: 'Page Footer',
    description: 'Actions and metadata fields',
    componentPath: 'app/components/pages/ContentPageFooter.tsx',
    visibility: {
      myPageSaved: true,
      myPageNew: true,
      otherPage: true,
    },
  },
  {
    id: 'locationField',
    label: 'Location Field',
    description: 'Add/view location attachment',
    componentPath: 'app/components/pages/LocationField.tsx',
    visibility: {
      myPageSaved: true,
      myPageNew: true,
      otherPage: 'conditional',
    },
    condition: 'Only visible if page has a location set',
  },
  {
    id: 'customDateField',
    label: 'Custom Date Field',
    description: 'Set/view custom date',
    visibility: {
      myPageSaved: true,
      myPageNew: true,
      otherPage: 'conditional',
    },
    condition: 'Only visible if page has a custom date set',
  },

  // Page Connections Section
  {
    id: 'pageGraphView',
    label: 'Page Graph View',
    description: 'Interactive network visualization',
    componentPath: 'app/components/pages/PageGraphView.tsx',
    visibility: {
      myPageSaved: true,
      myPageNew: false,
      otherPage: true,
    },
  },
  {
    id: 'whatLinksHere',
    label: 'What Links Here',
    description: 'Pages that link to this page',
    componentPath: 'app/components/pages/WhatLinksHere.tsx',
    visibility: {
      myPageSaved: 'conditional',
      myPageNew: false,
      otherPage: 'conditional',
    },
    condition: 'Only if there are backlinks (hides when empty)',
  },
  {
    id: 'replyToCard',
    label: 'Reply To Card',
    description: 'Shows parent page if this is a reply',
    visibility: {
      myPageSaved: 'conditional',
      myPageNew: false,
      otherPage: 'conditional',
    },
    condition: 'Only if page.replyTo exists',
  },
  {
    id: 'repliesSection',
    label: 'Replies Section',
    description: 'Shows all replies to this page',
    componentPath: 'app/components/features/RepliesSection.tsx',
    visibility: {
      myPageSaved: 'conditional',
      myPageNew: false,
      otherPage: true,
    },
    condition: 'On own pages: only visible if hasReplies (hides empty state). On others pages: always visible (shows CTA to create reply)',
  },
  {
    id: 'relatedPagesSection',
    label: 'Related Pages Section',
    description: 'Pages by same author or linked',
    componentPath: 'app/components/features/RelatedPagesSection.tsx',
    visibility: {
      myPageSaved: true,
      myPageNew: false,
      otherPage: true,
    },
  },

  // Bottom Actions
  {
    id: 'addToPageButton',
    label: 'Add to Page Button',
    description: 'Add this page to another page',
    componentPath: 'app/components/utils/AddToPageButton.tsx',
    visibility: {
      myPageSaved: true,
      myPageNew: false,
      otherPage: true,
    },
  },
  {
    id: 'deleteButton',
    label: 'Delete Button',
    description: 'Delete this page',
    visibility: {
      myPageSaved: true,
      myPageNew: false,
      otherPage: false,
    },
  },
  {
    id: 'cancelButton',
    label: 'Cancel Button',
    description: 'Cancel creating new page',
    visibility: {
      myPageSaved: false,
      myPageNew: true,
      otherPage: false,
    },
  },

  // Floating Elements
  {
    id: 'allocationBar',
    label: 'Allocation Bar',
    description: 'Support/pledge bar at bottom',
    componentPath: 'app/components/payments/AllocationBar.tsx',
    visibility: {
      myPageSaved: false,
      myPageNew: false,
      otherPage: true,
    },
  },
  {
    id: 'emptyLinesAlert',
    label: 'Empty Lines Alert',
    description: 'Warning about empty lines in content',
    componentPath: 'app/components/editor/EmptyLinesAlert.tsx',
    visibility: {
      myPageSaved: 'conditional',
      myPageNew: 'conditional',
      otherPage: false,
    },
    condition: 'Only when editing and emptyLinesCount > 0',
  },

  // Banners
  {
    id: 'deletedPageBanner',
    label: 'Deleted Page Banner',
    description: 'Shows when previewing deleted page',
    componentPath: 'app/components/utils/DeletedPageBanner.tsx',
    visibility: {
      myPageSaved: 'conditional',
      myPageNew: false,
      otherPage: 'conditional',
    },
    condition: 'Only when ?preview=deleted query param',
  },
];

/**
 * Helper function to check if an element should be visible
 */
export function isElementVisible(
  elementId: string,
  pageState: PageState,
  additionalConditions?: Record<string, boolean>
): boolean {
  const rule = CONTENT_PAGE_VISIBILITY.find(r => r.id === elementId);
  if (!rule) return false;

  const visibility = rule.visibility[pageState];

  if (visibility === true) return true;
  if (visibility === false) return false;

  // For conditional visibility, check additional conditions if provided
  if (visibility === 'conditional' && additionalConditions) {
    return additionalConditions[elementId] ?? false;
  }

  // Default to false for conditional without conditions
  return false;
}

/**
 * Get the current page state based on context
 */
export function getPageState(
  isOwner: boolean,
  isNewPage: boolean
): PageState {
  if (!isOwner) return 'otherPage';
  if (isNewPage) return 'myPageNew';
  return 'myPageSaved';
}

/**
 * Column headers for the visibility table
 */
export const PAGE_STATE_LABELS: Record<PageState, string> = {
  myPageSaved: 'My Page (Saved)',
  myPageNew: 'New Page',
  otherPage: "Others' Pages",
};
