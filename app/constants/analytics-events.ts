/**
 * Analytics Events Constants
 *
 * This file centralizes all analytics events used throughout the WeWrite application.
 * Using these constants ensures consistency in event naming across the application
 * and makes it easier to track what events are being monitored.
 */

// Page View Events
export const PAGE_EVENTS = {
  PAGE_VIEW: 'page_view'};

// User Authentication Events
export const AUTH_EVENTS = {
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  USER_CREATED: 'user_created',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_RESET_REQUEST: 'password_reset_request'};

// Email Verification Events
export const EMAIL_VERIFICATION_EVENTS = {
  EMAIL_BANNER_ACTION: 'email_banner_action',
  EMAIL_VERIFICATION_SENT: 'email_verification_sent',
  EMAIL_VERIFIED: 'email_verified'};

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
  REPLY_DELETED: 'reply_deleted'};

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
  // Allocation Bar Events (formerly pledge_bar)
  ALLOCATION_BAR_CLICKED: 'allocation_bar_clicked',
  ALLOCATION_BAR_HOVERED: 'allocation_bar_hovered',
  ALLOCATION_BAR_USD_ALLOCATED: 'allocation_bar_usd_allocated',
  ALLOCATION_BAR_USD_REMOVED: 'allocation_bar_usd_removed',
  ALLOCATION_BAR_PLUS_CLICKED: 'allocation_bar_plus_clicked',
  ALLOCATION_BAR_MINUS_CLICKED: 'allocation_bar_minus_clicked',
  ALLOCATION_BAR_PROGRESS_HOVERED: 'allocation_bar_progress_hovered',
  ALLOCATION_BAR_MODAL_OPENED: 'allocation_bar_modal_opened',
  ALLOCATION_BAR_MODAL_CLOSED: 'allocation_bar_modal_closed',
  ALLOCATION_INCREMENT_CHANGED: 'allocation_increment_changed',
  LINK_EDITOR_OPENED: 'link_editor_opened',
  LINK_EDITOR_CLOSED: 'link_editor_closed',
  CUSTOM_TEXT_TOGGLED: 'custom_text_toggled',
  AUTHOR_TOGGLE_CHANGED: 'author_toggle_changed',
  PAGE_SHARE_ABORTED: 'page_share_aborted',
  PAGE_SHARE_SUCCEEDED: 'page_share_succeeded'};

// Subscription/Checkout Events (for GA4 tracking alongside Firestore)
export const SUBSCRIPTION_EVENTS = {
  CHECKOUT_STARTED: 'checkout_started',
  CHECKOUT_PLAN_SELECTED: 'checkout_plan_selected',
  CHECKOUT_PAYMENT_INITIATED: 'checkout_payment_initiated',
  CHECKOUT_PAYMENT_SUCCEEDED: 'checkout_payment_succeeded',
  CHECKOUT_PAYMENT_FAILED: 'checkout_payment_failed',
  CHECKOUT_ABANDONED: 'checkout_abandoned',
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_UPDATED: 'subscription_updated',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled'};

// Settings Events
export const SETTINGS_EVENTS = {
  SETTINGS_PAGE_VIEWED: 'settings_page_viewed',
  SETTINGS_SECTION_CLICKED: 'settings_section_clicked',
  FUND_ACCOUNT_PAGE_VIEWED: 'fund_account_page_viewed',
  SPEND_PAGE_VIEWED: 'spend_page_viewed',
  EARNINGS_PAGE_VIEWED: 'earnings_page_viewed',
  PROFILE_PAGE_VIEWED: 'profile_page_viewed',
  APPEARANCE_PAGE_VIEWED: 'appearance_page_viewed',
  NOTIFICATIONS_PAGE_VIEWED: 'notifications_page_viewed'};



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
  ERROR_RECOVERED: 'error_recovered'};

// PWA Events
export const PWA_EVENTS = {
  PWA_STATUS: 'pwa_status',
  PWA_STATUS_CHANGED: 'pwa_status_changed',
  PWA_BANNER_ACTION: 'pwa_banner_action',
  PWA_BANNER_RESET: 'pwa_banner_reset'};

// Navigation Events
export const NAVIGATION_EVENTS = {
  TAB_SWITCHED: 'navigation_tab_switched',
  INTERNAL_LINK_CLICKED: 'navigation_internal_link',
  EXTERNAL_LINK_CLICKED: 'navigation_external_link',
  BACK_BUTTON_USED: 'navigation_back_button',
  BREADCRUMB_CLICKED: 'navigation_breadcrumb',
  MENU_OPENED: 'navigation_menu_opened',
  SEARCH_INITIATED: 'navigation_search_initiated',
  // Mobile toolbar rearrange events
  TOOLBAR_EDIT_STARTED: 'toolbar_edit_started',
  TOOLBAR_EDIT_SAVED: 'toolbar_edit_saved',
  TOOLBAR_EDIT_CANCELLED: 'toolbar_edit_cancelled',
  TOOLBAR_RESET_TO_DEFAULT: 'toolbar_reset_to_default',
  TOOLBAR_ITEM_REORDERED: 'toolbar_item_reordered'
};

// Session Events
export const SESSION_EVENTS = {
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  TIME_ON_PAGE: 'time_on_page'};

// Share Events - Track all share actions with outcomes
export const SHARE_EVENTS = {
  // Profile sharing
  PROFILE_SHARE_STARTED: 'profile_share_started',
  PROFILE_SHARE_SUCCEEDED: 'profile_share_succeeded',
  PROFILE_SHARE_CANCELLED: 'profile_share_cancelled',
  PROFILE_SHARE_FAILED: 'profile_share_failed',
  // Search sharing
  SEARCH_SHARE_STARTED: 'search_share_started',
  SEARCH_SHARE_SUCCEEDED: 'search_share_succeeded',
  SEARCH_SHARE_CANCELLED: 'search_share_cancelled',
  SEARCH_SHARE_FAILED: 'search_share_failed'
};

// All events combined
export const ANALYTICS_EVENTS = {
  ...PAGE_EVENTS,
  ...AUTH_EVENTS,
  ...EMAIL_VERIFICATION_EVENTS,
  ...CONTENT_EVENTS,
  ...INTERACTION_EVENTS,
  ...NAVIGATION_EVENTS,
  ...FEATURE_EVENTS,
  ...SESSION_EVENTS,
  ...PWA_EVENTS,
  ...SUBSCRIPTION_EVENTS,
  ...SETTINGS_EVENTS,
  ...SHARE_EVENTS};

// Event categories
export const EVENT_CATEGORIES = {
  PAGE: 'Page',
  AUTH: 'Authentication',
  EMAIL_VERIFICATION: 'Email_Verification',
  USER: 'User',
  CONTENT: 'Content',
  INTERACTION: 'Interaction',
  NAVIGATION: 'Navigation',
  FEATURE: 'Feature',
  SESSION: 'Session',
  SYSTEM: 'System',
  PWA: 'PWA',
  APP: 'App',
  ADMIN: 'Admin',
  SUBSCRIPTION: 'Subscription',
  SETTINGS: 'Settings',
  ALLOCATION: 'Allocation',
  SHARE: 'Share'};