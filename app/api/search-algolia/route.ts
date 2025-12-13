/**
 * Algolia-Powered Search API
 *
 * Fast, typo-tolerant search using Algolia indices.
 * This endpoint provides instant search results for pages and users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchAll, searchPages, searchUsers, logAlgoliaConfig } from '../../lib/algolia';

// Force dynamic to prevent caching issues
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const type = searchParams.get('type'); // 'pages', 'users', or undefined for both
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const includeUsers = searchParams.get('includeUsers') !== 'false';

    if (!query || query.length < 1) {
      return NextResponse.json({
        pages: [],
        users: [],
        query: '',
        responseTime: Date.now() - startTime,
      });
    }

    // Log config on first request (for debugging)
    if (process.env.NODE_ENV === 'development') {
      logAlgoliaConfig();
    }

    let results: any = {
      query,
      responseTime: 0,
    };

    if (type === 'pages') {
      // Search only pages
      const pagesResponse = await searchPages(query, { hitsPerPage: limit });
      results.pages = pagesResponse.hits.map(hit => ({
        id: hit.objectID,
        title: hit.title,
        authorId: hit.authorId,
        authorUsername: hit.authorUsername,
        isPublic: hit.isPublic,
        lastModified: hit.lastModified,
        alternativeTitles: hit.alternativeTitles,
        _highlightResult: (hit as any)._highlightResult,
      }));
      results.totalPages = pagesResponse.nbHits;
    } else if (type === 'users') {
      // Search only users
      const usersResponse = await searchUsers(query, { hitsPerPage: limit });
      results.users = usersResponse.hits.map(hit => ({
        id: hit.objectID,
        username: hit.username,
        displayName: hit.displayName,
        photoURL: hit.photoURL,
        _highlightResult: (hit as any)._highlightResult,
      }));
      results.totalUsers = usersResponse.nbHits;
    } else {
      // Search both pages and users
      const { pages: pagesResponse, users: usersResponse } = await searchAll(query, {
        hitsPerPage: Math.min(limit, 15), // Limit per type for combined search
      });

      // Type guard and map results
      if (pagesResponse && 'hits' in pagesResponse) {
        results.pages = pagesResponse.hits.map((hit: any) => ({
          id: hit.objectID,
          title: hit.title,
          authorId: hit.authorId,
          authorUsername: hit.authorUsername,
          isPublic: hit.isPublic,
          lastModified: hit.lastModified,
          alternativeTitles: hit.alternativeTitles,
          _highlightResult: hit._highlightResult,
        }));
        results.totalPages = pagesResponse.nbHits;
      } else {
        results.pages = [];
        results.totalPages = 0;
      }

      if (includeUsers && usersResponse && 'hits' in usersResponse) {
        results.users = usersResponse.hits.map((hit: any) => ({
          id: hit.objectID,
          username: hit.username,
          displayName: hit.displayName,
          photoURL: hit.photoURL,
          _highlightResult: hit._highlightResult,
        }));
        results.totalUsers = usersResponse.nbHits;
      } else {
        results.users = [];
        results.totalUsers = 0;
      }
    }

    results.responseTime = Date.now() - startTime;

    return NextResponse.json(results);
  } catch (error) {
    console.error('[Algolia Search] Error:', error);

    // If Algolia fails, return empty results with error info
    return NextResponse.json(
      {
        pages: [],
        users: [],
        query: request.nextUrl.searchParams.get('q') || '',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Search failed',
      },
      { status: 500 }
    );
  }
}
