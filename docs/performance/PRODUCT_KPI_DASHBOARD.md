# Product KPI Dashboard Documentation

This document describes the data pipelines and metrics shown on the Product KPI Dashboard (`/admin/product-kpis`).

## Overview

The Product KPI Dashboard provides real-time analytics for WeWrite's core metrics. All metrics support:
- **Date range filtering**: Select start and end dates
- **Cumulative mode**: View running totals over time
- **Bar/Line chart toggle**: Switch between visualization types

## Data Sources

| Metric | Source | Collection/API | Key Fields |
|--------|--------|----------------|------------|
| New Accounts | Firebase | `users` | `createdAt` (ISO string) |
| New Pages | Firebase | `pages` | `createdAt`, `deleted` |
| Content Changes | Firebase | `pages/{pageId}/versions` | `diff.added`, `diff.removed`, `createdAt` |
| Links Added | Firebase | `pages` | `content` (Slate.js array with link nodes) |
| Content Shares | Firebase | `analytics_events` | `eventType: 'share_event'` |
| Page Views | Firebase | `pageViews` | `totalViews`, `date` |
| Replies | Firebase | `pages` | `replyTo`, `replyType` |
| PWA Installs | Firebase | `analytics_events` | `eventType: 'pwa_install'` |
| Notifications | Firebase | `emailLogs` + `analytics_events` | `sentAt`, `pwa_notification_sent` |
| Subscriptions | Stripe API | Subscriptions endpoint | `created` timestamp |
| Revenue | Stripe API | Charges endpoint | `amount`, `created` |
| Platform Revenue | Firebase | Monthly revenue calculations | Platform fees + unallocated funds |

## Metric Details

### New Accounts Created
- **Description**: Number of user accounts created per day
- **Query**: Users collection with `createdAt` in date range
- **Aggregation**: Daily count of new users

### New Pages Created
- **Description**: Number of pages created per day (excluding deleted)
- **Query**: Pages collection with `createdAt` in range, `deleted: false`
- **Aggregation**: Daily count of new pages

### Content Changes
- **Description**: Number of version saves with character additions/deletions
- **Source of Truth**: `pages/{pageId}/versions` subcollection
- **Data Pipeline**:
  1. Query all non-deleted pages
  2. For each page, query versions subcollection in date range
  3. Count versions where `diff.hasChanges: true`
  4. Sum `diff.added` and `diff.removed` for character counts
- **Note**: Previously used `analytics_events` but this was never populated. Now reads directly from version history.

### Links Added
- **Description**: Internal (WeWrite) and external links added to pages
- **Source of Truth**: Page `content` field (Slate.js array)
- **Data Pipeline**:
  1. Query pages created in date range
  2. Parse Slate.js content for `type: 'link'` nodes
  3. Classify links:
     - **Internal**: Has `pageId` property (links to WeWrite pages)
     - **External**: Has `isExternal: true` or `url` starting with `http`
  4. Aggregate daily counts per link type
- **Chart Type**: Stacked bar (blue = internal, green = external)

### Content Shares
- **Description**: Number of times pages were shared
- **Query**: `analytics_events` where `eventType: 'share_event'`
- **Aggregation**: Daily count of share events

### Page Views
- **Description**: Total content page views
- **Query**: `pageViews` collection aggregated by date
- **Note**: Counts page view events, not unique visitors

### Replies
- **Description**: Reply pages created, categorized by sentiment
- **Query**: Pages with `replyTo` field
- **Categories**:
  - `agree` - User agrees with original
  - `disagree` - User disagrees
  - `neutral` / `standard` - Neutral stance
- **Chart Type**: Stacked bar chart

### Notifications Sent
- **Description**: Combined email and push notification counts
- **Sources**:
  - `emailLogs`: Email notifications with `sentAt` field
  - `analytics_events`: Push notifications with `eventType: 'pwa_notification_sent'`
- **Chart Type**: Stacked bar (emails + push)

### Subscriptions Over Time
- **Description**: New Stripe subscriptions created
- **Source**: Stripe Subscriptions API with `created` filter
- **Aggregation**: Daily count of new subscriptions

### Subscription Revenue
- **Description**: Gross revenue from subscription charges
- **Source**: Stripe Charges API
- **Calculation**: Sum of `amount` (successful charges) - refunds
- **Format**: USD dollars

### Platform Revenue
- **Description**: WeWrite's platform earnings
- **Components**:
  - Platform fees (from payouts)
  - Unallocated funds (subscriber funds not allocated to creators)
- **Source**: Internal platform revenue service

## API Endpoints

All metrics are served via a unified API:

```
GET /api/admin/dashboard-analytics?type={type}&startDate={iso}&endDate={iso}
```

### Supported Types

| Type | Description |
|------|-------------|
| `accounts` | New user accounts |
| `pages` | New pages created |
| `contentChanges` | Version saves with diffs |
| `links` | Internal/external links added |
| `shares` | Share events |
| `visitors` | Page views |
| `pageViews` | Page views (detailed) |
| `replies` | Reply pages by type |
| `notificationsSent` | Emails + push notifications |
| `pwaInstalls` | PWA installation events |
| `pwaNotifications` | Push notification events |
| `subscriptions` | Stripe subscription creations |
| `revenue` | Stripe charge revenue |
| `all` | All metrics combined |

## Frontend Implementation

### Hooks

Located in `app/hooks/useDashboardAnalytics.ts`:

| Hook | Metric |
|------|--------|
| `useAccountsMetrics` | New accounts |
| `usePagesMetrics` | New pages |
| `useContentChangesMetrics` | Content changes |
| `useLinkMetrics` | Links added |
| `useSharesMetrics` | Shares |
| `useVisitorMetrics` | Page views |
| `useRepliesMetrics` | Replies |
| `useNotificationsSentMetrics` | Notifications |
| `usePWAInstallsMetrics` | PWA installs |
| `usePlatformRevenueMetrics` | Platform revenue |

### Dashboard Component

`app/components/admin/DesktopOptimizedDashboard.tsx`

Key features:
- Dynamic chart rows from config array
- Supports cumulative transformation
- Granularity-based aggregation
- Responsive chart sizing with ResizeObserver

## Service Layer

`app/services/adminAnalytics.ts`

Key methods:
- `getNewAccountsCreated()` - User creation analytics
- `getNewPagesCreated()` - Page creation analytics
- `getContentChangesFromVersions()` - Version diff aggregation
- `getLinkAnalytics()` - Link type analysis
- `getAnalyticsEvents()` - Generic event queries
- `getRepliesAnalytics()` - Reply sentiment breakdown
- `getNotificationsSentAnalytics()` - Combined notifications
- `getSubscriptionsCreated()` - Stripe subscriptions
- `getSubscriptionRevenue()` - Stripe charges

## Troubleshooting

### Content Changes showing zero
- **Cause**: Previously used empty `analytics_events` collection
- **Solution**: Fixed to read from `pages/{pageId}/versions` subcollection

### Page Views overcounting
- **Cause**: Counts every view event, not unique visitors
- **Solution**: Renamed metric from "Visitors" to "Page Views" for clarity

### Links not appearing
- **Cause**: Links only counted on page creation date
- **Solution**: Links are counted based on page `createdAt`, showing what links existed when page was created

## Related Documentation

- [Analytics Events Architecture](./ANALYTICS_EVENTS.md)
- [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION_GUIDE.md)
- [Firebase Optimization Guide](../firebase/FIREBASE_OPTIMIZATION_GUIDE.md)
