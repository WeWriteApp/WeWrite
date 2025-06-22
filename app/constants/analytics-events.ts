/**
 * Analytics Events Constants
 *
 * This file centralizes all analytics events used throughout the WeWrite application.
 * Using these constants ensures consistency in event naming across the application
 * and makes it easier to track what events are being monitored.
 */

// Page View Events
export const PAGE_EVENTS = {
  PAGE_VIEW: 'page_view',
};

// User Authentication Events
export const AUTH_EVENTS = {
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  USER_CREATED: 'user_created',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_RESET_REQUEST: 'password_reset_request',
};

// Content Creation Events
export const CONTENT_EVENTS = {
  PAGE_CREATED: 'page_created',
  PAGE_EDITED: 'page_edited',
  PAGE_DELETED: 'page_deleted',
  PAGE_EDIT_STARTED: 'page_edit_started',
  PAGE_EDIT_CANCELLED: 'page_edit_cancelled',
  PAGE_SAVE_KEYBOARD: 'page_save_keyboard',
  PAGE_SAVE_BUTTON: 'page_save_button',
  PAGE_CREATION_STARTED: 'page_creation_started',
  PAGE_CREATION_ABANDONED: 'page_creation_abandoned',
  REPLY_CREATED: 'reply_created',
  REPLY_EDITED: 'reply_edited',
  REPLY_DELETED: 'reply_deleted',
};

// User Interaction Events
export const INTERACTION_EVENTS = {
  SEARCH_PERFORMED: 'search_performed',
  LINK_CLICKED: 'link_clicked',
  EXTERNAL_LINK_CLICKED: 'external_link_clicked',
  SECTION_EXPANDED: 'section_expanded',
  SECTION_COLLAPSED: 'section_collapsed',
  TAB_CHANGED: 'tab_changed',
  SORT_CHANGED: 'sort_changed',
  SORT_DIRECTION_TOGGLED: 'sort_direction_toggled',
  DAILY_NOTES_NAVIGATION: 'daily_notes_navigation',
  NOTIFICATION_MARKED_READ: 'notification_marked_read',
  NOTIFICATION_MARKED_UNREAD: 'notification_marked_unread',
  NOTIFICATION_MENU_OPENED: 'notification_menu_opened',
  NOTIFICATIONS_MARK_ALL_READ: 'notifications_mark_all_read',
  PLEDGE_BAR_CLICKED: 'pledge_bar_clicked',
  LINK_EDITOR_OPENED: 'link_editor_opened',
  LINK_EDITOR_CLOSED: 'link_editor_closed',
  CUSTOM_TEXT_TOGGLED: 'custom_text_toggled',
  AUTHOR_TOGGLE_CHANGED: 'author_toggle_changed',
  PAGE_SHARE_ABORTED: 'page_share_aborted',
  PAGE_SHARE_SUCCEEDED: 'page_share_succeeded',
};

// Group Events
export const GROUP_EVENTS = {
  GROUP_CREATED: 'group_created',
  GROUP_JOINED: 'group_joined',
  GROUP_LEFT: 'group_left',
  GROUP_PAGE_CREATED: 'group_page_created',
  GROUP_PAGE_EDITED: 'group_page_edited',
};

// Feature Usage Events
export const FEATURE_EVENTS = {
  THEME_CHANGED: 'theme_changed',
  NOTIFICATION_CLICKED: 'notification_clicked',
  SETTINGS_CHANGED: 'settings_changed',
  PROFILE_UPDATED: 'profile_updated',
  BIO_EDITED: 'bio_edited',
  USERNAME_CHANGED: 'username_changed',
  FEATURE_FLAG_USED: 'feature_flag_used',
  ERROR_OCCURRED: 'error_occurred',
  ERROR_RECOVERED: 'error_recovered',
};

// PWA Events
export const PWA_EVENTS = {
  PWA_STATUS: 'pwa_status',
  PWA_STATUS_CHANGED: 'pwa_status_changed',
  PWA_BANNER_ACTION: 'pwa_banner_action',
  PWA_BANNER_RESET: 'pwa_banner_reset',
};

// Navigation Events
export const NAVIGATION_EVENTS = {
  TAB_SWITCHED: 'navigation_tab_switched',
  INTERNAL_LINK_CLICKED: 'navigation_internal_link',
  EXTERNAL_LINK_CLICKED: 'navigation_external_link',
  BACK_BUTTON_USED: 'navigation_back_button',
  BREADCRUMB_CLICKED: 'navigation_breadcrumb',
  MENU_OPENED: 'navigation_menu_opened',
  SEARCH_INITIATED: 'navigation_search_initiated',
};

// Session Events
export const SESSION_EVENTS = {
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  TIME_ON_PAGE: 'time_on_page',
};

// All events combined
export const ANALYTICS_EVENTS = {
  ...PAGE_EVENTS,
  ...AUTH_EVENTS,
  ...CONTENT_EVENTS,
  ...INTERACTION_EVENTS,
  ...NAVIGATION_EVENTS,
  ...GROUP_EVENTS,
  ...FEATURE_EVENTS,
  ...SESSION_EVENTS,
  ...PWA_EVENTS,
};

// Event categories
export const EVENT_CATEGORIES = {
  PAGE: 'Page',
  AUTH: 'Authentication',
  USER: 'User',
  CONTENT: 'Content',
  INTERACTION: 'Interaction',
  NAVIGATION: 'Navigation',
  GROUP: 'Group',
  FEATURE: 'Feature',
  SESSION: 'Session',
  SYSTEM: 'System',
  PWA: 'PWA',
  APP: 'App',
  ADMIN: 'Admin',
};
