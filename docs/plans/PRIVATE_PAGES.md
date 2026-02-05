# Private Pages Roadmap

## Overview
Enable pages to be private - visible only to the author. A personal workspace for drafts, notes, or sensitive content that shouldn't be publicly accessible.

**Status**: Behind `private_pages` feature flag, subscribers only.

---

## Current State

The codebase has partial infrastructure:

| Component | Status | Location |
|-----------|--------|----------|
| `isPublic` field | Exists but decorative | Firestore rules allow all pages to be public |
| `VisibilityDropdown` | Orphaned (0 imports) | `app/components/utils/VisibilityDropdown.jsx` |

---

## User Value

- **Draft content before publishing** - Work on pages without public visibility
- **Personal notes** - Keep notes that link to public pages without exposing them
- **Private research** - Maintain research and reference material privately

---

## Implementation

### Phase 1: Foundation
- Add `private_pages` feature flag to `DEFAULT_FLAGS`
- Create `useSubscriberFeature` hook for subscription-gated features
- Update Firestore security rules to enforce `isPublic`

### Phase 2: UI Integration
- Wire `VisibilityDropdown` to page editor (for subscribers only)
- Add visibility toggle to `ContentPageHeader.tsx`
- Create `/api/pages/[id]/visibility` endpoint

### Phase 3: Filtering
- Filter private pages from public search results
- Filter private pages from global activity feed
- Filter private pages from leaderboards
- Show private pages to owner in their profile
- Exclude private pages from Typesense indexing

---

## Behavior Specification

### Search
- **Public search**: Excludes all pages where `isPublic === false`
- **Author's own search**: Includes their private pages
- **User profile tabs**: Owner sees their private pages, others don't

### Links
- **Private → Public**: Works normally (outbound links function)
- **Public → Private**: Shows "private page" placeholder for non-owners

### Activity Feeds
- **Global feed**: Excludes private page edits
- **Author's profile**: Includes their own private page edits

### Metrics
- **Leaderboards**: Private pages don't count toward rankings
- **Page counts**: Show separate public/private counts to owner
- **Earnings**: Private pages don't earn allocations

---

## Data Model

```typescript
interface PageData {
  // Existing fields...
  isPublic: boolean;  // Now enforced (default: true)
}
```

---

## Firestore Rules

```javascript
// Pages collection
match /pages/{pageId} {
  allow read: if
    // Author can always read their own pages
    (isAuthenticated() && resource.data.userId == request.auth.uid) ||
    // Others can only read public pages
    (resource.data.isPublic == true || !resource.data.keys().hasAny(['isPublic']));
}
```

---

## API Changes

### New Endpoint
`PATCH /api/pages/[id]/visibility`
```typescript
// Request
{ isPublic: boolean }

// Response
{ success: true, isPublic: boolean }
```

### Modified Endpoints
- `GET /api/search` - Add `isPublic` filter
- `GET /api/recent-edits/global` - Filter private pages
- Typesense sync - Exclude private pages

---

## UI Components

### VisibilityDropdown Changes
- Remove "Group" option (will be separate feature)
- Options: "Public" | "Private"
- Only shown to subscribers

### ContentPageHeader Changes
- Add visibility indicator for private pages
- Add toggle button for page owner (if subscriber)

---

## Open Questions

1. **Should private pages count toward earnings?**
   - Current decision: No - only public content earns

2. **Can private pages use all editor features?**
   - Yes - full editor functionality

3. **What about existing pages?**
   - All existing pages default to `isPublic: true`
   - No migration needed

---

## Related Documentation
- [Groups Roadmap](./GROUPS.md)
- [CSS Refactoring Plan](./CSS_REFACTORING.md)
- [Current Architecture](../architecture/CURRENT_ARCHITECTURE.md)
