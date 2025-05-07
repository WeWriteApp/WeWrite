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
  PASSWORD_RESET: 'password_reset',
  PASSWORD_RESET_REQUEST: 'password_reset_request',
};

// Content Creation Events
export const CONTENT_EVENTS = {
  PAGE_CREATED: 'page_created',
  PAGE_EDITED: 'page_edited',
  PAGE_DELETED: 'page_deleted',
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
};

// PWA Events
export const PWA_EVENTS = {
  PWA_STATUS: 'pwa_status',
  PWA_STATUS_CHANGED: 'pwa_status_changed',
  PWA_BANNER_ACTION: 'pwa_banner_action',
  PWA_BANNER_RESET: 'pwa_banner_reset',
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
  GROUP: 'Group',
  FEATURE: 'Feature',
  SESSION: 'Session',
  SYSTEM: 'System',
  PWA: 'PWA',
  APP: 'App',
  ADMIN: 'Admin',
};
