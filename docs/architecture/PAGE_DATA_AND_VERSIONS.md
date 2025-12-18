# WeWrite Page Data & Version System Documentation

**🏛️ AUTHORITATIVE SOURCE**: This document is the final authority on page data structure and version system architecture.

## Overview

WeWrite uses a **unified page data and version system** with consistent data structures across all storage and retrieval operations. This system defines:

1. **Page Data Structure**: How content is stored in the main pages collection
2. **Version System**: How page edits and changes are tracked
3. **Content Format**: Standardized Slate.js node arrays (never JSON strings)

This replaces all previous fragmented approaches and serves as the single source of truth.

## Page Data Structure

### Main Page Document

All pages are stored in the `pages` collection with this exact structure:

```typescript
interface PageData {
  // Core identifiers
  id: string;                    // Auto-generated page ID
  title: string;                 // Page title
  content: SlateNode[];          // CRITICAL: Always Slate.js node array, NEVER JSON string

  // User information
  userId: string;                // ID of page owner
  username: string;              // Username of page owner

  // Timestamps
  createdAt: string;             // ISO timestamp of page creation
  lastModified: string;          // ISO timestamp of last edit

  // Organization
  groupId?: string | null;       // Group ID if page belongs to a group

  // Location data
  location?: {
    lat: number;
    lng: number;
  } | null;

  // Status
  deleted: boolean;              // Whether page is deleted
  deletedAt?: string;            // ISO timestamp of deletion

  // Custom fields
  customDate?: string | null;    // Custom date for daily notes

  // Version tracking
  currentVersion?: string;       // ID of current version in subcollection

  // Metadata
  lastViewed?: any;              // Firestore timestamp of last view
  viewCount?: number;            // Total view count
}
```

### Content Format (CRITICAL)

**✅ CORRECT**: Content is stored as Slate.js node arrays
```typescript
content: [
  {
    type: "paragraph",
    children: [
      { text: "Hello world" }
    ]
  }
]
```

**❌ WRONG**: Content stored as JSON string (causes display bugs)
```typescript
content: "[{\"type\":\"paragraph\",\"children\":[{\"text\":\"Hello world\"}]}]"
```

### Slate.js Node Structure

```typescript
interface SlateNode {
  type: string;                  // Node type: "paragraph", "heading", "link", etc.
  children?: SlateNode[];        // Child nodes (for containers)
  text?: string;                 // Text content (for text nodes)
  [key: string]: any;           // Additional properties (url, level, etc.)
}
```

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
  content: any[];                // Full page content as Slate.js node array
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
  content: pageContent,  // Store as Slate.js node array, NOT string
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


## ⚠️ CRITICAL: Old Patterns That Must Be Deleted

### 🚨 Dangerous Legacy Code - DELETE IMMEDIATELY

The following patterns are **DEPRECATED** and **MUST BE DELETED** from the codebase:

#### 1. Direct Activities Collection Access
```typescript
// ❌ DELETE THIS - Old activities collection approach
db.collection('activities').add(...)
db.collection('DEV_activities').where(...)
```

#### 2. Old Recent-Edits API Patterns
```typescript
// ❌ DELETE THIS - Old recent-edits implementation
db.collection('pages').where('deleted', '!=', true).orderBy('lastModified', 'desc')
// Should use: db.collectionGroup('versions').orderBy('createdAt', 'desc')
```

#### 3. Manual Activity Creation
```typescript
// ❌ DELETE THIS - Manual activity creation
const activityData = { pageId, userId, type: 'edit', ... };
await db.collection('activities').add(activityData);
```

#### 4. Old API Endpoints
- ❌ `/api/activity` - Should be deleted
- ❌ `/api/recent-edits` using pages collection - Should use versions
- ❌ Any endpoint querying activities collection directly

### 🔍 How to Identify Legacy Code

Search for these patterns and **DELETE THEM**:
```bash
# Find dangerous legacy patterns
grep -r "collection('activities')" app/
grep -r "collection('DEV_activities')" app/
grep -r "getCollectionName('activities')" app/
grep -r "recent-edits.*pages.*lastModified" app/
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

## 🏛️ **AUTHORITATIVE STATUS**

**This document is the FINAL AUTHORITY on:**
- Page data structure and storage format
- Version system architecture and implementation
- Content format standards (Slate.js arrays, never JSON strings)
- Database schema for pages and versions

**All code must conform to the specifications in this document.**

**When in doubt, this document takes precedence over:**
- Code comments
- Other documentation files
- Legacy implementations
- Informal discussions

**For any changes to page data structure or version system:**
1. Update this document FIRST
2. Then implement the changes in code
3. Update related documentation to reference this document

## 📚 **Related Documentation**

- **[CONTENT_DISPLAY_ARCHITECTURE.md](CONTENT_DISPLAY_ARCHITECTURE.md)** - UI components for displaying content
- **[SIMPLIFIED_ACTIVITY_SYSTEM.md](SIMPLIFIED_ACTIVITY_SYSTEM.md)** - Activity system built on versions
- **[RECENT_EDITS_SYSTEM.md](RECENT_EDITS_SYSTEM.md)** - Recent edits system using versions

