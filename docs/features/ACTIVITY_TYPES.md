# WeWrite Activity Types

## Overview

This document defines all activity types supported by WeWrite's activity feed system. The activity feed displays on the homepage as "Activity Feed" and on user profiles as "Recent Activity".

> **Extensibility**: The system is designed to support additional activity types in the future. Each activity type has a defined structure and display format.

## Current Activity Types

### 1. Page Edit (`page_edit`)

The primary and currently only implemented activity type. Represents when a user edits an existing page.

#### Data Structure

```typescript
interface PageEditActivity {
  // Core identifiers
  pageId: string;           // Unique page identifier
  pageName: string;         // Page title (or "Untitled")
  userId: string;           // User who made the edit
  username: string;         // Username of the editor

  // Timestamps
  timestamp: Date;          // When the edit was made
  lastModified: string;     // ISO string of last modification

  // Page metadata
  isPublic: boolean;        // Whether the page is public
  isNewPage: boolean;       // Whether this is a new page creation

  // Activity classification
  activityType: 'page_edit';

  // Diff data (what changed)
  diff: {
    added: number;          // Word count of additions
    removed: number;        // Word count of removals
    hasChanges: boolean;    // Whether there are any changes
    isNewPage?: boolean;    // Flag for new page creation
  } | null;

  // Diff preview (contextual snippet)
  diffPreview: {
    beforeContext: string;  // Text before the change (~50 chars)
    addedText: string;      // The added content
    removedText: string;    // The removed content
    afterContext: string;   // Text after the change (~50 chars)
    hasAdditions: boolean;  // Whether there are additions
    hasRemovals: boolean;   // Whether there are removals
  } | null;

  // Subscription/supporter data
  hasActiveSubscription?: boolean;
  subscriptionTier?: string;
  subscriptionAmount?: number;

  // Pledge data (monetary support)
  totalPledged?: number;
  pledgeCount?: number;
}
```

#### Display Format

The `ActivityCard` component renders page edits with:
- **User info**: Avatar, username, supporter badge (if applicable)
- **Page link**: Clickable link to the edited page
- **Timestamp**: Relative time (e.g., "2 hours ago")
- **Diff stats**: "+X / -Y" showing additions and removals
- **Diff preview**: Contextual snippet showing what changed
  - Green highlighting for additions
  - Red strikethrough for removals
  - Context text in normal color

#### Example Display

```
@jamiegray edited "My Page Title"                    2h ago
+15 / -3

...existing context text [new added content] old removed content remaining context...
```

### 2. Page Creation (`page_create`)

Represents when a user creates a new page. Currently handled as a special case of `page_edit` with `isNewPage: true`.

#### Data Structure

Same as `PageEditActivity` but with:
- `isNewPage: true`
- `activityType: 'page_create'`
- `diff.isNewPage: true`

#### Display Format

Similar to page edit but with "created" language instead of "edited".

## Planned Future Activity Types

The following activity types are planned for future implementation:

### 3. Bio Update (`bio_updated`)

When a user updates their profile bio.

```typescript
interface BioUpdateActivity {
  userId: string;
  username: string;
  timestamp: Date;
  activityType: 'bio_updated';
  // Bio diff data TBD
}
```

### 4. Follow (`user_follow`)

When a user follows another user.

```typescript
interface FollowActivity {
  userId: string;           // User who followed
  username: string;
  targetUserId: string;     // User who was followed
  targetUsername: string;
  timestamp: Date;
  activityType: 'user_follow';
}
```

### 5. Page Follow (`page_follow`)

When a user follows a page.

```typescript
interface PageFollowActivity {
  userId: string;
  username: string;
  pageId: string;
  pageName: string;
  pageAuthorId: string;
  pageAuthorUsername: string;
  timestamp: Date;
  activityType: 'page_follow';
}
```

### 6. Comment (`comment`)

When a user comments on a page (if commenting is implemented).

```typescript
interface CommentActivity {
  userId: string;
  username: string;
  pageId: string;
  pageName: string;
  commentId: string;
  commentPreview: string;   // First ~100 chars of comment
  timestamp: Date;
  activityType: 'comment';
}
```

### 7. Pledge/Tip (`pledge`)

When a user pledges tokens to a page.

```typescript
interface PledgeActivity {
  userId: string;
  username: string;
  pageId: string;
  pageName: string;
  pageAuthorId: string;
  amount: number;           // Pledge amount
  timestamp: Date;
  activityType: 'pledge';
}
```

## ActivityType Enum

```typescript
type ActivityType =
  | 'page_edit'      // Currently implemented
  | 'page_create'    // Currently implemented (as variant of page_edit)
  | 'bio_updated'    // Planned
  | 'user_follow'    // Planned
  | 'page_follow'    // Planned
  | 'comment'        // Planned
  | 'pledge';        // Planned
```

## Database Storage

### Current Implementation

Activities are **not** stored in a separate collection. Instead, activity data is derived from:

1. **Page documents** - `lastModified` and `lastDiff` fields provide edit activity
2. **Version documents** - Historical edits with diff data
3. **User documents** - Bio updates (when implemented)
4. **Follow documents** - Follow relationships (when implemented)

### Why No Activities Collection?

The simplified approach avoids:
- Sync issues between activities and source data
- Additional writes on every action
- Complex queries across multiple collections
- Permission management for a separate collection

See `SIMPLIFIED_ACTIVITY_SYSTEM.md` for the full rationale.

## API Endpoints

| Endpoint | Activity Types | Description |
|----------|----------------|-------------|
| `/api/recent-edits/global` | `page_edit`, `page_create` | Global activity feed for homepage |
| `/api/recent-edits/user` | `page_edit`, `page_create` | User-specific activity for profile |

## Component Mapping

| Component | Purpose | Activity Types |
|-----------|---------|----------------|
| `GlobalRecentEdits` | Homepage "Activity Feed" | All public activities |
| `UserRecentEdits` | Profile "Recent Activity" | User-specific activities |
| `ActivityCard` | Individual activity display | All activity types |

## Adding New Activity Types

To add a new activity type:

1. **Define the interface** in this document
2. **Add to ActivityType enum** in `app/types/database.ts`
3. **Update ActivityCard** to handle the new type's display
4. **Update API endpoints** if querying from a new data source
5. **Update this documentation**

## Related Documentation

- `RECENT_EDITS_SYSTEM.md` - Overall activity feed architecture
- `ACTIVITY_SYSTEM_ARCHITECTURE.md` - Technical architecture of the activity system
- `PAGE_DATA_AND_VERSIONS.md` - Page and version data structures
- `DIFF_SYSTEM.md` - How diffs are calculated and displayed

---

**Last Updated**: January 2026
**Status**: Page edit activities fully implemented; other types planned
