import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';

// Cache for recent search results
const recentSearchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const userId = await getUserIdFromRequest(request);
    
    // Check cache first
    const cacheKey = `recent-searches-results:${userId || 'anon'}`;
    const cached = recentSearchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`🚀 CACHE HIT: Recent searches with results served from cache`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
    }

    // Get recent searches from database (server-side)
    let recentSearches = [];

    if (userId) {
      try {
        // Fetch recent searches from user preferences
        const { getFirebaseAdmin } = await import('../../firebase/admin');
        const { getCollectionName } = await import('../../utils/environmentConfig');

        const admin = getFirebaseAdmin();
        const db = admin.firestore();

        const preferencesRef = db.collection(getCollectionName('user_preferences')).doc(userId);
        const preferencesDoc = await preferencesRef.get();

        if (preferencesDoc.exists) {
          const data = preferencesDoc.data();
          recentSearches = Array.isArray(data?.recentSearches) ? data.recentSearches : [];
        }
      } catch (error) {
        console.error('Error fetching recent searches from database:', error);
        recentSearches = [];
      }
    }

    if (!recentSearches || recentSearches.length === 0) {
      const emptyResult = {
        recentSearches: [],
        searchResults: {},
        totalSearches: 0,
        queryTime: Date.now() - startTime
      };
      
      // Cache empty result briefly
      recentSearchCache.set(cacheKey, {
        data: emptyResult,
        timestamp: Date.now()
      });
      
      return NextResponse.json(emptyResult);
    }

    // Extract unique search terms (limit to first 5 for performance)
    const searchTerms = recentSearches.slice(0, 5).map(search => search.term);
    
    // Batch fetch search results for all terms in parallel
    const searchResultsPromises = searchTerms.map(async (searchTerm) => {
      try {
        const userIdParam = userId ? `&userId=${userId}` : '';
        const searchUrl = `/api/search-unified?q=${encodeURIComponent(searchTerm)}&maxResults=8&context=autocomplete&includeUsers=true${userIdParam}`;
        
        // Use internal fetch (same server)
        const baseUrl = request.headers.get('host');
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const fullUrl = `${protocol}://${baseUrl}${searchUrl}`;
        
        const response = await fetch(fullUrl, {
          headers: {
            'User-Agent': 'WeWrite-Internal',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Search API error: ${response.status}`);
        }
        
        const data = await response.json();
        return {
          searchTerm,
          results: {
            pages: data.pages || [],
            users: data.users || []
          }
        };
      } catch (error) {
        console.error(`Error fetching results for "${searchTerm}":`, error);
        return {
          searchTerm,
          results: {
            pages: [],
            users: []
          }
        };
      }
    });

    // Wait for all search results
    const searchResultsArray = await Promise.all(searchResultsPromises);
    
    // Convert to object format for easy lookup
    const searchResults: Record<string, { pages: any[]; users: any[] }> = {};
    searchResultsArray.forEach(({ searchTerm, results }) => {
      searchResults[searchTerm] = results;
    });

    const responseData = {
      recentSearches: recentSearches.slice(0, 5), // Limit to 5 most recent
      searchResults,
      totalSearches: recentSearches.length,
      queryTime: Date.now() - startTime
    };

    // Cache the response
    recentSearchCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    console.log(`✅ Recent searches with results: ${searchTerms.length} searches processed in ${Date.now() - startTime}ms`);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error in recent searches with results API:', error);
    return NextResponse.json(
      {
        recentSearches: [],
        searchResults: {},
        error: 'Failed to load recent searches',
        totalSearches: 0
      },
      { status: 500 }
    );
  }
}
