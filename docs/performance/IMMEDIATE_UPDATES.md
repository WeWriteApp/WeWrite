# WeWrite Immediate Updates Documentation

## Critical Requirement: Immediate Page Updates After Save

**PRIORITY: HIGHEST** - Page updates must be visible immediately after clicking save, not after 30-60 seconds.

## Problem Statement

Previously, page updates were taking 30-60 seconds to appear due to aggressive caching at multiple layers:
- Unified cache: 30-60 second TTL
- API response headers: 5-30 minute cache headers
- Page cache: 10-30 minute TTL
- Client-side fetch: 30 second cache-control headers

This created a poor user experience where users would save changes and not see them reflected immediately.

## Solution: Multi-Layer Cache Optimization

### 1. Server Cache TTL Reduction
**File**: `app/utils/serverCache.ts`
```typescript
const CACHE_TTL = {
  FAST: process.env.NODE_ENV === 'development' ? 5 * 1000 : 10 * 1000, // 5s dev, 10s prod
  SLOW: process.env.NODE_ENV === 'development' ? 30 * 1000 : 60 * 1000, // 30s dev, 1min prod
}
```

### 2. Pages List Cache TTL Reduction
**File**: `app/utils/pagesListCache.ts`
```typescript
private readonly HOT_TTL = 10 * 1000;         // 10 seconds - IMMEDIATE UPDATES
private readonly WARM_TTL = 30 * 1000;        // 30 seconds - FAST UPDATES
private readonly COLD_TTL = 60 * 1000;        // 1 minute - QUICK UPDATES
```

### 3. API Response Headers Optimization
**File**: `app/api/pages/[id]/route.ts`
```typescript
// Development: 5s browser, 10s CDN
response.headers.set('Cache-Control', 'public, max-age=5, s-maxage=10');

// Production: 10s browser, 30s CDN  
response.headers.set('Cache-Control', 'public, max-age=10, s-maxage=30, stale-while-revalidate=60');
```

### 4. Client-Side Fetch Headers
**File**: `app/firebase/database/pages.ts`
```typescript
const response = await fetch(`/api/pages/${pageId}`, {
  headers: {
    'Cache-Control': 'no-cache', // No caching for immediate updates
  }
});
```

## Cache Invalidation Strategy

### Immediate Invalidation After Save
Every page save operation triggers immediate cache invalidation:

1. **Version Save** (`app/firebase/database/versions.ts`)
2. **Page Update** (`app/components/pages/PageView.tsx`)  
3. **API Routes** (`app/api/pages/[id]/versions/route.ts`)

All call `invalidatePageData(pageId, userId)` which clears:
- Unified cache entries
- Page cache entries  
- Recent edits cache
- User-specific caches

## Testing Immediate Updates

### Manual Testing Steps
1. Open a page in edit mode
2. Make a change to the content
3. Click "Save" 
4. **EXPECTED**: Changes appear immediately (within 1-2 seconds)
5. **FAILURE**: If changes take >10 seconds, investigate caching

### Automated Testing
```typescript
// Test immediate update visibility
test('page updates appear immediately after save', async () => {
  const originalContent = await getPageContent(pageId);
  const newContent = originalContent + ' UPDATED';
  
  await savePage(pageId, newContent);
  
  // Should see update within 2 seconds
  const updatedContent = await getPageContent(pageId);
  expect(updatedContent).toBe(newContent);
});
```

## Performance vs Immediacy Trade-off

### Previous (Slow Updates, Low Cost)
- 30-60 second cache TTL
- 5-30 minute API cache headers
- Fewer database reads
- Poor user experience

### Current (Immediate Updates, Moderate Cost)  
- 5-10 second cache TTL
- 10-30 second API cache headers
- More database reads (but still cached)
- Excellent user experience

## Monitoring & Alerts

### Key Metrics to Monitor
1. **Update Latency**: Time from save to visible update
2. **Cache Hit Rates**: Should remain >80% despite shorter TTL
3. **Database Read Costs**: Monitor for significant increases
4. **User Experience**: Feedback on update responsiveness

### Alert Thresholds
- **CRITICAL**: Update latency >10 seconds
- **WARNING**: Cache hit rate <70%
- **INFO**: Database read cost increase >50%

## Future Optimizations

### Real-time Updates (Future)
Consider WebSocket or Server-Sent Events for truly real-time updates without any caching delays.

### Smart Cache Invalidation (Future)
Implement more granular cache invalidation based on content change types.

### Edge Cache Optimization (Future)
Optimize CDN/edge caching while maintaining immediate updates for the page author.

## Maintenance Guidelines

### When Adding New Caching
1. **Always consider immediate updates** - default to shorter TTL
2. **Test save-to-visible latency** before deploying
3. **Document cache behavior** in code comments
4. **Implement proper invalidation** for all new caches

### When Debugging Slow Updates
1. Check unified cache TTL settings
2. Verify API response cache headers
3. Confirm cache invalidation is working
4. Test with browser dev tools (disable cache)
5. Monitor console logs for cache hits/misses

## Critical Files for Immediate Updates

### Cache Configuration
- `app/utils/serverCache.ts` - Main cache TTL settings
- `app/utils/pagesListCache.ts` - Page-specific cache TTL
- `app/utils/globalCacheInvalidation.ts` - Cache invalidation utilities
- `app/firebase/database/pages.ts` - Client-side fetch headers

### Cache Invalidation
- `app/firebase/database/versions.ts` - Version save invalidation
- `app/components/pages/PageView.tsx` - Client-side invalidation
- `app/api/pages/[id]/versions/route.ts` - API route invalidation

### API Response Headers
- `app/api/pages/[id]/route.ts` - Individual page API
- `app/api/pages/route.ts` - Pages list API
- `app/middleware/apiOptimization.ts` - Global API caching

---

**REMEMBER**: User experience is paramount. Immediate updates after save are a critical requirement that should never be compromised for cost optimization.
