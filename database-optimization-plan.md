# Database Optimization Plan for WeWrite

## Current Issues

Based on the analysis of the codebase, we've identified the following potential issues that may be contributing to high Firestore costs:

1. **Multiple Real-time Listeners**: Several components are using `onSnapshot` listeners without proper cleanup or optimization
2. **Inefficient BigQuery Usage**: Multiple BigQuery queries for search functionality
3. **Missing Indexes**: Some queries may not be using proper indexes
4. **Redundant Data Fetching**: Some components fetch the same data multiple times
5. **Large Document Reads**: Reading entire documents when only specific fields are needed

## Optimization Strategies

### 1. Optimize Real-time Listeners

#### Issues Found:
- Multiple `onSnapshot` listeners in components like `listenToPageById`, `listenToUserSubscription`, and `listenToUserPledges`
- GroupsProvider sets up a listener for all groups regardless of whether they're needed
- Some listeners don't have proper cleanup

#### Solutions:
- Consolidate listeners where possible
- Implement proper cleanup in all components with useEffect
- Use more specific queries to reduce data transfer
- Replace real-time listeners with one-time `getDocs` where real-time updates aren't necessary

### 2. Optimize BigQuery Usage

#### Issues Found:
- Multiple BigQuery queries for search functionality
- Redundant verification queries
- No caching of search results

#### Solutions:
- Implement client-side caching for search results
- Consolidate multiple BigQuery queries into fewer, more efficient queries
- Consider using Firestore for simpler searches and BigQuery only for complex searches
- Implement pagination to limit the amount of data returned

### 3. Add Missing Indexes

#### Issues Found:
- Some complex queries may not have proper indexes
- Missing compound indexes for frequently used queries

#### Solutions:
- Create compound indexes for all frequently used queries
- Review and update firestore.indexes.json to include all necessary indexes
- Monitor query performance in Firebase console

### 4. Reduce Redundant Data Fetching

#### Issues Found:
- Multiple components fetching the same user data
- Redundant page metadata fetches

#### Solutions:
- Implement a global state management solution (Context API or Redux)
- Create a data fetching layer that caches results
- Use React Query or SWR for efficient data fetching and caching

### 5. Optimize Document Reads

#### Issues Found:
- Reading entire documents when only specific fields are needed
- Fetching large collections without limits

#### Solutions:
- Use field masks to specify which fields to return
- Implement pagination for large collections
- Split large documents into smaller, more focused documents

## Implementation Plan

### Phase 1: Quick Wins (Immediate Impact)

1. **Optimize Listeners**
   - Add proper cleanup to all `onSnapshot` listeners
   - Replace unnecessary real-time listeners with one-time `getDocs`

2. **Add Missing Indexes**
   - Create compound indexes for all frequently used queries
   - Update firestore.indexes.json

3. **Implement Field Masks**
   - Modify queries to only fetch required fields

### Phase 2: Structural Improvements (Medium-term)

1. **Implement Caching Layer**
   - Add client-side caching for search results and frequently accessed data
   - Implement a global state management solution

2. **Optimize BigQuery Usage**
   - Consolidate BigQuery queries
   - Implement pagination for search results

3. **Refactor Data Model**
   - Split large documents into smaller, more focused documents
   - Optimize data structure for common query patterns

### Phase 3: Advanced Optimizations (Long-term)

1. **Implement Data Aggregation**
   - Use Cloud Functions to pre-aggregate data for common queries
   - Store aggregated results in separate collections

2. **Implement Intelligent Prefetching**
   - Predict user behavior and prefetch likely-to-be-needed data
   - Cache data based on user patterns

3. **Optimize Cloud Functions**
   - Review and optimize all Cloud Functions that interact with the database
   - Implement batching for bulk operations

## Monitoring and Measurement

- Set up Firebase Performance Monitoring to track query performance
- Create a dashboard to monitor database usage and costs
- Implement logging to track expensive operations
- Regularly review and optimize based on usage patterns
