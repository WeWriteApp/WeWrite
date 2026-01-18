# Search Architecture

This document outlines the current search implementation, known limitations, and future architecture options for WeWrite's search functionality.

---

## Table of Contents

1. [Current Implementation](#current-implementation)
2. [Known Limitations](#known-limitations)
3. [Alternative Options](#alternative-options)
4. [Recommended Path Forward](#recommended-path-forward)
5. [Implementation Checklist](#implementation-checklist)

---

## Current Implementation

### Status: **Production** (Typesense + Firestore fallback)

### Architecture Overview

```
User Input
    |
    v
[useUnifiedSearch Hook] --> /api/search-unified
    |
    v
+---------------------------+
|   Engine 1: Typesense     |  <-- Primary search engine
|   Fast, typo-tolerant     |      Full-text search with typo tolerance
+---------------------------+
    | (on failure/not configured)
    v
+---------------------------+
|   Engine 2: Firestore     |  <-- Fallback (slow but reliable)
|   Prefix + client scan    |      Scans up to 1500 recent docs
+---------------------------+
    |
    v
[Score & Rank Results] --> Return to Client
```

### Search Engine Fallback Chain

The unified search implements a waterfall fallback pattern:

1. **Typesense** (Primary) - Fast, open-source search engine with typo tolerance
   - Uses Typesense Cloud instance
   - Falls back if: not configured, service unavailable

2. **Firestore** (Fallback) - Built-in database search
   - Prefix queries + client-side filtering
   - Always available but slower

### Key Files

| File | Purpose |
|------|---------|
| `app/api/search-unified/route.ts` | Main search API endpoint with fallback chain |
| `app/hooks/useUnifiedSearch.ts` | Client-side search hook with debouncing |
| `app/lib/typesense.ts` | Typesense client configuration |
| `app/lib/typesenseSync.ts` | Typesense sync service for page updates |
| `app/api/typesense/sync/route.ts` | Typesense batch sync API |
| `app/api/typesense/sync-page/route.ts` | Typesense single page sync API |
| `app/utils/searchCache.ts` | Multi-tier caching system |
| `app/utils/searchUtils.ts` | Shared search utilities |

### Current Features

- **Prefix matching** via Firestore range queries (`>=`, `<=`)
- **Case-insensitive search** via multiple case variation queries
- **Substring matching** via client-side filtering (Phase 2)
- **Result scoring** based on match type (exact, prefix, contains, word boundary)
- **Caching** with configurable TTL (5-15 minutes)
- **Batch username fetching** to avoid N+1 queries

### Search Scoring Algorithm

| Match Type | Title Score | Content Score |
|------------|-------------|---------------|
| Exact match | 100 | 80 |
| Starts with | 95 | 75 |
| Contains substring | 80 | 60 |
| All words found (exact) | 75 | 55 |
| All words found (substring) | 70 | 50 |
| Sequential word match | 65 | 45 |
| Partial word match | 50 | 35 |

---

## Known Limitations

### Critical Issues

| Issue | Impact | Status |
|-------|--------|--------|
| **Cannot search ALL documents** | May miss results if >1500 pages exist | **Architectural limitation** |
| **No fuzzy/typo tolerance** | "merch" won't match "merchandise" typos | **Pending decision** |
| **Firestore prefix-only queries** | "merch" won't find "WeWrite Merch" via fast path | **Mitigated with Phase 2** |
| **Performance degrades with scale** | Scanning 1500+ docs per search is expensive | **Needs architectural change** |

### Why Firestore Can't Do Full-Text Search

Firestore only supports:
- Equality (`==`)
- Range queries (`<`, `<=`, `>=`, `>`)
- Array contains (`array-contains`, `array-contains-any`)

It does **NOT** support:
- `LIKE` or `CONTAINS` operators
- Full-text search indexes
- Fuzzy matching
- Relevance ranking

**Google's official recommendation**: Use a third-party search service.

---

## Alternative Options

### Current: Typesense (Cloud) ✅ IMPLEMENTED

**Overview**: Open-source search engine focused on simplicity and speed.

**Status**: Implemented as PRIMARY search engine.

**Implementation Files**:
- `app/lib/typesense.ts` - Client configuration and search functions
- `app/lib/typesenseSync.ts` - Real-time sync service
- `app/api/typesense/sync/route.ts` - Batch sync API
- `app/api/typesense/sync-page/route.ts` - Single page sync API

**Environment Variables Required**:
```
NEXT_PUBLIC_TYPESENSE_HOST=xxx.typesense.net
NEXT_PUBLIC_TYPESENSE_PORT=443
NEXT_PUBLIC_TYPESENSE_PROTOCOL=https
NEXT_PUBLIC_TYPESENSE_SEARCH_KEY=your-search-key
TYPESENSE_ADMIN_KEY=your-admin-key (server-side only)
```

**Collections**:
- `pages` / `DEV_pages` - Page documents with title, content, author info
- `users` / `DEV_users` - User documents with username, display name

**Pros**:
- Open source
- Very fast (<50ms typical)
- Typo tolerance
- Environment-aware collections (DEV_ prefix in development)
- Graceful fallback when not configured
- Cost-effective compared to Algolia

**Cons**:
- Smaller community than Algolia
- Fewer features than Algolia

---

### Alternative: DIY `titleWords` Array (No External Service)

**Overview**: Store searchable words as an array field, query with `array-contains`.

**Implementation**:
```javascript
// On page create/update:
const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 1);
await updateDoc(pageRef, { titleWords });

// On search:
const q = query(
  collection(db, 'pages'),
  where('titleWords', 'array-contains', searchTerm.toLowerCase())
);
```

**Pros**:
- **No external service**
- Uses Firestore indexes (fast, scalable)
- No additional cost
- Simple to implement

**Cons**:
- **Only exact word matches**: "mer" won't find "merch"
- **No typo tolerance**
- **No relevance ranking** (Firestore returns unordered)
- **Requires data migration** for existing pages
- **Storage overhead**: Extra field on every document

**Best for**: MVP or apps where exact word matching is acceptable.

---

### Option 5: Firebase Data Connect (PostgreSQL)

**Overview**: Firebase's newer service that uses PostgreSQL backend with `@searchable` directive.

**Pros**:
- Native Firebase integration
- Full-text search via PostgreSQL
- No external service management

**Cons**:
- **Requires data architecture migration**
- **Relatively new service** (less battle-tested)
- **Different data model** than Firestore

**Best for**: New projects or those already planning a backend migration.

---

## Recommended Path Forward

### Short-Term (Now)
**Status**: Implemented

Current mitigations in place:
- [x] Comprehensive client-side search (Phase 2) catches substring matches
- [x] Fallback search by `createdAt` for older pages
- [x] Batch username fetching eliminates N+1 queries
- [x] Multi-tier caching reduces repeated queries
- [x] Result scoring prioritizes better matches

### Medium-Term (Recommended)
**Status**: Pending Decision

Implement `titleWords` array approach:
- [ ] Add `titleWords` field to page schema
- [ ] Create Cloud Function to generate `titleWords` on page create/update
- [ ] Write migration script for existing pages
- [ ] Update search API to use `array-contains` queries
- [ ] Remove client-side scanning

**Benefits**:
- Searches ALL documents via Firestore index
- No external service dependency
- Scales infinitely
- Fast queries

**Trade-offs**:
- Only exact word matching (no fuzzy search)
- Requires migration

### Long-Term (If Needed)
**Status**: Future Consideration

If search requirements grow:
- [ ] Enhance Typesense with synonyms, faceted search, or geo-search
- [ ] Consider user search analytics to understand needs
- [ ] Evaluate Elasticsearch for advanced use cases if needed

---

## Implementation Checklist

### Current Implementation (Done)
- [x] Unified search API (`/api/search-unified`)
- [x] Client-side hook (`useUnifiedSearch`)
- [x] Prefix matching with case variations
- [x] Comprehensive client-side search fallback
- [x] Result scoring and ranking
- [x] Caching with configurable TTL
- [x] Batch username fetching
- [x] Performance monitoring

### `titleWords` Implementation (To-Do)
- [ ] Define `titleWords` field in Firestore schema
- [ ] Create Cloud Function trigger for page writes
- [ ] Write one-time migration script
- [ ] Update search API to use `array-contains`
- [ ] Add search for alternative titles (`alternativeTitleWords`)
- [ ] Update tests
- [ ] Deploy and monitor

### Search Enhancements (Future)
- [ ] Add synonyms support in Typesense
- [ ] Implement faceted search for filtering
- [ ] Add geo-search capabilities
- [ ] Monitor and optimize search performance
- [ ] Consider search analytics dashboard

---

## Related Documentation

- [Firebase Full-Text Search Guide](https://firebase.google.com/docs/firestore/solutions/search)
- [Typesense Documentation](https://typesense.org/docs/)
- [Firebase Data Connect](https://firebase.google.com/docs/data-connect)

---

*Last updated: January 2026*
