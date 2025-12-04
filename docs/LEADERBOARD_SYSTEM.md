# Leaderboard System - Month-Based Architecture

## Overview

The leaderboard system has been redesigned to use month-based periods instead of rolling time periods. This aligns with the payout schedule (monthly) and creates permanent historical records - when someone wins a leaderboard for a specific month, that achievement is locked in forever.

## Key Changes

### From Rolling to Monthly Periods

**Before:**
- `week` - Past 7 days
- `month` - Past 30 days  
- `6months` - Past 6 months

**After:**
- Specific months in `YYYY-MM` format (e.g., `2025-12`, `2025-01`)
- Each month is a discrete period with permanent winners
- Historical data preserved indefinitely

### Two Leaderboard Sections

The leaderboard page now has two distinct sections:

#### 1. By User Leaderboards
- **Pages Created** - Most pages written in the month
- **Links Received** - Most incoming links to their pages
- **Sponsors Gained** - Most new unique sponsors
- **Page Views** - Most total page views across all pages

#### 2. By Page Leaderboards
- **New Supporters** - Pages with most new supporters
- **Most Replies** - Pages with most reply pages created
- **Most Views** - Individual pages with most views
- **Most Links** - Pages with most incoming links

## API Changes

### New Endpoint Format

```
GET /api/leaderboard?type={user|page}&category={category}&month={YYYY-MM}&limit={n}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | `user` \| `page` | Yes | Leaderboard type |
| `category` | string | Yes | Category within type |
| `month` | `YYYY-MM` | No | Month to query (defaults to current) |
| `limit` | number | No | Results limit (default: 10) |

### User Categories
- `pages-created`
- `links-received`
- `sponsors-gained`
- `page-views`

### Page Categories
- `new-supporters`
- `most-replies`
- `most-views`
- `most-links`

### Response Format

**User Leaderboard:**
```json
{
  "type": "user",
  "category": "pages-created",
  "month": "2025-12",
  "data": [
    {
      "userId": "abc123",
      "username": "johndoe",
      "displayName": "John Doe",
      "profilePicture": "https://...",
      "count": 42,
      "rank": 1
    }
  ]
}
```

**Page Leaderboard:**
```json
{
  "type": "page",
  "category": "new-supporters",
  "month": "2025-12",
  "data": [
    {
      "pageId": "xyz789",
      "title": "My Awesome Page",
      "userId": "abc123",
      "username": "johndoe",
      "count": 15,
      "rank": 1
    }
  ]
}
```

## Frontend Changes

### Month Selector

A horizontal scrollable month selector allows users to browse historical leaderboards:
- Shows past 24 months
- Current month is pre-selected
- Selected month appears as a highlighted pill
- Auto-scrolls to show current selection

### Carousel Navigation

Each section (By User, By Page) has its own carousel:
- Swipe left/right on mobile
- Arrow buttons on desktop
- Pagination dots below each carousel
- Share button on each card

### URL Parameters

The page supports deep linking:
```
/leaderboard?month=2025-12&section=user&category=pages-created
```

## Data Model

### Collections Used

| Collection | Purpose |
|------------|---------|
| `pages` / `DEV_pages` | Page creation dates, links |
| `usdAllocations` / `DEV_usdAllocations` | Sponsor tracking |
| `pageViews` / `DEV_pageViews` | View counts |
| `users` / `DEV_users` | User profile enrichment |

### Indexing Requirements

The following Firestore composite indexes are recommended:

1. `pages` - `createdAt` ASC + `deleted` ASC
2. `usdAllocations` - `createdAt` ASC + `status` ASC
3. `pageViews` - `timestamp` ASC + `pageId` ASC

## Implementation Files

- **API:** `/app/api/leaderboard/route.ts`
- **Frontend:** `/app/leaderboard/page.tsx`

## Migration Notes

- Old API parameters (`period=week|month|6months`) are no longer supported
- Frontend automatically uses current month as default
- No database migration required - queries existing data with new date ranges
