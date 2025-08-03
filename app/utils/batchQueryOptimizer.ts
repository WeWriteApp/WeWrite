/**
 * Batch Query Optimizer for Firebase Cost Reduction
 * 
 * Converts N+1 query patterns into efficient batch operations
 * to minimize Firestore read costs and improve performance.
 */

// REMOVED: Direct Firebase imports - now using API endpoints for cost optimization
import { batchApi } from './apiClient';
import { getCollectionName } from './environmentConfig';
import { getCacheItem, setCacheItem } from '../utils/cacheUtils';

interface BatchQueryOptions {
  batchSize?: number;
  cacheKey?: string;
  cacheTTL?: number;
  enableCache?: boolean;
}

interface BatchResult<T> {
  data: T[];
  cached: boolean;
  batchCount: number;
  totalReads: number;
}

/**
 * Batch query executor for multiple document IDs
 */
export const batchGetDocuments = async <T extends DocumentData>(
  collectionName: string,
  documentIds: string[],
  options: BatchQueryOptions = {}
): Promise<BatchResult<T & { id: string }>> => {
  const {
    batchSize = 10, // Firestore 'in' query limit
    cacheKey,
    cacheTTL = 15 * 60 * 1000, // 15 minutes default
    enableCache = true
  } = options;

  // Check cache first
  if (enableCache && cacheKey) {
    const cached = getCacheItem<T[]>(cacheKey);
    if (cached) {
      return {
        data: cached,
        cached: true,
        batchCount: 0,
        totalReads: 0
      };
    }
  }

  const results: (T & { id: string })[] = [];
  const batches = [];
  let totalReads = 0;

  // Split IDs into batches
  for (let i = 0; i < documentIds.length; i += batchSize) {
    const batchIds = documentIds.slice(i, i + batchSize);
    batches.push(batchIds);
  }

  // Execute batches in parallel
  const batchPromises = batches.map(async (batchIds) => {
    const batchQuery = query(
      collection(db, getCollectionName(collectionName)),
      where(documentId(), 'in', batchIds)
    );

    const snapshot = await getDocs(batchQuery);
    totalReads += snapshot.size;

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as T & { id: string }));
  });

  const batchResults = await Promise.all(batchPromises);
  
  // Flatten results
  for (const batchResult of batchResults) {
    results.push(...batchResult);
  }

  // Cache results
  if (enableCache && cacheKey) {
    setCacheItem(cacheKey, results, cacheTTL);
  }

  console.log(`[BatchQuery] Fetched ${results.length} documents in ${batches.length} batches (${totalReads} reads)`);

  return {
    data: results,
    cached: false,
    batchCount: batches.length,
    totalReads
  };
};

/**
 * Batch query for user data
 */
export const batchGetUsers = async (
  userIds: string[],
  options: BatchQueryOptions = {}
): Promise<BatchResult<any>> => {
  const uniqueIds = [...new Set(userIds)];
  const cacheKey = options.cacheKey || `batch_users_${uniqueIds.sort().join('_')}`;
  
  return batchGetDocuments('users', uniqueIds, {
    ...options,
    cacheKey,
    cacheTTL: 4 * 60 * 60 * 1000 // 4 hours for user data
  });
};

/**
 * Batch query for page data
 */
export const batchGetPages = async (
  pageIds: string[],
  options: BatchQueryOptions = {}
): Promise<BatchResult<any>> => {
  const uniqueIds = [...new Set(pageIds)];
  const cacheKey = options.cacheKey || `batch_pages_${uniqueIds.sort().join('_')}`;
  
  return batchGetDocuments('pages', uniqueIds, {
    ...options,
    cacheKey,
    cacheTTL: 2 * 60 * 60 * 1000 // 2 hours for page data
  });
};

/**
 * Optimized query builder that automatically adds efficient constraints
 */
export const createOptimizedQuery = (
  collectionName: string,
  constraints: QueryConstraint[] = []
): ReturnType<typeof query> => {
  const optimizedConstraints = [...constraints];
  
  // Add default limit if none specified to prevent expensive full scans
  const hasLimit = constraints.some(constraint => 
    constraint.type === 'limit'
  );
  
  if (!hasLimit) {
    optimizedConstraints.push(firestoreLimit(100)); // Default safety limit
    console.warn(`[QueryOptimizer] Added default limit(100) to ${collectionName} query for cost protection`);
  }

  return query(
    collection(db, getCollectionName(collectionName)),
    ...optimizedConstraints
  );
};

/**
 * Paginated query executor with cost optimization
 */
export const executePaginatedQuery = async <T extends DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[],
  pageSize: number = 20,
  cursor?: any
): Promise<{
  data: (T & { id: string })[];
  nextCursor?: any;
  hasMore: boolean;
  totalReads: number;
}> => {
  const queryConstraints = [...constraints];
  
  // Add cursor constraint if provided
  if (cursor) {
    queryConstraints.push(orderBy('lastModified', 'desc'));
    queryConstraints.push(startAfter(cursor));
  }
  
  // Add limit
  queryConstraints.push(firestoreLimit(pageSize + 1)); // +1 to check if there are more
  
  const optimizedQuery = createOptimizedQuery(collectionName, queryConstraints);
  const snapshot = await getDocs(optimizedQuery);
  
  const docs = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as T & { id: string }));
  
  const hasMore = docs.length > pageSize;
  const data = hasMore ? docs.slice(0, pageSize) : docs;
  const nextCursor = hasMore ? snapshot.docs[pageSize - 1] : undefined;
  
  return {
    data,
    nextCursor,
    hasMore,
    totalReads: snapshot.size
  };
};

