# External Links Index System

## Overview

The External Links Index is a scalable solution for efficiently querying which pages link to a specific external URL. Instead of scanning through all pages on every request (O(n) complexity), we maintain a Firestore index that enables O(1) lookups.

This system powers the "Pages linking to this URL" and "Pages linking to this domain" features in the External Link Preview Modal.

## Architecture

### The Problem

Previously, when a user clicked an external link, we needed to show related pages that also link to the same URL or domain. This required:

1. Querying up to 500 pages from Firestore
2. Parsing the content of each page
3. Extracting all links from the content
4. Filtering for matching URLs/domains

This approach:
- Doesn't scale beyond a few thousand pages
- Is expensive in terms of Firestore reads
- Creates latency when loading the modal
- Can't reliably find all matches across millions of pages

### The Solution

We maintain a separate `externalLinks` collection that indexes all external links by:
- **URL** (for exact matches)
- **Domain** (for same-domain matches)
- **User ID** (for user-specific queries)

When a page is saved, we extract external links and update the index. Queries then run against this index instead of scanning pages.

## Data Model

### External Link Entry

```typescript
interface ExternalLinkEntry {
  id: string;           // Format: `${pageId}_${urlHash}`
  url: string;          // Full external URL
  domain: string | null; // Extracted hostname (e.g., "github.com")
  pageId: string;       // Source page ID
  pageTitle: string;    // Source page title
  userId: string;       // Page owner's user ID
  username: string;     // Page owner's username
  linkText: string;     // Display text of the link
  createdAt: string;    // When the link was first indexed
  lastModified: string; // Last modification timestamp
  isPublic: boolean;    // Whether the source page is public
}
```

### Collection Name

The collection name follows the environment-aware naming convention:
- **Production**: `externalLinks`
- **Development**: `DEV_externalLinks`

## Key Files

| File | Purpose |
|------|---------|
| `app/services/externalLinksIndexService.ts` | Core indexing service (server-side) |
| `app/firebase/database/links.ts` | Query functions (with index fallback) |
| `app/api/pages/route.ts` | Hooks indexing into page save/delete |
| `scripts/backfill-external-links.ts` | Backfill script for existing pages |
| `app/utils/environmentConfig.ts` | Collection name configuration |

## How It Works

### On Page Save

When a page is saved via `PUT /api/pages`:

1. Background operation extracts external links from content
2. All existing index entries for the page are deleted
3. New index entries are created for each unique external link
4. This runs in parallel with other background operations (non-blocking)

```typescript
// In app/api/pages/route.ts
const { updateExternalLinksIndex } = await import('../../services/externalLinksIndexService');
await updateExternalLinksIndex(
  pageId,
  pageTitle,
  userId,
  username,
  contentNodes,
  isPublic,
  lastModified
);
```

### On Page Delete

When a page is soft-deleted:

```typescript
// In app/api/pages/route.ts (DELETE handler)
const { removeExternalLinksForPage } = await import('../../services/externalLinksIndexService');
await removeExternalLinksForPage(pageId);
```

### On Query

When querying for pages that link to a URL:

1. Try the indexed query first (O(1))
2. If results found, return them
3. If no results or index fails, fall back to legacy scan (O(n))

```typescript
// In app/firebase/database/links.ts
export const findPagesLinkingToExternalUrl = async (url, limit) => {
  try {
    // Try indexed version first
    const indexedResults = await findPagesLinkingToExternalUrlIndexed(url, limit);
    if (indexedResults.length > 0) return indexedResults;
  } catch {
    // Fall back to legacy scan
  }
  // Legacy scan as fallback...
};
```

## Firestore Indexes Required

The following composite indexes are needed in Firestore:

```
Collection: externalLinks
Indexes:
  1. url (==), isPublic (==), lastModified (desc)
  2. domain (==), isPublic (==), lastModified (desc)
  3. userId (==), url (==), lastModified (desc)
  4. userId (==), domain (==), lastModified (desc)
  5. pageId (==) [for deletion queries]
```

These indexes enable efficient queries for:
- Pages linking to exact URL (global)
- Pages linking to same domain (global)
- User's pages linking to exact URL
- User's pages linking to same domain
- All entries for a page (for cleanup on delete)

## Backfill Process

For existing pages, run the backfill script:

```bash
# Dry run (preview only)
npx tsx scripts/backfill-external-links.ts --dry-run --env=prod

# Production backfill
npx tsx scripts/backfill-external-links.ts --env=prod

# Development backfill
npx tsx scripts/backfill-external-links.ts
```

