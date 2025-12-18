# Firebase Cost Optimization Guide

## Current Status (December 2025)

Your Firebase costs (~$100/month) are primarily driven by:
1. **Firestore reads** - Document reads from API calls
2. **Firestore indexes** - 78 composite indexes (storage + write costs)
3. **Real-time Database** - Minimal (most listeners disabled)

## Optimizations Already in Place ✅

### 1. Disabled Real-time Listeners
All expensive `onSnapshot` listeners have been disabled:
- `app/firebase/database/pages.ts` - Page watching
- `app/services/VisitorTrackingService.ts` - Visitor tracking
- `app/services/feeConfigurationService.ts` - Fee config
- `app/services/feeService.ts` - Fee service
- `app/utils/realtimeConnectionManager.ts` - Connection manager
- `app/services/LiveReadersService.ts` - Live readers

### 2. Server-Side Caching
- `app/utils/serverRequestDeduplication.ts` - Deduplicates identical requests
- API-level caching in `/api/home`, `/api/trending`, etc.
- TTLs ranging from 5-30 minutes depending on data volatility

### 3. Service Worker Caching
- `public/sw.js` - Stale-while-revalidate for APIs
- Network-first for user-specific data (bios, profiles)
- Cache-first for static assets

## Additional Recommendations

### 1. Reduce Composite Indexes (High Impact)
You have 78 indexes in `config/firestore.indexes.json`. Review and remove:
- `PROD_*` prefixed indexes (you use base names for production)
- Duplicate indexes with similar field combinations
- Unused indexes (check Firebase Console → Firestore → Indexes → Usage)

**Potential savings: 10-20% of Firestore costs**

### 2. Optimize Sitemap Generation
Sitemaps query ALL pages. Consider:
- Caching sitemap for 24 hours
- Using pagination with cursor-based queries
- Pre-generating and storing in CDN

### 3. Increase Cache TTLs (Already Done)
Service worker now uses:
- 5 minutes for general API cache
- 1 minute for user-specific data
- Network-first for bio endpoints

### 4. Monitor with Cost Dashboard
Use your existing monitoring:
```javascript
import { costMonitor } from './utils/costMonitor';
costMonitor.trackRead('pages', 'query', documentCount, 'api/home');
```

## Firebase Console Checks

1. **Usage Tab**: Check which collections have most reads
2. **Rules Playground**: Ensure rules don't cause extra reads
3. **Indexes Tab**: Remove unused composite indexes
4. **Blaze Plan**: Consider committed use discounts if sustained $100+/month

## Quick Wins

1. **Delete unused indexes**: Run `firebase firestore:indexes` to see all
2. **Review PROD_ collections**: If not using PROD_ prefix, remove those indexes
3. **Add monitoring**: Track reads per API endpoint to find hotspots

## Related Documentation

- [Firebase Optimization Guide](./FIREBASE_OPTIMIZATION_GUIDE.md) - Comprehensive optimization strategies
- [Firebase Index Optimization](./FIREBASE_INDEX_OPTIMIZATION.md) - Index management
- [Collection Naming Standards](./COLLECTION_NAMING_STANDARDS.md) - Collection naming patterns
- [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION_GUIDE.md) - General performance tuning
- [Environment Quick Reference](./ENVIRONMENT_QUICK_REFERENCE.md) - Environment-specific collections
