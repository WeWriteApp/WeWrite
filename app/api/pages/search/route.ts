import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * GET endpoint - Search for pages by title, alternative titles, and content
 * Query parameters:
 * - q: Search query
 * - limit: Maximum number of results (default: 10)
 * - includeContent: Whether to search content as well as titles (default: false)
 *
 * Search priority:
 * 1. Primary title matches (highest relevance)
 * 2. Alternative title matches (slightly lower relevance)
 * 3. Content matches (lowest relevance)
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
    
    // Strategy 1: Search by title prefix with case variations (most efficient in Firestore)
    // Use simpler query to avoid composite index requirements
    const searchQueries = [];

    // Create case variations for comprehensive search
    const caseVariations = [
      trimmedQuery,
      trimmedQuery.toLowerCase(),
      trimmedQuery.charAt(0).toUpperCase() + trimmedQuery.slice(1).toLowerCase(),
      trimmedQuery.toUpperCase(),
      trimmedQuery.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')
    ];

    // Remove duplicates
    const uniqueVariations = [...new Set(caseVariations)];

    // Create queries for each case variation
    for (const variation of uniqueVariations) {
      const titleQuery = db.collection(collectionName)
        .orderBy('title')
        .startAt(variation)
        .endAt(variation + '\uf8ff')
        .limit(Math.ceil(limit / uniqueVariations.length)); // Distribute limit across variations
      searchQueries.push(titleQuery);
    }

    // Execute all case variation queries in parallel
    const queryPromises = searchQueries.map(query => query.get());
    const queryResults = await Promise.all(queryPromises);

    // Process results from all queries
    const processedIds = new Set();

    for (const snapshot of queryResults) {
      snapshot.forEach(doc => {
        // Skip if already processed
        if (processedIds.has(doc.id)) return;

        const pageData = doc.data();

        // Skip deleted pages (filter client-side)
        if (pageData.deleted === true) {
          return;
        }

        processedIds.add(doc.id);
        searchResults.push({
          id: doc.id,
          title: pageData.title,
          alternativeTitles: pageData.alternativeTitles || [],
          username: pageData.username || 'Unknown',
          userId: pageData.userId || '',
          lastModified: pageData.lastModified,
          isPublic: pageData.isPublic !== false,
          matchType: 'title',
          matchedTitle: pageData.title, // The title that matched
          relevance: calculateTitleRelevance(pageData.title, trimmedQuery)
        });
      });
    }

    // Strategy 2: If we need more results, do a broader search (includes alternative titles)
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
        const alternativeTitles: string[] = pageData.alternativeTitles || [];
        const content = includeContent ? (pageData.content || '').toLowerCase() : '';

        // Check if title, alternative titles, or content contains the query
        const titleMatch = title.includes(trimmedQuery);

        // Check alternative titles
        let altTitleMatch: string | null = null;
        for (const altTitle of alternativeTitles) {
          if (altTitle.toLowerCase().includes(trimmedQuery)) {
            altTitleMatch = altTitle;
            break;
          }
        }

        const contentMatch = includeContent && content.includes(trimmedQuery);

        if (titleMatch || altTitleMatch || contentMatch) {
          // Determine match type and relevance
          let matchType: string;
          let relevance: number;
          let matchedTitle: string;

          if (titleMatch) {
            matchType = 'title';
            relevance = calculateTitleRelevance(pageData.title, trimmedQuery);
            matchedTitle = pageData.title;
          } else if (altTitleMatch) {
            matchType = 'alternative_title';
            // Alternative title matches get slightly lower relevance than primary
            relevance = calculateTitleRelevance(altTitleMatch, trimmedQuery) * 0.9;
            matchedTitle = altTitleMatch;
          } else {
            matchType = 'content';
            relevance = 0.3;
            matchedTitle = pageData.title;
          }

          searchResults.push({
            id: doc.id,
            title: pageData.title,
            alternativeTitles: alternativeTitles,
            username: pageData.username || 'Unknown',
            userId: pageData.userId || '',
            lastModified: pageData.lastModified,
            isPublic: pageData.isPublic !== false,
            matchType,
            matchedTitle,
            relevance
          });
        }
      });
    }

    // Sort by relevance and limit results
    const sortedResults = searchResults
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(({ relevance, ...page }) => ({
        ...page,
        // Include matchedTitle info for UI display when matched via alternative title
        isAlternativeTitleMatch: page.matchType === 'alternative_title'
      }));

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
