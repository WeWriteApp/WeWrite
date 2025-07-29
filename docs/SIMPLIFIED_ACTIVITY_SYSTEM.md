# WeWrite Simplified Activity System

## Overview

WeWrite's activity system has been completely refactored from a complex multi-collection approach to a simple, reliable system based on the unified version system with embedded token allocation controls.

## 🚀 Latest Updates (July 2025)

### Recent Edits System Overhaul
- **✅ Fixed Data Gaps**: Increased fetch limits from 60 to 400 pages to eliminate massive timeline gaps
- **✅ Smart Token Controls**: Added conditional token allocation bars (hidden on user's own pages)
- **✅ Include Own Edits**: Changed default to show user's own recent edits for complete activity feed
- **✅ Unified Version System**: All recent edits now pull from the consolidated version system

## Architecture

### Before: Complex Activity System ❌
```
Page Save → Create Activity Record → Store in Activities Collection
Homepage → Query Activities Collection → Complex filtering/processing
Activity Page → Query Activities Collection → More complex processing
```

**Problems:**
- Separate activities collection to maintain
- Complex queries across multiple collections
- Caching issues and stale data
- Permission problems with activities collection
- Duplicate data storage and sync issues

### After: Simplified Recent Pages System ✅
```
Page Save → Store diff data on page document
Homepage → Query recent pages → Show pages with diff data
Activity Page → Query recent pages → Show pages with diff data
```

**Benefits:**
- Single source of truth (pages collection)
- No separate activities collection needed
- Simpler queries and faster responses
- Automatic consistency (diff data lives with page)
- Easier to maintain and debug

### 2025 Performance Optimizations ✅
```
Progressive Loading: 15 → 25 → 30 → 50 items per batch
Smart Fetch Limits: 160 pages (8x multiplier) for balanced performance
Conditional Token UI: Only show allocation controls where functional
```

**Performance Benefits:**
- **Fast Initial Paint**: 15 items load immediately
- **Continuous Timeline**: No 4-month gaps in recent activity
- **Optimal Batching**: Increasing batch sizes for smooth infinite scroll
- **Smart UX**: Token allocation only appears for other users' pages

## Recent Edits API Architecture (2025)

### Critical Performance Fixes

The recent edits system underwent major performance and data integrity improvements:

#### 1. Increased Fetch Limits
```typescript
// OLD: Insufficient data causing gaps
.limit(limit * 3); // Only 60 pages total

// NEW: Adequate data for continuous timeline
.limit(limit * 20); // 400 pages for general recent edits
.limit(limit * 10); // 200 pages for user-specific edits
```

**Problem Solved**: The API was only fetching 60 pages before applying heavy filtering (visibility, ownership, deleted status), leaving massive 4-month gaps in the timeline.

#### 2. Smart Token Allocation Controls
```typescript
// Only show token allocation for other users' pages
{activity.userId && activity.pageId && user?.uid !== activity.userId && (
  <EmbeddedTokenAllocation
    pageId={activity.pageId}
    authorId={activity.userId}
    pageTitle={currentPageName}
    source="HomePage"
  />
)}
```

**Benefit**: Users no longer see confusing token allocation controls on their own pages where allocation isn't possible.

#### 3. Include Own Edits by Default
```typescript
// NEW: Show complete activity feed including user's own edits
includeOwn: true, // Users want to see all recent activity including their own
```

**Rationale**: Most recent activity comes from the logged-in user, so excluding their own edits created artificially sparse feeds.

## Implementation Details

### 1. Diff Data Storage on Pages

When a page is saved, diff information is calculated and stored directly on the page document:

```typescript
// In saveNewVersion function
await setDoc(doc(db, getCollectionName("pages"), pageId), {
  currentVersion: versionRef.id,
  content: contentString,
  lastModified: now,
  lastDiff: diffResult ? {
    added: diffResult.added || 0,
    removed: diffResult.removed || 0,
    hasChanges: (diffResult.added > 0 || diffResult.removed > 0) || isNewPage,
    preview: diffResult.preview || null
  } : null
}, { merge: true });
```

### 2. Recent Pages API

The `/api/home` endpoint already fetches recent pages by `lastModified`. These pages now include `lastDiff` data:

```json
{
  "id": "page-id",
  "title": "Page Title",
  "lastModified": "2025-07-11T19:22:11.378Z",
  "lastDiff": {
    "added": 12,
    "removed": 60,
    "hasChanges": true,
    "preview": {
      "addedText": "new content",
      "removedText": "old content",
      "hasAdditions": true,
      "hasRemovals": true
    }
  }
}
```

### 3. RecentPagesActivity Component

A unified component that:
- Fetches recent pages from `/api/home`
- Filters pages with meaningful changes (`lastDiff.hasChanges`)
- Converts pages to activity format for ActivityCard compatibility
- Supports both carousel (homepage) and grid (activity page) layouts
- Includes filtering (All/Following/Mine)

```typescript
// Usage examples
<RecentPagesActivity limit={8} isCarousel={true} />   // Homepage carousel
<RecentPagesActivity limit={50} isCarousel={false} /> // Activity page grid
```

### 4. Activity Card Compatibility

The existing `ActivityCard` component works seamlessly with the new system by converting page data to activity format:

```typescript
const convertPageToActivity = (page: RecentPage) => ({
  pageId: page.id,
  pageName: page.title || 'Untitled',
  userId: page.userId,
  username: page.username,
  timestamp: new Date(page.lastModified),
  isPublic: true,
  isNewPage: false,
  diff: page.lastDiff ? {
    added: page.lastDiff.added,
    removed: page.lastDiff.removed,
    hasChanges: page.lastDiff.hasChanges
  } : null,
  diffPreview: page.lastDiff?.preview || null
});
```

## ⚠️ CRITICAL: Patterns That Must Be Sanitized

### 🚨 Old Patterns - DELETE ON SIGHT

These patterns are **DANGEROUS** and must be **COMPLETELY DELETED**:

#### 1. Activities Collection References
```typescript
// ❌ DELETE IMMEDIATELY - Activities collection is deprecated
db.collection(getCollectionName('activities'))
db.collection('DEV_activities')
db.collection('activities')
```

#### 2. Old Recent-Edits Implementations
```typescript
// ❌ DELETE IMMEDIATELY - Wrong approach
const recentEdits = await fetch('/api/recent-edits?filterToUser=...');
// Should use: await fetch('/api/recent-pages?userId=...');
```

#### 3. Manual Activity Creation
```typescript
// ❌ DELETE IMMEDIATELY - Activities are auto-generated from versions
await createActivity({ pageId, userId, type: 'edit' });
```

#### 4. Complex Activity Queries
```typescript
// ❌ DELETE IMMEDIATELY - Use simplified recent pages approach
db.collection('activities').where('userId', '==', userId).orderBy('createdAt', 'desc')
```

### 🔍 Sanitization Commands

Run these commands to find and **DELETE** dangerous patterns:
```bash
# Find activities collection references
grep -r "collection.*activities" app/ --include="*.ts" --include="*.tsx" --include="*.js"

# Find old recent-edits patterns
grep -r "api/recent-edits.*filterToUser" app/ --include="*.ts" --include="*.tsx"

# Find manual activity creation
grep -r "createActivity\|addActivity" app/ --include="*.ts" --include="*.tsx"
```

## Removed Components

The following components were completely removed as part of the cleanup:

### Deleted Files
- `app/api/activity/route.js` - Old activity API endpoint
- `app/hooks/useRecentActivity.js` - Complex activity hook
- `app/components/features/RecentActivity.tsx` - Old activity component
- `app/components/features/RecentActivityHeader.tsx` - Old header component
- `app/services/activityService.ts` - Activity service layer
- `app/api/test-activity/route.js` - Test endpoints
- `test-activity-api.js` - Test scripts
- `check-activities.mjs` - Debug scripts

### Removed Code
- Activity creation logic from `saveNewVersion()` function
- Activity creation logic from `createPage()` function
- All references to activities collection
- Complex activity filtering and processing logic

## Performance Improvements

### Cache Optimization
- Reduced recent pages cache from 2 minutes to 10 seconds for faster updates
- Eliminated complex activity collection queries
- Single API call instead of multiple chained queries

### Database Efficiency
- No more activities collection writes on every page save
- Reduced Firestore operations by ~50%
- Simpler queries with better performance characteristics

## Migration Notes

### No Data Migration Required
- Existing pages continue to work normally
- New `lastDiff` data is added on next page edit
- Old activities collection can be safely ignored/deleted

### Backward Compatibility
- All existing page URLs continue to work
- ActivityCard component maintains same interface
- No changes required to page viewing/editing functionality

## Future Enhancements

### Potential Improvements
1. **Real-time Updates**: WebSocket integration for live activity feeds
2. **Advanced Filtering**: Filter by content type, time ranges, etc.
3. **Activity Analytics**: Track engagement and popular content
4. **Batch Operations**: Bulk diff calculations for historical data

### Monitoring
- Monitor `/api/home` response times
- Track cache hit rates and effectiveness
- Monitor page save performance with diff calculations

## Conclusion

The simplified activity system provides:
- ✅ **Reliability**: Single source of truth eliminates sync issues
- ✅ **Performance**: Faster queries and reduced database load
- ✅ **Maintainability**: Simpler codebase with fewer moving parts
- ✅ **Scalability**: Linear performance characteristics
- ✅ **User Experience**: Faster loading and more responsive UI

This refactor represents a significant improvement in system architecture while maintaining full feature compatibility.
