# WeWrite Version System Documentation

## Overview

WeWrite uses a **unified version system** to track all page edits and changes. This system replaces the previous fragmented approach of having separate `activities`, `edits`, `history`, and `versions` collections.

## Architecture

### Single Source of Truth: Page Versions

All page changes are tracked in subcollections under each page:

```
pages/{pageId}/versions/{versionId}
```

### Version Document Structure

```typescript
interface PageVersion {
  id: string;                    // Auto-generated version ID
  content: string;               // Full page content as JSON string
  title?: string;                // Page title at time of edit
  createdAt: string;             // ISO timestamp of when version was created
  userId: string;                // ID of user who made the edit
  username: string;              // Username of editor
  previousVersionId?: string;    // ID of the previous version (for linking)
  groupId?: string;              // Group ID if page belongs to a group
  
  // Diff metadata (computed during save)
  diff?: {
    added: number;               // Characters added
    removed: number;             // Characters removed
    hasChanges: boolean;         // Whether this version has meaningful changes
  };
  
  // Rich diff preview for UI display
  diffPreview?: {
    beforeContext: string;       // Text before changes
    addedText: string;          // Text that was added
    removedText: string;        // Text that was removed
    afterContext: string;       // Text after changes
    hasAdditions: boolean;      // Whether there are additions
    hasRemovals: boolean;       // Whether there are removals
  };
  
  // Metadata
  isNewPage?: boolean;          // True if this is the first version (page creation)
  isNoOp?: boolean;            // True if this version has no meaningful changes
}
```

## Usage Patterns

### 1. Homepage Recent Edits
- **Query**: Recent versions across all pages
- **Sort**: By `createdAt` descending
- **Filter**: By user permissions, time range, following status
- **Display**: Activity cards showing diff previews

### 2. Page-Specific Recent Edits (Sparkline)
- **Query**: Versions for specific page
- **Aggregate**: Count versions by time buckets (hourly for 24h)
- **Display**: Sparkline chart + recent activity count

### 3. Page Version History
- **Query**: All versions for specific page
- **Sort**: By `createdAt` descending
- **Display**: Timeline of all edits with diff previews

### 4. Version Comparison
- **Query**: Two specific versions by ID
- **Process**: Generate detailed diff between versions
- **Display**: Side-by-side or unified diff view

## API Endpoints

### Core Version APIs
- `GET /api/pages/{pageId}/versions` - Get all versions for a page with pagination
- `GET /api/pages/{pageId}/versions/{versionId}` - Get specific version with navigation context
- `POST /api/pages/{pageId}/versions` - Create new version (internal)

### Version Detail API Features
The individual version endpoint provides:
- Complete version data with content and metadata
- Previous version information for navigation
- Next version information for navigation
- Page context (title, ID)
- Proper permission checking with admin support

### Derived APIs (using versions)
- `GET /api/recent-edits` - Recent edits across all pages (uses versions)
- `GET /api/pages/{pageId}/activities` - Page-specific recent edits (uses versions)

## Implementation Guidelines

### When to Create Versions

1. **Page Creation**: Always create initial version
2. **Content Changes**: Create version when content differs meaningfully
3. **Title Changes**: Create version when title changes
4. **No-Op Detection**: Skip version creation for trivial changes (whitespace, etc.)

### Version Creation Process

1. **Compute Diff**: Compare new content with previous version
2. **Generate Preview**: Create rich diff preview for UI
3. **Store Version**: Save complete version document
4. **Update Page**: Update page's `lastModified` and version metadata

### Performance Considerations

1. **Pagination**: Always paginate version queries
2. **Caching**: Cache recent versions for frequently accessed pages
3. **Cleanup**: Consider archiving very old versions (>1 year)
4. **Indexing**: Index on `createdAt` for time-based queries

## Migration Plan

### Phase 1: Fix Version Creation ✅
- Ensure versions are created on every page save
- Add proper diff computation and preview generation

### Phase 2: Update Recent Edits APIs ✅
- Modify `/api/recent-edits` to use versions instead of activities
- Update page-specific recent edits to use versions

### Phase 3: Migrate Existing Data ✅
- Convert existing activities to version format
- Backfill missing versions where possible

### Phase 4: Cleanup ✅
- Remove activities collection
- Remove references to old systems
- Update all documentation

### Phase 5: Production Backfill ✅
- Backfill missing versions for existing pages
- Create version entries for pages without version history
- Ensure all pages have proper version tracking

## Benefits of Unified System

1. **Consistency**: Single data model for all edit tracking
2. **Flexibility**: Rich metadata supports multiple use cases
3. **Performance**: Optimized queries and caching strategies
4. **Maintainability**: One system to understand and debug
5. **Extensibility**: Easy to add new features like version comparison

## Code Examples

### Creating a Version
```typescript
const versionData = {
  content: JSON.stringify(pageContent),
  title: pageTitle,
  createdAt: new Date().toISOString(),
  userId: currentUserId,
  username: currentUsername,
  previousVersionId: lastVersionId,
  diff: diffResult,
  diffPreview: previewData,
  isNewPage: !lastVersionId
};

await db.collection('pages').doc(pageId)
  .collection('versions').add(versionData);
```

### Querying Recent Versions
```typescript
const recentVersions = await db.collectionGroup('versions')
  .where('createdAt', '>=', twentyFourHoursAgo)
  .orderBy('createdAt', 'desc')
  .limit(50)
  .get();
```


## ✅ Migration Complete!

The unified version system has been successfully implemented:

- ✅ **Version Creation**: All page saves now create versions
- ✅ **API Migration**: Recent edits APIs use versions instead of activities  
- ✅ **Data Migration**: Existing activities migrated to version format
- ✅ **Legacy Cleanup**: Activities collection references removed
- ✅ **Documentation**: Updated to reflect new system

### Current System Status

The WeWrite application now uses a single, unified version system for all page edit tracking:

- **Single Source of Truth**: `pages/{pageId}/versions` subcollections
- **Consistent Data Model**: All versions follow the same schema
- **Performance Optimized**: Efficient queries and caching
- **Future Ready**: Easy to extend with new features
- **Complete API Coverage**: Full CRUD operations with proper authentication
- **Production Ready**: Backfilled historical data and tested in production

### Next Steps

1. **Monitor Performance**: Watch for any performance issues with the new system
2. **Add Features**: Consider implementing version comparison, rollback, etc.
3. **Archive Old Data**: Consider archiving very old activities after verification
4. **Optimize Queries**: Add indexes as needed for better performance

