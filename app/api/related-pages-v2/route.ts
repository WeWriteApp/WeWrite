/**
 * Related Pages API v2 - Algolia-Powered
 *
 * Enhanced related pages that uses Algolia search for better text similarity
 * and includes both "related by content" and "more by same author" sections.
 *
 * Query params:
 * - pageId: Current page ID (required)
 * - pageTitle: Page title for similarity search
 * - authorId: Author's user ID for "more by author" results
 * - authorUsername: Author's username for display
 * - excludePageIds: Comma-separated page IDs to exclude (e.g., already linked pages)
 * - limitByOthers: Max results for "by others" (default: 8)
 * - limitByAuthor: Max results for "by author" (default: 5)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSearchClient, getAlgoliaIndexName, ALGOLIA_INDICES, type AlgoliaPageRecord } from '../../lib/algolia';

// Extract key terms from title for better search
function extractSearchTerms(title: string): string {
  if (!title) return '';

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'his', 'her', 'its', 'our'
  ]);

  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10) // Top 10 meaningful words
    .join(' ');
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get('pageId');
    const pageTitle = searchParams.get('pageTitle') || '';
    const pageContent = searchParams.get('pageContent') || '';
    const authorId = searchParams.get('authorId');
    const authorUsername = searchParams.get('authorUsername');
    const excludePageIds = searchParams.get('excludePageIds')?.split(',').filter(Boolean) || [];
    const limitByOthers = parseInt(searchParams.get('limitByOthers') || '8');
    const limitByAuthor = parseInt(searchParams.get('limitByAuthor') || '5');

    if (!pageId) {
      return NextResponse.json({
        error: 'pageId parameter is required',
        relatedByOthers: [],
        relatedByAuthor: [],
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }

    console.log(`🔍 [RELATED_V2] Finding related pages for ${pageId}`);
    console.log(`🔍 [RELATED_V2] Title: "${pageTitle}", Author: ${authorUsername || authorId || 'unknown'}`);

    // Build exclusion list
    const excludeIds = new Set([pageId, ...excludePageIds]);

    // Extract search terms from title (prioritized) and content
    const titleTerms = extractSearchTerms(pageTitle);
    const contentTerms = extractSearchTerms(pageContent.substring(0, 500));

    // Combine with title terms weighted more heavily (repeated)
    const searchQuery = `${titleTerms} ${titleTerms} ${contentTerms}`.trim();

    const client = getSearchClient();
    const indexName = getAlgoliaIndexName(ALGOLIA_INDICES.PAGES);

    // Parallel requests for both categories
    const [byOthersResponse, byAuthorResponse] = await Promise.all([
      // Search for related pages by OTHER authors
      searchQuery ? client.searchSingleIndex<AlgoliaPageRecord>({
        indexName,
        searchParams: {
          query: searchQuery,
          hitsPerPage: limitByOthers + excludeIds.size + 5, // Extra to account for filtering
          filters: authorId
            ? `isPublic:true AND NOT authorId:${authorId}`
            : 'isPublic:true',
          attributesToRetrieve: [
            'objectID',
            'title',
            'authorId',
            'authorUsername',
            'isPublic',
            'lastModified'
          ],
        },
      }) : Promise.resolve({ hits: [] }),

      // Get more pages by the SAME author
      authorId ? client.searchSingleIndex<AlgoliaPageRecord>({
        indexName,
        searchParams: {
          query: '', // Empty query to get all
          hitsPerPage: limitByAuthor + excludeIds.size + 2,
          filters: `isPublic:true AND authorId:${authorId}`,
          attributesToRetrieve: [
            'objectID',
            'title',
            'authorId',
            'authorUsername',
            'isPublic',
            'lastModified'
          ],
        },
      }) : Promise.resolve({ hits: [] }),
    ]);

    // Filter out excluded pages and format results
    const relatedByOthers = byOthersResponse.hits
      .filter((hit: AlgoliaPageRecord) => !excludeIds.has(hit.objectID))
      .slice(0, limitByOthers)
      .map((hit: AlgoliaPageRecord) => ({
        id: hit.objectID,
        title: hit.title,
        username: hit.authorUsername || 'Unknown',
        authorId: hit.authorId,
        lastModified: hit.lastModified,
        isPublic: hit.isPublic,
      }));

    const relatedByAuthor = byAuthorResponse.hits
      .filter((hit: AlgoliaPageRecord) => !excludeIds.has(hit.objectID))
      .slice(0, limitByAuthor)
      .map((hit: AlgoliaPageRecord) => ({
        id: hit.objectID,
        title: hit.title,
        username: hit.authorUsername || authorUsername || 'Unknown',
        authorId: hit.authorId,
        lastModified: hit.lastModified,
        isPublic: hit.isPublic,
      }));

    const responseTime = Date.now() - startTime;
    console.log(`🔍 [RELATED_V2] Found ${relatedByOthers.length} by others, ${relatedByAuthor.length} by author in ${responseTime}ms`);

    return NextResponse.json({
      relatedByOthers,
      relatedByAuthor,
      authorUsername: authorUsername || null,
      searchQuery: searchQuery || null,
      responseTime,
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('Related pages v2 API error:', error);

    return NextResponse.json({
      error: 'Failed to fetch related pages',
      relatedByOthers: [],
      relatedByAuthor: [],
      details: process.env.NODE_ENV === 'development'
        ? (error instanceof Error ? error.message : 'Unknown error')
        : 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { status: 200 }); // Return 200 to prevent console errors
  }
}
