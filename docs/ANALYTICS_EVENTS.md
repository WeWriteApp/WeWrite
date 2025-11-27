# Analytics Events (Google Analytics / GA4)  

This document lists all application analytics events defined in `app/constants/analytics-events.ts`, grouped by product area, with the business intent for each event. Use these names when logging to ensure consistency across web, app shell, and server-triggered events.

## Usage
- Source of truth: `app/constants/analytics-events.ts`
- Categories: see `EVENT_CATEGORIES` in the same file.
- When adding a new event, update this doc and the constants file together.

## Event Inventory by Product Area

### Auth & Session
- `user_login`, `user_logout`, `user_register`, `user_created` — Funnel tracking for auth conversion and onboarding success.
- `password_reset`, `password_reset_request` — Gauge password-recovery friction and volume.
- `session_start`, `session_end`, `time_on_page` — Engagement/retention baselines and session health.

### Email Verification & System Health
- `email_banner_action`, `email_verification_sent`, `email_verified` — Measure verification drop-off and banner effectiveness.
- `system_announcement` (category: System) — Broadcast engagement for critical comms (mapped via category).

### Content Creation & Editing
- `page_creation_started`, `page_created` — Creation funnel (start→complete) and drop-off.
- `page_edit_started`, `page_edited`, `page_edit_cancelled`, `page_deleted` — Edit flow adoption and churn risk (deletion rate).
- `page_save_keyboard`, `page_save_button` — UI effectiveness; keyboard vs button usage.
- `reply_created`, `reply_edited`, `reply_deleted` — Reply flow volume and retention of contributions.
- `page_creation_abandoned` — Incomplete creation intent; informs nudges and UX fixes.

### Navigation & Discovery
- `page_view` — Baseline traffic.
- `navigation_tab_switched`, `navigation_internal_link`, `navigation_external_link`, `navigation_back_button`, `navigation_breadcrumb`, `navigation_menu_opened`, `navigation_search_initiated` — Navigation affordance usage and discovery pathways.
- `search_performed` — Search health and query volume.
- `daily_notes_navigation` — Daily note navigation adoption.

### User Interaction & Sharing
- `link_clicked`, `external_link_clicked` — Outbound vs internal engagement; informs link placement value.
- `section_expanded`, `section_collapsed`, `tab_changed`, `sort_changed`, `sort_direction_toggled` — UI control usage to validate control placement and defaults.
- `notification_menu_opened`, `notification_marked_read`, `notification_marked_unread`, `notifications_mark_all_read` — Notification hygiene and feature value.
- `pledge_bar_clicked`, `pledge_bar_hovered`, `pledge_bar_usd_allocated`, `pledge_bar_usd_removed`, `pledge_bar_plus_clicked`, `pledge_bar_minus_clicked`, `pledge_bar_progress_hovered` — Funding bar usability and conversion signals.
- `link_editor_opened`, `link_editor_closed`, `custom_text_toggled`, `author_toggle_changed` — Link editor UX effectiveness and friction detection.
- `page_share_aborted`, `page_share_succeeded` — Sharing flow success vs abandonment.

### Feature & Profile
- `theme_changed` — Theme adoption and preference.
- `notification_clicked` — On-notification click-through.
- `settings_changed` — Settings interaction health.
- `profile_updated`, `bio_edited`, `username_changed` — Profile completeness drivers.
- `feature_flag_used` — Gating/flag impact measurement.

### PWA
- `pwa_status`, `pwa_status_changed`, `pwa_banner_action`, `pwa_banner_reset` — PWA install intent and banner efficacy.

### Error / System Signals
- `error_occurred`, `error_recovered` — Error rate and recovery; correlate with UX friction.

## Adding or Modifying Events
1. Add/modify the constant in `app/constants/analytics-events.ts`.
2. Update this doc with the event name, bucket, and business intent.
3. Ensure `EVENT_CATEGORIES` has an appropriate category or add one if needed.
4. Validate GA4/analytics wiring (client hooks: `useWeWriteAnalytics`, `useAnalyticsTracking`; server: `analytics-service`).

## Where Events Are Logged
- Client hooks: `app/hooks/useWeWriteAnalytics.ts`, `app/hooks/useAnalyticsTracking.ts`
- Service: `app/utils/analytics-service.ts`
- PWA helpers: `app/utils/pwaAnalytics.ts`, `app/utils/pwa-detection.ts`
- Page-specific handlers: e.g., `app/utils/pageActionHandlers.ts` (shares/replies), link/editor flows, pledge bar interactions.

