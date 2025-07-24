import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * GET endpoint - Search for pages by title and content
 * Query parameters:
 * - q: Search query
 * - limit: Maximum number of results (default: 10)
 * - includeContent: Whether to search content as well as titles (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    // Get current user (optional for search)
    const currentUserId = await getUserIdFromRequest(request);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');
    const includeContent = searchParams.get('includeContent') === 'true';

    if (!query || query.trim() === '') {
      return createErrorResponse('BAD_REQUEST', 'Search query is required');
    }

    const trimmedQuery = query.trim().toLowerCase();

    console.log('🔍 PAGE_SEARCH: Searching for pages', {
      query: trimmedQuery,
      limit,
      includeContent,
      currentUserId: currentUserId || 'anonymous'
    });

    const collectionName = getCollectionName('pages');
    
    // Search for pages with title containing the query
    // Note: Firestore doesn't support full-text search, so we'll do a simple contains search
    // For better search, consider using Algolia or similar service
    
    const searchResults: any[] = [];
    
    // Strategy 1: Search by title prefix (most efficient in Firestore)
    // Use simpler query to avoid composite index requirements
    const titleQuery = db.collection(collectionName)
      .orderBy('title')
      .startAt(trimmedQuery)
      .endAt(trimmedQuery + '\uf8ff')
      .limit(limit * 2); // Get more to filter client-side

    const titleSnapshot = await titleQuery.get();

    titleSnapshot.forEach(doc => {
      const pageData = doc.data();

      // Skip deleted pages (filter client-side)
      if (pageData.deleted === true) {
        return;
      }

      searchResults.push({
        id: doc.id,
        title: pageData.title,
        username: pageData.username || 'Unknown',
        userId: pageData.userId || '',
        lastModified: pageData.lastModified,
        isPublic: pageData.isPublic !== false,
        matchType: 'title',
        relevance: calculateTitleRelevance(pageData.title, trimmedQuery)
      });
    });

    // Strategy 2: If we need more results, do a broader search
    if (searchResults.length < limit) {
      const remainingLimit = limit - searchResults.length;

      // Get recent pages and filter client-side (not ideal but works for now)
      const broadQuery = db.collection(collectionName)
        .orderBy('lastModified', 'desc')
        .limit(100); // Get more to filter from

      const broadSnapshot = await broadQuery.get();
      
      broadSnapshot.forEach(doc => {
        const pageData = doc.data();

        // Skip deleted pages
        if (pageData.deleted === true) return;

        // Skip if already included
        if (searchResults.find(r => r.id === doc.id)) return;

        const title = (pageData.title || '').toLowerCase();
        const content = includeContent ? (pageData.content || '').toLowerCase() : '';

        // Check if title or content contains the query
        const titleMatch = title.includes(trimmedQuery);
        const contentMatch = includeContent && content.includes(trimmedQuery);
        
        if (titleMatch || contentMatch) {
          searchResults.push({
            id: doc.id,
            title: pageData.title,
            username: pageData.username || 'Unknown',
            userId: pageData.userId || '',
            lastModified: pageData.lastModified,
            isPublic: pageData.isPublic !== false,
            matchType: titleMatch ? 'title' : 'content',
            relevance: titleMatch 
              ? calculateTitleRelevance(pageData.title, trimmedQuery)
              : 0.3
          });
        }
      });
    }

    // Sort by relevance and limit results
    const sortedResults = searchResults
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(({ relevance, ...page }) => page); // Remove relevance from final result

    console.log('🔍 PAGE_SEARCH: Found results', {
      query: trimmedQuery,
      totalResults: sortedResults.length,
      topResults: sortedResults.slice(0, 3).map(r => ({
        title: r.title,
        matchType: r.matchType
      }))
    });

    return createApiResponse({
      pages: sortedResults,
      query: trimmedQuery,
      totalResults: sortedResults.length
    });

  } catch (error) {
    console.error('🔴 PAGE_SEARCH: Error searching pages:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to search pages');
  }
}

/**
 * Calculate relevance score for title matches
 */
function calculateTitleRelevance(title: string, query: string): number {
  if (!title || !query) return 0;
  
  const titleLower = title.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact match
  if (titleLower === queryLower) return 1.0;
  
  // Starts with query
  if (titleLower.startsWith(queryLower)) return 0.9;
  
  // Contains query as whole word
  const wordBoundaryRegex = new RegExp(`\\b${queryLower}\\b`);
  if (wordBoundaryRegex.test(titleLower)) return 0.8;
  
  // Contains query as substring
  if (titleLower.includes(queryLower)) return 0.6;
  
  // Calculate word overlap
  const titleWords = titleLower.split(/\s+/);
  const queryWords = queryLower.split(/\s+/);
  
  const matchingWords = queryWords.filter(qWord => 
    titleWords.some(tWord => tWord.includes(qWord) || qWord.includes(tWord))
  );
  
  const wordOverlap = matchingWords.length / queryWords.length;
  return Math.max(0.2, wordOverlap * 0.5);
}