The script:
1. Clears any existing index entries (in live mode)
2. Scans all pages in batches of 100
3. Extracts external links from each page's content
4. Creates index entries for each link
5. Reports statistics on completion

### Example Output

```
════════════════════════════════════════════════════════════
     BACKFILL: External Links Index
════════════════════════════════════════════════════════════
Environment: PRODUCTION
Pages collection: pages
External links collection: externalLinks
Mode: LIVE

🧹 Clearing existing external links index...
   ✅ Deleted 0 existing entries

📦 Processing batch 1...
   📝 abc123: "My Blog Post" has 3 external links
      → github.com: https://github.com/user/repo
      → twitter.com: https://twitter.com/user
   ✅ Indexed 150 external links
...

════════════════════════════════════════════════════════════
                      RESULTS
════════════════════════════════════════════════════════════
   Pages processed:          5,234
   Pages with external links: 1,456
   Pages skipped:             789
   External links indexed:    4,567
   Unique domains:            342
   Errors:                    0
────────────────────────────────────────────────────────────
   Sample domains indexed:
      • github.com
      • youtube.com
      • twitter.com
════════════════════════════════════════════════════════════

✅ Backfill complete!
```

## Performance Characteristics

### Before (O(n) Scan)

| Metric | Value |
|--------|-------|
| Pages scanned | Up to 500 per query |
| Firestore reads | 500 documents |
| Latency | 500ms - 2s |
| Scalability | Poor (limited to recent pages) |

### After (Indexed)

| Metric | Value |
|--------|-------|
| Index entries queried | Only matching entries |
| Firestore reads | Typically 1-10 documents |
| Latency | 50-100ms |
| Scalability | Excellent (millions of pages) |

## Graceful Degradation

The system is designed to gracefully handle edge cases:

1. **Index Not Yet Backfilled**: Falls back to legacy O(n) scan
2. **Index Query Fails**: Falls back to legacy scan with warning log
3. **No Matches in Index**: Falls back to verify (could be genuinely no matches)

This ensures the feature continues working during:
- Initial deployment before backfill
- Firestore index building
- Any temporary index issues

## API Reference

### updateExternalLinksIndex

```typescript
async function updateExternalLinksIndex(
  pageId: string,
  pageTitle: string,
  userId: string,
  username: string,
  content: EditorContent,
  isPublic: boolean,
  lastModified: string
): Promise<{ indexed: number; removed: number }>
```

### removeExternalLinksForPage

```typescript
async function removeExternalLinksForPage(
  pageId: string
): Promise<number>  // Returns count of removed entries
```

### findPagesLinkingToExternalUrlIndexed

```typescript
async function findPagesLinkingToExternalUrlIndexed(
  externalUrl: string,
  limitCount: number = 10
): Promise<ExternalLinkQueryResult[]>
```

### findUserPagesLinkingToExternalUrlIndexed

```typescript
async function findUserPagesLinkingToExternalUrlIndexed(
  externalUrl: string,
  userId: string
): Promise<ExternalLinkQueryResult[]>
```

## Monitoring

### Index Statistics

Use the admin stats endpoint or the service directly:

```typescript
const { getExternalLinksIndexStats } = await import('../../services/externalLinksIndexService');
const stats = await getExternalLinksIndexStats();
// Returns: { totalEntries, uniqueDomains, topDomains }
```

### Things to Monitor

1. **Index Size**: Total entries in `externalLinks` collection
2. **Fallback Rate**: How often legacy scan is used (check logs)
3. **Query Latency**: Time to load related pages in modal
4. **Backfill Status**: Whether all pages have been indexed

## Troubleshooting

### "Pages linking to this domain" not showing results

1. Check if backfill has been run for the environment
2. Verify Firestore indexes are created
3. Check if the domain is correctly extracted from URLs
4. Verify `isPublic` is set correctly on pages

### High latency on external link modal

1. Check if indexed queries are being used (no fallback warnings in logs)
2. Verify Firestore indexes are complete (not still building)
3. Check for very popular URLs with many entries

### Index out of sync

If the index becomes out of sync with actual page content:

1. Run the backfill script to rebuild
2. Script clears and rebuilds the entire index
3. Future saves will keep it in sync

## Future Improvements

1. **Real-time sync**: Use Firestore triggers for immediate consistency
2. **Analytics dashboard**: Show most linked domains, trending URLs
3. **Link validation**: Flag broken external links
4. **Domain grouping**: Group by top-level domain for better organization
