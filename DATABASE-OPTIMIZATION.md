# Database Optimization Guide

This guide provides instructions for optimizing Firebase database usage to reduce costs and improve performance.

## Implemented Optimizations

We've implemented the following optimizations to reduce database costs:

1. **Optimized Real-time Listeners**
   - Added caching to `listenToPageById` to reduce unnecessary version document reads
   - Replaced the global groups listener with a more efficient user-specific approach
   - Improved cleanup of listeners to prevent memory leaks

2. **Optimized BigQuery Usage**
   - Removed redundant verification query
   - Combined multiple queries into a single query with CTEs (Common Table Expressions)
   - Added client-side filtering for results

3. **Added Missing Indexes**
   - Created compound indexes for all frequently used queries
   - Added collection group index for versions subcollection
   - Updated firestore.indexes.json with all necessary indexes

## Deploying Indexes

To deploy the updated indexes, run:

```bash
./deploy-indexes.sh
```

Or manually:

```bash
firebase deploy --only firestore:indexes
```

## Additional Optimization Recommendations

1. **Implement Client-side Caching**
   - Use React Query or SWR for efficient data fetching and caching
   - Implement a global state management solution to avoid redundant fetches

2. **Optimize Document Reads**
   - Use field masks to specify which fields to return
   - Implement pagination for large collections
   - Split large documents into smaller, more focused documents

3. **Reduce Real-time Listeners**
   - Replace real-time listeners with one-time `getDocs` where real-time updates aren't necessary
   - Implement proper cleanup in all components with useEffect

4. **Monitor Database Usage**
   - Set up Firebase Performance Monitoring to track query performance
   - Create a dashboard to monitor database usage and costs
   - Implement logging to track expensive operations

## Monitoring Database Costs

1. Visit the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to "Usage and billing" in the left sidebar
4. View detailed usage metrics and costs

## Best Practices for Developers

1. **Avoid Unnecessary Listeners**
   - Only use real-time listeners when you need real-time updates
   - Always clean up listeners in useEffect return functions

2. **Optimize Queries**
   - Only fetch the data you need
   - Use compound queries with proper indexes
   - Implement pagination for large result sets

3. **Batch Operations**
   - Use batch writes for multiple document updates
   - Use transactions for atomic operations

4. **Cache Results**
   - Implement client-side caching for frequently accessed data
   - Use memoization for expensive computations
