# Analytics Events (Google Analytics / GA4)

This document is the **single source of truth** for WeWrite's analytics implementation. It documents all tracked events, identifies key product metrics, highlights tracking gaps, and provides implementation guidance.

**Last Updated:** December 3, 2025

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Key Product Metrics & KPIs](#key-product-metrics--kpis)
3. [Event Inventory by Product Area](#event-inventory-by-product-area)
4. [Tracking Gaps & Recommendations](#tracking-gaps--recommendations)
5. [Implementation Guide](#implementation-guide)
6. [Where Events Are Logged](#where-events-are-logged)
7. [Adding or Modifying Events](#adding-or-modifying-events)

---

## Architecture Overview

### Analytics Providers
WeWrite uses a **dual-provider approach**:
1. **Google Analytics 4 (GA4)** - Primary analytics via `react-ga4`
2. **Firebase Analytics** - Secondary tracking for mobile/PWA

### Source Files
| File | Purpose |
|------|---------|
| `app/constants/analytics-events.ts` | Event name constants (source of truth) |
| `app/utils/analytics-service.ts` | Unified analytics service class |
| `app/hooks/useWeWriteAnalytics.ts` | React hook for component-level tracking |
| `app/utils/pwaAnalytics.ts` | PWA-specific analytics |
| `app/services/subscriptionAnalyticsService.ts` | Subscription funnel tracking (Firestore) |

### Event Categories
```typescript
EVENT_CATEGORIES = {
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
  ALLOCATION: 'Allocation'
}
```

---

## Key Product Metrics & KPIs

### 🎯 Critical Business Metrics

#### 1. **User Acquisition Funnel**
| Stage | Event(s) | Current Status | Notes |
|-------|----------|----------------|-------|
| Landing Page Visit | `page_view` | ✅ Tracked | Via UnifiedAnalyticsProvider |
| Sign-up Started | `user_register` | ✅ Tracked | |
| Account Created | `user_created` | ✅ Tracked | |
| Email Verified | `email_verified` | ✅ Tracked | |
| First Page Created | `page_created` | ✅ Tracked | Can add `is_first` param |
| **Conversion Rate** | Calculated | 📊 Available | register → created → verified |

#### 2. **Monetization Funnel** 
| Stage | Event(s) | Current Status | Notes |
|-------|----------|----------------|-------|
| Settings Page View | `settings_page_viewed` | ✅ Tracked | GA4 tracking added |
| Fund Account Page View | `fund_account_page_viewed` | ✅ Tracked | GA4 tracking added |
| Checkout Started | `checkout_started` | ✅ Tracked | GA4 tracking added |
| Plan Selected | `checkout_plan_selected` | ✅ Tracked | GA4 tracking added |
| Payment Initiated | `checkout_payment_initiated` | ✅ Tracked | GA4 tracking added |
| Payment Succeeded | `checkout_payment_succeeded` | ✅ Tracked | GA4 tracking added |
| Checkout Abandoned | `checkout_abandoned` | ✅ Tracked | GA4 tracking added |
| Subscription Created | `subscription_created` | ✅ Tracked | GA4 + Firestore |
| **Checkout Conversion** | Calculated | 📊 Available | started → completed |

#### 3. **Allocation/Funding Activity** (Core Revenue Driver)
| Stage | Event(s) | Current Status | Notes |
|-------|----------|----------------|-------|
| Allocation Bar Clicked | `allocation_bar_clicked` | ✅ Tracked | Implemented in AllocationBar |
| Modal Opened | `allocation_bar_modal_opened` | ✅ Tracked | Implemented in AllocationBar |
| Modal Closed | `allocation_bar_modal_closed` | ✅ Tracked | Implemented in AllocationBar |
| Amount Increased (+) | `allocation_bar_plus_clicked` | ✅ Tracked | Implemented in AllocationBar |
| Amount Decreased (-) | `allocation_bar_minus_clicked` | ✅ Tracked | Implemented in AllocationBar |
| USD Allocated | `allocation_bar_usd_allocated` | ✅ Tracked | Implemented in AllocationBar |
| USD Removed | `allocation_bar_usd_removed` | ✅ Tracked | Implemented in AllocationBar |
| Increment Changed | `allocation_increment_changed` | ✅ Tracked | Tracks from/to values |
| First Allocation | `first_token_allocation` | ✅ Tracked | Via SubscriptionAnalyticsService |
| Ongoing Allocation | `ongoing_token_allocation` | ✅ Tracked | Via SubscriptionAnalyticsService |

#### 4. **Content Engagement**
| Metric | Event(s) | Current Status | Notes |
|--------|----------|----------------|-------|
| Page Views | `page_view` | ✅ Tracked | |
| Pages Created | `page_created` | ✅ Tracked | |
| Pages Edited | `page_edited` | ✅ Tracked | |
| Pages Deleted | `page_deleted` | ✅ Tracked | |
| Replies Created | `reply_created` | ✅ Tracked | |
| Shares Completed | `page_share_succeeded` | ✅ Tracked | |
| Creation Abandoned | `page_creation_abandoned` | ✅ Tracked | |

#### 5. **Settings Engagement**
| Metric | Event(s) | Current Status | Notes |
|--------|----------|----------------|-------|
| Settings Page View | `settings_page_viewed` | ✅ Tracked | |
| Section Clicked | `settings_section_clicked` | ✅ Tracked | Includes section_id |
| Fund Account View | `fund_account_page_viewed` | ✅ Tracked | |
| Spend Page View | `spend_page_viewed` | ✅ Tracked | |
| Earnings Page View | `earnings_page_viewed` | ✅ Tracked | |

#### 6. **User Retention**
| Metric | Event(s) | Current Status | Notes |
|--------|----------|----------------|-------|
| Session Start | `session_start` | ✅ Tracked | |
| Session End | `session_end` | ✅ Defined | ⚠️ May not trigger reliably |
| Time on Page | `time_on_page` | ✅ Defined | ⚠️ Needs beacon implementation |
| Return Visits | GA4 native | ✅ Native | |
| DAU/WAU/MAU | GA4 native | ✅ Native | |

---

## Event Inventory by Product Area

### Auth & Session
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `user_login` | `AUTH_EVENTS.USER_LOGIN` | Track successful logins |
| `user_logout` | `AUTH_EVENTS.USER_LOGOUT` | Track logouts |
| `user_register` | `AUTH_EVENTS.USER_REGISTER` | Registration attempt |
| `user_created` | `AUTH_EVENTS.USER_CREATED` | Successful account creation |
| `password_reset` | `AUTH_EVENTS.PASSWORD_RESET` | Password reset completed |
| `password_reset_request` | `AUTH_EVENTS.PASSWORD_RESET_REQUEST` | Password reset initiated |
| `session_start` | `SESSION_EVENTS.SESSION_START` | New session began |
| `session_end` | `SESSION_EVENTS.SESSION_END` | Session ended |
| `time_on_page` | `SESSION_EVENTS.TIME_ON_PAGE` | Engagement depth |

### Email Verification
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `email_banner_action` | `EMAIL_VERIFICATION_EVENTS.EMAIL_BANNER_ACTION` | Banner interaction |
| `email_verification_sent` | `EMAIL_VERIFICATION_EVENTS.EMAIL_VERIFICATION_SENT` | Email dispatched |
| `email_verified` | `EMAIL_VERIFICATION_EVENTS.EMAIL_VERIFIED` | Verification complete |

### Content Creation & Editing
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `page_view` | `PAGE_EVENTS.PAGE_VIEW` | Baseline traffic |
| `page_creation_started` | `CONTENT_EVENTS.PAGE_CREATION_STARTED` | User began creating |
| `page_created` | `CONTENT_EVENTS.PAGE_CREATED` | Page successfully saved |
| `page_creation_abandoned` | `CONTENT_EVENTS.PAGE_CREATION_ABANDONED` | Left without saving |
| `page_edit_started` | `CONTENT_EVENTS.PAGE_EDIT_STARTED` | Edit mode entered |
| `page_edited` | `CONTENT_EVENTS.PAGE_EDITED` | Edit saved |
| `page_edit_cancelled` | `CONTENT_EVENTS.PAGE_EDIT_CANCELLED` | Edit abandoned |
| `page_deleted` | `CONTENT_EVENTS.PAGE_DELETED` | Page removed |
| `page_save_button` | `CONTENT_EVENTS.PAGE_SAVE_BUTTON` | Saved via button |
| `reply_created` | `CONTENT_EVENTS.REPLY_CREATED` | Reply added |
| `reply_edited` | `CONTENT_EVENTS.REPLY_EDITED` | Reply modified |
| `reply_deleted` | `CONTENT_EVENTS.REPLY_DELETED` | Reply removed |

### Navigation & Discovery
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `navigation_tab_switched` | `NAVIGATION_EVENTS.TAB_SWITCHED` | Tab navigation usage |
| `navigation_internal_link` | `NAVIGATION_EVENTS.INTERNAL_LINK_CLICKED` | In-app navigation |
| `navigation_external_link` | `NAVIGATION_EVENTS.EXTERNAL_LINK_CLICKED` | Outbound clicks |
| `navigation_back_button` | `NAVIGATION_EVENTS.BACK_BUTTON_USED` | Back nav usage |
| `navigation_breadcrumb` | `NAVIGATION_EVENTS.BREADCRUMB_CLICKED` | Breadcrumb usage |
| `navigation_menu_opened` | `NAVIGATION_EVENTS.MENU_OPENED` | Menu engagement |
| `navigation_search_initiated` | `NAVIGATION_EVENTS.SEARCH_INITIATED` | Search started |
| `search_performed` | `INTERACTION_EVENTS.SEARCH_PERFORMED` | Search executed |
| `daily_notes_navigation` | `INTERACTION_EVENTS.DAILY_NOTES_NAVIGATION` | Daily notes feature |

### User Interaction & Sharing
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `link_clicked` | `INTERACTION_EVENTS.LINK_CLICKED` | General link clicks |
| `external_link_clicked` | `INTERACTION_EVENTS.EXTERNAL_LINK_CLICKED` | External navigation |
| `section_expanded` | `INTERACTION_EVENTS.SECTION_EXPANDED` | Accordion/section open |
| `section_collapsed` | `INTERACTION_EVENTS.SECTION_COLLAPSED` | Accordion/section close |
| `tab_changed` | `INTERACTION_EVENTS.TAB_CHANGED` | Tab switching |
| `sort_changed` | `INTERACTION_EVENTS.SORT_CHANGED` | Sort preference changed |
| `sort_direction_toggled` | `INTERACTION_EVENTS.SORT_DIRECTION_TOGGLED` | Asc/desc toggle |
| `page_share_aborted` | `INTERACTION_EVENTS.PAGE_SHARE_ABORTED` | Page share cancelled |
| `page_share_succeeded` | `INTERACTION_EVENTS.PAGE_SHARE_SUCCEEDED` | Page share completed |

### Share Events
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `profile_share_started` | `SHARE_EVENTS.PROFILE_SHARE_STARTED` | User initiated profile share |
| `profile_share_succeeded` | `SHARE_EVENTS.PROFILE_SHARE_SUCCEEDED` | Profile share completed |
| `profile_share_cancelled` | `SHARE_EVENTS.PROFILE_SHARE_CANCELLED` | User cancelled profile share |
| `profile_share_failed` | `SHARE_EVENTS.PROFILE_SHARE_FAILED` | Profile share failed with error |
| `search_share_started` | `SHARE_EVENTS.SEARCH_SHARE_STARTED` | User initiated search share |
| `search_share_succeeded` | `SHARE_EVENTS.SEARCH_SHARE_SUCCEEDED` | Search share completed |
| `search_share_cancelled` | `SHARE_EVENTS.SEARCH_SHARE_CANCELLED` | User cancelled search share |
| `search_share_failed` | `SHARE_EVENTS.SEARCH_SHARE_FAILED` | Search share failed with error |

**Share Event Parameters:**
```typescript
// Profile Share
{
  profile_id: string,        // UID of the profile being shared
  profile_username: string,  // Username of the profile
  share_method: 'native_share' | 'copy_link',
  is_own_profile: boolean,   // Whether user is sharing their own profile
  error_message?: string     // Only for failed events
}

// Search Share
{
  search_query: string,      // The search query being shared
  has_query: boolean,        // Whether there was an active query
  share_method: 'native_share' | 'copy_link',
  error_message?: string     // Only for failed events
}
```

### Notifications
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `notification_menu_opened` | `INTERACTION_EVENTS.NOTIFICATION_MENU_OPENED` | Notification bell clicked |
| `notification_marked_read` | `INTERACTION_EVENTS.NOTIFICATION_MARKED_READ` | Single notification read |
| `notification_marked_unread` | `INTERACTION_EVENTS.NOTIFICATION_MARKED_UNREAD` | Marked unread |
| `notifications_mark_all_read` | `INTERACTION_EVENTS.NOTIFICATIONS_MARK_ALL_READ` | Cleared all |
| `notification_clicked` | `FEATURE_EVENTS.NOTIFICATION_CLICKED` | Notification action taken |

### Allocation Bar
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `allocation_bar_clicked` | `INTERACTION_EVENTS.ALLOCATION_BAR_CLICKED` | Initial bar interaction |
| `allocation_bar_hovered` | `INTERACTION_EVENTS.ALLOCATION_BAR_HOVERED` | Hover interest signal |
| `allocation_bar_usd_allocated` | `INTERACTION_EVENTS.ALLOCATION_BAR_USD_ALLOCATED` | USD successfully allocated |
| `allocation_bar_usd_removed` | `INTERACTION_EVENTS.ALLOCATION_BAR_USD_REMOVED` | USD deallocated |
| `allocation_bar_plus_clicked` | `INTERACTION_EVENTS.ALLOCATION_BAR_PLUS_CLICKED` | Increment clicked |
| `allocation_bar_minus_clicked` | `INTERACTION_EVENTS.ALLOCATION_BAR_MINUS_CLICKED` | Decrement clicked |
| `allocation_bar_progress_hovered` | `INTERACTION_EVENTS.ALLOCATION_BAR_PROGRESS_HOVERED` | Progress bar tooltip |
| `allocation_bar_modal_opened` | `INTERACTION_EVENTS.ALLOCATION_BAR_MODAL_OPENED` | Allocation modal opened |
| `allocation_bar_modal_closed` | `INTERACTION_EVENTS.ALLOCATION_BAR_MODAL_CLOSED` | Allocation modal closed |
| `allocation_increment_changed` | `INTERACTION_EVENTS.ALLOCATION_INCREMENT_CHANGED` | User changed tap increment |

**Allocation Increment Changed Event Parameters:**
```typescript
{
  action: 'allocation_increment_changed',
  label: '$0.50 → $1.00',  // Human-readable transition
  from_cents: 50,          // Previous interval in cents
  to_cents: 100,           // New interval in cents
  from_formatted: '$0.50', // Formatted previous value
  to_formatted: '$1.00'    // Formatted new value
}
```

### Subscription / Checkout (GA4)
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `checkout_started` | `SUBSCRIPTION_EVENTS.CHECKOUT_STARTED` | User initiated checkout |
| `checkout_plan_selected` | `SUBSCRIPTION_EVENTS.CHECKOUT_PLAN_SELECTED` | Plan tier selected |
| `checkout_payment_initiated` | `SUBSCRIPTION_EVENTS.CHECKOUT_PAYMENT_INITIATED` | Stripe payment started |
| `checkout_payment_succeeded` | `SUBSCRIPTION_EVENTS.CHECKOUT_PAYMENT_SUCCEEDED` | Payment successful |
| `checkout_payment_failed` | `SUBSCRIPTION_EVENTS.CHECKOUT_PAYMENT_FAILED` | Payment failed |
| `checkout_abandoned` | `SUBSCRIPTION_EVENTS.CHECKOUT_ABANDONED` | User left checkout flow |
| `subscription_created` | `SUBSCRIPTION_EVENTS.SUBSCRIPTION_CREATED` | New subscription active |
| `subscription_updated` | `SUBSCRIPTION_EVENTS.SUBSCRIPTION_UPDATED` | Subscription modified |
| `subscription_cancelled` | `SUBSCRIPTION_EVENTS.SUBSCRIPTION_CANCELLED` | Subscription cancelled |

### Settings Pages
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `settings_page_viewed` | `SETTINGS_EVENTS.SETTINGS_PAGE_VIEWED` | Main settings accessed |
| `settings_section_clicked` | `SETTINGS_EVENTS.SETTINGS_SECTION_CLICKED` | Settings nav clicked |
| `fund_account_page_viewed` | `SETTINGS_EVENTS.FUND_ACCOUNT_PAGE_VIEWED` | Funding page accessed |
| `spend_page_viewed` | `SETTINGS_EVENTS.SPEND_PAGE_VIEWED` | Spend management accessed |
| `earnings_page_viewed` | `SETTINGS_EVENTS.EARNINGS_PAGE_VIEWED` | Earnings dashboard accessed |
| `profile_page_viewed` | `SETTINGS_EVENTS.PROFILE_PAGE_VIEWED` | Profile settings accessed |
| `appearance_page_viewed` | `SETTINGS_EVENTS.APPEARANCE_PAGE_VIEWED` | Theme settings accessed |
| `notifications_page_viewed` | `SETTINGS_EVENTS.NOTIFICATIONS_PAGE_VIEWED` | Notification settings accessed |

### Link Editor
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `link_editor_opened` | `INTERACTION_EVENTS.LINK_EDITOR_OPENED` | Editor modal opened |
| `link_editor_closed` | `INTERACTION_EVENTS.LINK_EDITOR_CLOSED` | Editor dismissed |
| `custom_text_toggled` | `INTERACTION_EVENTS.CUSTOM_TEXT_TOGGLED` | Custom text option |
| `author_toggle_changed` | `INTERACTION_EVENTS.AUTHOR_TOGGLE_CHANGED` | Author display toggle |

### Feature & Profile
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `theme_changed` | `FEATURE_EVENTS.THEME_CHANGED` | Theme preference |
| `settings_changed` | `FEATURE_EVENTS.SETTINGS_CHANGED` | Settings modified |
| `profile_updated` | `FEATURE_EVENTS.PROFILE_UPDATED` | Profile changes |
| `bio_edited` | `FEATURE_EVENTS.BIO_EDITED` | Bio updated |
| `username_changed` | `FEATURE_EVENTS.USERNAME_CHANGED` | Username changed |
| `feature_flag_used` | `FEATURE_EVENTS.FEATURE_FLAG_USED` | Feature flag triggered |

### PWA
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `pwa_status` | `PWA_EVENTS.PWA_STATUS` | PWA detection on load |
| `pwa_status_changed` | `PWA_EVENTS.PWA_STATUS_CHANGED` | PWA state change |
| `pwa_banner_action` | `PWA_EVENTS.PWA_BANNER_ACTION` | Install banner interaction |
| `pwa_banner_reset` | `PWA_EVENTS.PWA_BANNER_RESET` | Banner state reset |

### Error / System
| Event | Constant | Business Intent |
|-------|----------|-----------------|
| `error_occurred` | `FEATURE_EVENTS.ERROR_OCCURRED` | Error caught |
| `error_recovered` | `FEATURE_EVENTS.ERROR_RECOVERED` | Error resolved |

### Subscription Funnel (Firestore)
*These events are tracked via `SubscriptionAnalyticsService` to Firestore, in addition to GA4:*

| Event | Method | Business Intent |
|-------|--------|-----------------|
| `subscription_flow_started` | `trackSubscriptionFlowStarted()` | Checkout initiated |
| `subscription_abandoned_before_payment` | `trackSubscriptionAbandonedBeforePayment()` | Dropped before Stripe |
| `subscription_abandoned_during_payment` | `trackSubscriptionAbandonedDuringPayment()` | Stripe payment failed/cancelled |
| `subscription_completed` | `trackSubscriptionCompleted()` | Successful subscription |
| `first_token_allocation` | `trackFirstTokenAllocation()` | New subscriber's first allocation |
| `ongoing_token_allocation` | `trackOngoingTokenAllocation()` | Repeat allocation |

---

## Tracking Gaps & Recommendations

### ✅ Recently Implemented (December 2025)

The following gaps were identified and fixed:

1. **Allocation Bar Events** - Now fully implemented with:
   - Click, hover, modal open/close tracking
   - Plus/minus button tracking
   - USD allocated/removed tracking
   - Allocation increment change tracking with from/to values

2. **Checkout Flow GA4 Tracking** - Added alongside Firestore:
   - `checkout_started`, `checkout_plan_selected`
   - `checkout_payment_initiated`, `checkout_payment_succeeded`
   - `checkout_abandoned`, `subscription_created`

3. **Settings Pages Tracking** - Page views and navigation:
   - Main settings page view
   - Section click tracking with section_id
   - Fund account, spend, earnings page views

### 🟡 Medium Priority Gaps (Remaining)

#### 1. **First-time User Actions Not Flagged**
**Issue:** Events like `page_created` don't distinguish first vs repeat  
**Recommendation:** When calling `trackContentEvent`, pass `is_first: true` parameter when you can detect first action  
**Example:**
```typescript
trackContentEvent(CONTENT_EVENTS.PAGE_CREATED, {
  page_id: pageId,
  is_first: userPageCount === 0  // Check if this is user's first page
});
```

#### 2. **Session End Unreliable**
**Issue:** `session_end` may not fire (page close/tab close)  
**Recommendation:** Implement `navigator.sendBeacon()` for session tracking

#### 3. **Time on Page Underutilized**
**Issue:** `time_on_page` defined but not actively tracked  
**Recommendation:** Implement via Page Visibility API

#### 4. **Allocation Bar Hover Not Implemented**
**Issue:** `allocation_bar_hovered` and `allocation_bar_progress_hovered` events are defined but not tracked  
**Recommendation:** Add onMouseEnter handlers to allocation bar components

### 🟢 Nice-to-Have

#### 5. **Scroll Depth Tracking**
**Recommendation:** Add scroll depth milestones (25%, 50%, 75%, 100%)

#### 8. **Form Field Analytics**
**Recommendation:** Track field focus/blur for friction identification

#### 9. **Error Context Enrichment**
**Recommendation:** Add more context to `error_occurred` events

---

## Implementation Guide

### Basic Event Tracking
```typescript
import { useWeWriteAnalytics } from '../hooks/useWeWriteAnalytics';
import { CONTENT_EVENTS, INTERACTION_EVENTS } from '../constants/analytics-events';

function MyComponent() {
  const { trackContentEvent, trackInteractionEvent } = useWeWriteAnalytics();

  const handleCreate = () => {
    trackContentEvent(CONTENT_EVENTS.PAGE_CREATED, {
      page_id: 'abc123',
      page_title: 'My Page'
    });
  };

  const handleClick = () => {
    trackInteractionEvent(INTERACTION_EVENTS.LINK_CLICKED, {
      link_type: 'internal',
      destination: '/some-page'
    });
  };
}
```

### Specialized Flow Tracking
```typescript
const { trackPageCreationFlow, trackEditingFlow } = useWeWriteAnalytics();

// Page creation flow
trackPageCreationFlow.started();
trackPageCreationFlow.saved('keyboard'); // or 'button'
trackPageCreationFlow.completed('page-id-123');
trackPageCreationFlow.abandoned();

// Editing flow
trackEditingFlow.started('page-id');
trackEditingFlow.saved('page-id', 'button');
trackEditingFlow.cancelled('page-id');
```

### Server-Side Tracking (Subscription Funnel)
```typescript
import { SubscriptionAnalyticsService } from '../services/subscriptionAnalyticsService';

// Track subscription flow
await SubscriptionAnalyticsService.trackSubscriptionFlowStarted(
  userId,
  'tier2',
  10,
  1000
);

await SubscriptionAnalyticsService.trackSubscriptionCompleted(
  userId,
  subscriptionId,
  'tier2',
  10,
  1000
);
```

---

## Where Events Are Logged

### Client-Side
| File | Purpose |
|------|---------|
| `app/hooks/useWeWriteAnalytics.ts` | Primary React hook with helper methods |
| `app/utils/analytics-service.ts` | Core analytics service (GA4 + Firebase) |
| `app/utils/pwaAnalytics.ts` | PWA-specific tracking |
| `app/providers/UnifiedAnalyticsProvider.tsx` | Page view tracking |

### Server-Side / Firestore
| File | Purpose |
|------|---------|
| `app/services/subscriptionAnalyticsService.ts` | Subscription funnel to Firestore |
| `app/services/subscriptionAuditService.ts` | Subscription audit trail |
| `app/services/auditTrailService.ts` | General audit logging |

### Components with Direct Tracking
- `app/components/auth/AuthButton.tsx`
- `app/components/utils/VerifyEmailBanner.tsx`
- `app/components/utils/PWABanner.tsx`
- `app/components/ui/ExternalLinkPreviewModal.tsx`
- `app/components/landing/LandingPage.tsx`
- `app/components/landing/HeroSection.tsx`

---

## Adding or Modifying Events

### Step-by-Step Process

1. **Add the constant** in `app/constants/analytics-events.ts`:
   ```typescript
   export const INTERACTION_EVENTS = {
     // ... existing
     MY_NEW_EVENT: 'my_new_event',
   };
   ```

2. **Update this doc** with the event name, category, and business intent

3. **Implement tracking** in the relevant component:
   ```typescript
   const { trackInteractionEvent } = useWeWriteAnalytics();
   trackInteractionEvent(INTERACTION_EVENTS.MY_NEW_EVENT, { context: 'value' });
   ```

4. **Verify in GA4 DebugView** during development

5. **Add to GA4 custom dimensions** if using custom parameters

### Naming Conventions
- Use `snake_case` for event names
- Prefix with category when ambiguous: `navigation_back_button`
- Keep names concise but descriptive
- Match existing patterns in the codebase

### Required Parameters
All events automatically include:
- `page_path` - Current URL path
- `page_title` - Document title
- `page_location` - Full URL

### Recommended Custom Parameters
| Parameter | Use When |
|-----------|----------|
| `page_id` | Content-specific actions |
| `author_id` | User-related content |
| `amount_cents` | Financial values |
| `source` | Action origin (e.g., 'modal', 'header') |
| `method` | How action was performed (e.g., 'keyboard', 'button') |

