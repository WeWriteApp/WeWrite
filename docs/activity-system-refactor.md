# Activity System Refactor: Pre-Computed Diff Architecture

## Overview

This document describes the major refactor of WeWrite's activity system from an on-demand diff calculation approach to a pre-computed diff data architecture. This change significantly improves performance, scalability, and maintainability.

## Previous Architecture (Problems)

### Old System Issues
- **Multiple Database Reads**: Required 3 reads per activity item (page + current version + previous version)
- **Complex Chain Dependencies**: Page → currentVersion → previousVersionId → previous version content
- **Poor Performance**: 20 activity items = 60 database reads
- **Not Scalable**: Exponentially expensive as activity feeds grow
- **Fragile Code**: Breaks if any link in the chain is missing

### Old Flow
```
Activity API Request
├── Read page document
├── Read current version document  
├── Read previous version document
├── Calculate diff on-demand
└── Return activity with computed diff
```

## New Architecture (Solutions)

### Key Principles
1. **Pre-compute diff data at write time**
2. **Store activity records in dedicated collection**
3. **Activity API serves pre-computed data only**
4. **Clean separation of concerns**

### New Flow
```
Page Save Operation
├── Calculate diff (current vs previous content)
├── Save new version
├── Create activity record with pre-computed diff
└── Store in activities collection

Activity API Request
├── Read from activities collection (1 query)
└── Return pre-computed activity data
```

## Implementation Details

### 1. Activities Collection Schema

```typescript
interface ActivityRecord {
  id?: string;
  pageId: string;
  pageName: string;
  userId: string;
  username: string;
  timestamp: Date;
  diff: {
    added: number;
    removed: number;
    hasChanges: boolean;
  };
  preview?: string;
  isPublic: boolean;
  isNewPage: boolean;
  versionId?: string;
}
```

### 2. Activity Service

**Location**: `app/services/activityService.ts`

**Key Methods**:
- `createActivity()`: Creates activity records with pre-computed diff data
- `getRecentActivities()`: Retrieves activities for feeds
- `getPageActivities()`: Gets activities for specific pages
- `getUserActivities()`: Gets activities for specific users

### 3. Page Save Integration

**Location**: `app/firebase/database/versions.ts`

**Process**:
1. Calculate diff between new and previous content
2. Save new version to versions collection
3. Create activity record with pre-computed diff data
4. Store activity in activities collection

### 4. Updated Activity API

**Location**: `app/api/activity/route.js`

**Changes**:
- Simplified to single query against activities collection
- Removed complex version chain traversal
- Added filtering for meaningful changes
- Maintained backward compatibility

### 5. Component Updates

**Updated Components**:
- `ActivityCard.tsx`: Uses pre-computed diff data with fallback
- `ActivityItem.js`: Uses pre-computed diff data with fallback  
- `RecentActivity.tsx`: Uses pre-computed hasChanges flag

**Backward Compatibility**: Components check for pre-computed diff data first, then fall back to client-side calculation if needed.

## Performance Improvements

### Database Reads
- **Before**: 3 reads per activity item (60 reads for 20 activities)
- **After**: 1 read per activity item (20 reads for 20 activities)
- **Improvement**: 67% reduction in database reads

### Response Time
- **Before**: Complex queries with multiple joins
- **After**: Simple collection query with pre-computed data
- **Improvement**: Significantly faster activity feed loading

### Scalability
- **Before**: O(n³) complexity (activities × versions × content)
- **After**: O(n) complexity (activities only)
- **Improvement**: Linear scaling instead of cubic

## Benefits

### 1. Performance
- **Faster API responses**: Single query vs multiple chained queries
- **Reduced database load**: 67% fewer reads
- **Better user experience**: Instant activity feed loading

### 2. Scalability
- **Linear scaling**: Performance doesn't degrade with more activities
- **Efficient queries**: Simple collection queries with indexes
- **Future-proof**: Can handle large activity volumes

### 3. Maintainability
- **Cleaner code**: Separation of concerns between content and activity
- **Easier debugging**: Clear data flow and single source of truth
- **Flexible**: Can change diff algorithms without affecting storage

### 4. Reliability
- **No broken chains**: Self-contained activity records
- **Consistent data**: Pre-computed at write time
- **Error resilience**: Activity creation doesn't break page saves

## Migration Strategy

### Phase 1: Implementation ✅
- [x] Create ActivityService with pre-computed diff logic
- [x] Update page save operations to create activity records
- [x] Refactor activity API to serve from activities collection
- [x] Update components with backward compatibility

### Phase 2: Validation ✅
- [x] Test activity creation during page saves
- [x] Verify API returns correct pre-computed data
- [x] Ensure no-op filtering works correctly
- [x] Confirm backward compatibility

### Phase 3: Optimization (Future)
- [ ] Create Firebase indexes for optimal query performance
- [ ] Implement activity retention policies
- [ ] Add activity analytics and insights
- [ ] Consider activity aggregation for high-volume users

## Technical Considerations

### Firebase Indexes Required
```json
{
  "collectionGroup": "activities",
  "fields": [
    {"fieldPath": "isPublic", "order": "ASCENDING"},
    {"fieldPath": "timestamp", "order": "DESCENDING"}
  ]
},
{
  "collectionGroup": "activities", 
  "fields": [
    {"fieldPath": "userId", "order": "ASCENDING"},
    {"fieldPath": "timestamp", "order": "DESCENDING"}
  ]
}
```

### Error Handling
- Activity creation failures don't break page saves
- Graceful fallback to client-side diff calculation
- Comprehensive logging for debugging

### Data Consistency
- Activity records created atomically with version saves
- Skip activity creation for no-op edits (configurable)
- Preserve activity data even if page content changes

## Future Enhancements

### 1. Activity Analytics
- Track user engagement with activities
- Identify popular content and authors
- Generate activity-based recommendations

### 2. Real-time Updates
- WebSocket integration for live activity feeds
- Push notifications for followed users
- Real-time collaboration indicators

### 3. Advanced Filtering
- Filter by content type, tags, or categories
- Time-based filtering (last hour, day, week)
- User-specific activity preferences

### 4. Activity Aggregation
- Daily/weekly activity summaries
- Trending content identification
- User activity streaks and achievements

## Conclusion

The activity system refactor represents a significant architectural improvement that addresses performance, scalability, and maintainability concerns. By pre-computing diff data and storing it in a dedicated collection, we've created a system that:

- **Scales linearly** instead of exponentially
- **Performs 67% fewer database reads**
- **Provides instant activity feed loading**
- **Maintains clean separation of concerns**
- **Enables future enhancements**

This foundation supports WeWrite's growth while providing users with a fast, reliable activity experience.
