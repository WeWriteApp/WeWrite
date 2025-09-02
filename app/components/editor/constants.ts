/**
 * Constants for link editor components
 * Centralizes magic numbers, strings, and configuration values
 */

// Animation and timing constants
export const ANIMATION_DURATIONS = {
  MODAL_CLOSE_DELAY: 50, // ms - delay before closing modal to ensure Slate operations complete
  FOCUS_DELAY: 100, // ms - delay before focusing inputs to ensure DOM is ready
  DRAG_SNAP_BACK: 200, // ms - drawer snap-back animation duration
  DRAG_CLOSE: 300, // ms - drawer close animation duration
} as const;

// Drag behavior constants
export const DRAG_THRESHOLDS = {
  CLOSE_THRESHOLD: 100, // px - minimum drag distance to close drawer
  RESISTANCE_THRESHOLD: 100, // px - point where drag resistance begins
  RESISTANCE_FACTOR: 0.5, // multiplier for drag resistance beyond threshold
} as const;

// Modal configuration
export const MODAL_CONFIG = {
  MOBILE_BREAKPOINT: 768, // px - viewport width below which mobile UI is used
  DRAWER_HEIGHT: '85vh', // default height for mobile drawer
  DESKTOP_MAX_WIDTH: 'sm:max-w-2xl', // max width for desktop dialog
} as const;

// Link types
export const LINK_TYPES = {
  PAGE: 'page',
  EXTERNAL: 'external',
  COMPOUND: 'compound', // page link with author info
  USER: 'user',
} as const;

// Tab identifiers
export const TABS = {
  PAGES: 'pages',
  EXTERNAL: 'external',
} as const;

// UI text constants
export const UI_TEXT = {
  MODAL_TITLES: {
    CREATE_LINK: 'Insert Link',
    EDIT_LINK: 'Edit Link',
    LINK_SUGGESTION: 'Link Suggestion',
  },
  PLACEHOLDERS: {
    SEARCH_PAGES: 'Search for pages...',
    EXTERNAL_URL: 'https://example.com',
    CUSTOM_TEXT: 'Enter custom display text',
  },
  LABELS: {
    CUSTOM_TEXT: 'Custom link text',
    SHOW_AUTHOR: 'Show author',
    DISPLAY_TEXT: 'Display text',
  },
  BUTTONS: {
    SAVE: 'Save',
    UPDATE_LINK: 'Update Link',
    RESET_DEFAULT: 'Reset to default',
    CREATE_PAGE: 'Create new page',
  },
  MESSAGES: {
    SELECT_PAGE: 'Please select a page',
    ENTER_URL: 'Please enter a URL',
    PRESS_ENTER: 'Press Enter to create link',
    CLICK_TO_LINK: 'Click on a page to create link immediately',
  },
} as const;

// Search configuration
export const SEARCH_CONFIG = {
  MIN_SEARCH_LENGTH: 2, // minimum characters before showing "create new page" button
  DEBOUNCE_DELAY: 500, // ms - search input debounce delay
} as const;
