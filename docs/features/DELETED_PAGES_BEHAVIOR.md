# Deleted Pages Behavior

This document describes how deleted (soft-deleted) pages behave across the WeWrite platform.

## Overview

When a user deletes a page, it is "soft-deleted" rather than permanently removed. This allows users to restore pages within a 30-day window.

## Visibility Rules

### Where Deleted Pages ARE Visible

1. **Inside Pages with Previous Links**
   - Deleted pages appear as "deleted pills" within pages that previously linked to them
   - Example: If Page A links to Page B and Page B is deleted, Page A shows a deleted pill for Page B
   - The deleted pill displays a trash icon to indicate the page is deleted

2. **Clicking Deleted Pills**
   - Clicking on a deleted pill initiates a search for that page title
   - This helps users find other pages with the same or similar title

3. **Recently Deleted Pages Section**
   - Users can view their own recently deleted pages in Settings
   - Located at: Settings > Recently Deleted Pages
   - Shows pages deleted within the last 30 days
   - Allows restoration or permanent deletion

### Where Deleted Pages ARE NOT Visible

Deleted pages are hidden from all dynamically loaded areas:

1. **Search Results**
   - Algolia search excludes deleted pages
   - Typesense search excludes deleted pages
   - Firestore fallback search excludes deleted pages

2. **Activity Feed**
   - Deleted pages do not appear in the global activity feed
   - Deleted pages do not appear in following-only feeds

3. **User Profile Pages**
   - Deleted pages do not appear in a user's public page list
   - Deleted pages do not appear in the author's own pages list (except in Recently Deleted)

4. **Link Suggestions**
   - Deleted pages are not suggested when creating internal links

5. **Trending/Random Pages**
   - Deleted pages do not appear in trending pages
   - Deleted pages do not appear in random page selections

6. **Backlinks**
   - Deleted pages do not appear in backlink lists

## Technical Implementation

### Soft Delete Process

When a page is deleted via `deletePage()`:

1. **Firestore Update**
   - Sets `deleted: true` on the page document
   - Sets `deletedAt` timestamp

2. **Search Index Removal**
   - Removes page from Algolia index
   - Removes page from Typesense index

### Restore Process

When a page is restored via `/api/pages/restore`:

1. **Firestore Update**
   - Sets `deleted: false`
   - Removes `deletedAt` field

2. **Search Index Re-addition**
   - Re-indexes page to Algolia
   - Re-indexes page to Typesense

3. **Backlinks Rebuild**
   - Rebuilds backlink index for restored page

### Database Queries

Most Firestore queries include a filter to exclude deleted pages:

```typescript
where('deleted', '!=', true)
```

This ensures deleted pages are consistently hidden across the platform.

## Related Files

- `app/firebase/database/index.ts` - `deletePage()` function
- `app/api/pages/restore/route.ts` - Page restoration API
- `app/lib/algoliaSync.ts` - Algolia sync with deletion support
- `app/lib/typesenseSync.ts` - Typesense sync with deletion support
- `app/components/settings/RecentlyDeletedPages.tsx` - UI for managing deleted pages
- `scripts/algolia-cleanup-deleted.ts` - Script to clean up existing deleted pages from Algolia

## Maintenance

### Cleanup Script

To remove any orphaned deleted pages from Algolia:

```bash
# Dry run (shows what would be removed)
npx tsx scripts/algolia-cleanup-deleted.ts --env=prod

# Actually perform cleanup
npx tsx scripts/algolia-cleanup-deleted.ts --env=prod --cleanup
```

For development environment, use `--env=dev`.