/**
 * Query deduplication to prevent identical queries
 */
class QueryDeduplicator {
  private pendingQueries = new Map<string, Promise<any>>();
  
  async deduplicate<T>(
    queryKey: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    // Check if query is already in progress
    if (this.pendingQueries.has(queryKey)) {
      console.log(`[QueryDedup] Deduplicating query: ${queryKey}`);
      return this.pendingQueries.get(queryKey)!;
    }
    
    // Execute query and cache promise
    const queryPromise = queryFn().finally(() => {
      this.pendingQueries.delete(queryKey);
    });
    
    this.pendingQueries.set(queryKey, queryPromise);
    return queryPromise;
  }
  
  clear(): void {
    this.pendingQueries.clear();
  }
  
  getStats(): { pendingQueries: number } {
    return {
      pendingQueries: this.pendingQueries.size
    };
  }
}

export const queryDeduplicator = new QueryDeduplicator();

/**
 * Wrapper for deduplicated queries
 */
export const deduplicatedQuery = <T>(
  queryKey: string,
  queryFn: () => Promise<T>
): Promise<T> => {
  return queryDeduplicator.deduplicate(queryKey, queryFn);
};

/**
 * Compound index usage optimizer
 */
export const optimizeForCompoundIndex = (
  baseConstraints: QueryConstraint[],
  indexFields: string[]
): QueryConstraint[] => {
  const optimized = [...baseConstraints];
  
  // Ensure constraints are ordered to match compound index
  const reorderedConstraints: QueryConstraint[] = [];
  
  // Add equality constraints first (in index order)
  for (const field of indexFields) {
    const equalityConstraint = optimized.find(c => 
      c.type === 'where' && 
      (c as any).fieldPath?.toString() === field &&
      (c as any).opStr === '=='
    );
    if (equalityConstraint) {
      reorderedConstraints.push(equalityConstraint);
    }
  }
  
  // Add range constraints
  const rangeConstraints = optimized.filter(c => 
    c.type === 'where' && 
    ['<', '<=', '>', '>=', '!=', 'in', 'array-contains'].includes((c as any).opStr)
  );
  reorderedConstraints.push(...rangeConstraints);
  
  // Add orderBy constraints
  const orderConstraints = optimized.filter(c => c.type === 'orderBy');
  reorderedConstraints.push(...orderConstraints);
  
  // Add limit constraints
  const limitConstraints = optimized.filter(c => c.type === 'limit');
  reorderedConstraints.push(...limitConstraints);
  
  return reorderedConstraints;
};

/**
 * Query cost estimator
 */
export const estimateQueryCost = (
  collectionSize: number,
  constraints: QueryConstraint[]
): {
  estimatedReads: number;
  costLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  estimatedCostUSD: number;
} => {
  let estimatedReads = collectionSize;
  const recommendations: string[] = [];

  // Check for equality filters (reduce reads significantly)
  const equalityFilters = constraints.filter(c =>
    c.type === 'where' && (c as any).opStr === '=='
  ).length;

  if (equalityFilters > 0) {
    estimatedReads = Math.max(1, estimatedReads / (equalityFilters * 10));
  }

  // Check for range filters
  const rangeFilters = constraints.filter(c =>
    c.type === 'where' && ['<', '<=', '>', '>=', '!='].includes((c as any).opStr)
  ).length;

  if (rangeFilters > 0) {
    estimatedReads = Math.max(1, estimatedReads / (rangeFilters * 5));
  }

  // Check for array-contains filters
  const arrayFilters = constraints.filter(c =>
    c.type === 'where' && ['array-contains', 'array-contains-any'].includes((c as any).opStr)
  ).length;

  if (arrayFilters > 0) {
    estimatedReads = Math.max(1, estimatedReads / (arrayFilters * 3));
  }

  // Check for limit
  const limitConstraint = constraints.find(c => c.type === 'limit');
  if (limitConstraint) {
    estimatedReads = Math.min(estimatedReads, (limitConstraint as any).limit);
  } else {
    recommendations.push('CRITICAL: Add limit() to prevent full collection scans');
  }

  // Check for orderBy without limit
  const orderByConstraints = constraints.filter(c => c.type === 'orderBy');
  if (orderByConstraints.length > 0 && !limitConstraint) {
    recommendations.push('URGENT: OrderBy without limit can be very expensive');
  }

  // Determine cost level
  let costLevel: 'low' | 'medium' | 'high' | 'critical';
  if (estimatedReads <= 10) costLevel = 'low';
  else if (estimatedReads <= 100) costLevel = 'medium';
  else if (estimatedReads <= 1000) costLevel = 'high';
  else costLevel = 'critical';

  // Calculate estimated cost in USD (Firestore pricing: $0.36 per 100K reads)
  const estimatedCostUSD = (estimatedReads / 100000) * 0.36;

  if (costLevel === 'critical') {
    recommendations.push(`URGENT: This query may cost $${estimatedCostUSD.toFixed(4)} - add more specific filters`);
  } else if (costLevel === 'high') {
    recommendations.push(`WARNING: This query may cost $${estimatedCostUSD.toFixed(4)} - consider optimization`);
  }

  // Additional optimization recommendations
  if (estimatedReads > 50) {
    recommendations.push('Consider implementing pagination for large result sets');
  }

  if (equalityFilters === 0 && rangeFilters === 0) {
    recommendations.push('Add equality or range filters to reduce query scope');
  }

  return {
    estimatedReads,
    costLevel,
    recommendations,
    estimatedCostUSD
  };
};
