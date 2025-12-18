import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../../firebase/database';
import { getCollectionName } from '../../utils/environmentConfig';
import { searchPerformanceTracker } from '../../utils/searchPerformanceTracker';
import { recordProductionRead } from '../../utils/productionReadMonitor';
import { searchPages, searchUsers as algoliaSearchUsers } from '../../lib/algolia';

// Add export for dynamic route handling
export const dynamic = 'force-dynamic';

// Feature flag for Algolia - set to true to use Algolia, false for Firestore fallback
const USE_ALGOLIA = true;

// Type definitions
interface SearchCacheEntry {
  data: SearchResult;
  timestamp: number;
  ttl: number;
}

interface SearchResult {
  pages: PageSearchResult[];
  users: UserSearchResult[];
  source: string;
  searchTerm?: string;
  context?: string;
  performance?: SearchPerformance;
  cached?: boolean;
  cacheAge?: number;
  timestamp?: number;
}

interface SearchPerformance {
  searchTimeMs: number;
  pagesFound: number;
  usersFound: number;
  maxResults?: number | string;
  searchEngine?: string;
}

interface PageSearchResult {
  id: string;
  title: string;
  type: 'page';
  isOwned: boolean;
  isEditable: boolean;
  userId: string;
  username: string | null;
  lastModified: string;
  createdAt?: string;
  matchScore: number;
  isContentMatch: boolean;
  context: string;
  contentPreview?: string;
  isPublic?: boolean;
  alternativeTitles?: string[];
  _highlightResult?: unknown;
}

interface UserSearchResult {
  id: string;
  username: string;
  displayName?: string;
  photoURL: string | null;
  type: 'user';
  matchScore: number;
  _highlightResult?: unknown;
}

interface SearchOptions {
  context?: string;
  maxResults?: number | null;
  includeContent?: boolean;
  titleOnly?: boolean;
  filterByUserId?: string | null;
  currentPageId?: string | null;
}

interface AlgoliaSearchOptions {
  maxResults?: number;
  includeUsers?: boolean;
  filterByUserId?: string | null;
  currentPageId?: string | null;
  context?: string;
}

// OPTIMIZATION: Enhanced caching system to reduce database reads
const searchCache = new Map<string, SearchCacheEntry>();
const SEARCH_CACHE_TTL = {
  EMPTY_SEARCH: 10 * 60 * 1000,    // 10 minutes for empty searches (user's own pages)
  TERM_SEARCH: 5 * 60 * 1000,      // 5 minutes for search terms
  USER_SEARCH: 15 * 60 * 1000,     // 15 minutes for user-specific searches
};

function getCacheKey(
  searchTerm: string | null,
  userId: string | null,
  context: string,
  maxResults: number | null,
  filterByUserId: string | null
): string {
  return `search:${searchTerm || 'empty'}:${userId || 'anon'}:${context}:${maxResults}:${filterByUserId || 'none'}`;
}

function getCachedResult(cacheKey: string): SearchResult | null {
  const cached = searchCache.get(cacheKey);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    searchCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

function setCachedResult(cacheKey: string, data: SearchResult, ttl: number): void {
  // Limit cache size to prevent memory issues
  if (searchCache.size > 1000) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }

  searchCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

// Search context types
const SEARCH_CONTEXTS = {
  MAIN: 'main',
  LINK_EDITOR: 'link_editor',
  ADD_TO_PAGE: 'add_to_page',
  AUTOCOMPLETE: 'autocomplete'
} as const;

type SearchContext = typeof SEARCH_CONTEXTS[keyof typeof SEARCH_CONTEXTS];

// Default configuration per context
const CONTEXT_DEFAULTS: Record<SearchContext, {
  maxResults: number;
  includeContent: boolean;
  includeUsers: boolean;
  includeGroups: boolean;
  titleOnly: boolean;
}> = {
  [SEARCH_CONTEXTS.MAIN]: {
    maxResults: 200,
    includeContent: true,
    includeUsers: true,
    includeGroups: false,
    titleOnly: false
  },
  [SEARCH_CONTEXTS.LINK_EDITOR]: {
    maxResults: 100,
    includeContent: false,
    includeUsers: false,
    includeGroups: false,
    titleOnly: true
  },
  [SEARCH_CONTEXTS.ADD_TO_PAGE]: {
    maxResults: 50,
    includeContent: false,
    includeUsers: false,
    includeGroups: false,
    titleOnly: true
  },
  [SEARCH_CONTEXTS.AUTOCOMPLETE]: {
    maxResults: 10,
    includeContent: false,
    includeUsers: true,
    includeGroups: false,
    titleOnly: true
  }
};

/**
 * Calculate search score for ranking results
 */
function calculateSearchScore(
  text: string | null | undefined,
  searchTerm: string,
  isTitle: boolean = false,
): number {
  if (!text || !searchTerm) return 0;

  const normalizedText = text.toLowerCase();
  const normalizedSearch = searchTerm.toLowerCase();

  // Exact match (highest score)
  if (normalizedText === normalizedSearch) {
    return isTitle ? 100 : 80;
  }

  // Starts with search term (very high score)
  if (normalizedText.startsWith(normalizedSearch)) {
    return isTitle ? 95 : 75;
  }

  // Contains search term as substring (high score)
  if (normalizedText.includes(normalizedSearch)) {
    return isTitle ? 80 : 60;
  }

  // Word boundary matches
  const words = normalizedText.split(/\s+/);
  const searchWords = normalizedSearch.split(/\s+/);

  // All search words found as complete words
  const allWordsFound = searchWords.every(searchWord =>
    words.some(word => word === searchWord)
  );
  if (allWordsFound) {
    return isTitle ? 75 : 55;
  }

  // Contains all search words as substrings (non-sequential)
  const containsAllWords = searchWords.every(searchWord =>
    normalizedText.includes(searchWord)
  );
  if (containsAllWords) {
    return isTitle ? 70 : 50;
  }

  // Sequential word matches
  let sequentialMatches = 0;
  for (let i = 0; i <= words.length - searchWords.length; i++) {
    let matches = 0;
    for (let j = 0; j < searchWords.length; j++) {
      if (words[i + j] && words[i + j].includes(searchWords[j])) {
        matches++;
      } else {
        break;
      }
    }
    sequentialMatches = Math.max(sequentialMatches, matches);
  }

  if (sequentialMatches === searchWords.length) {
    return isTitle ? 65 : 45;
  }

  // Partial word matches (lowest score but still valid)
  const someWordsFound = searchWords.some(searchWord =>
    normalizedText.includes(searchWord)
  );
  if (someWordsFound) {
    return isTitle ? 50 : 35;
  }

  return 0;
}

/**
 * Comprehensive search function for pages
 */
async function searchPagesComprehensive(
  userId: string | null,
  searchTerm: string,
  options: SearchOptions = {}
): Promise<PageSearchResult[]> {
  const searchStartTime = Date.now();

  try {
    const {
      context = SEARCH_CONTEXTS.MAIN,
      maxResults = null,
      includeContent = true,
      titleOnly = false,
      filterByUserId = null,
      currentPageId = null
    } = options;

    const contextDefaults = CONTEXT_DEFAULTS[context as SearchContext] || CONTEXT_DEFAULTS[SEARCH_CONTEXTS.MAIN];
    const finalMaxResults = maxResults || contextDefaults.maxResults;
    const finalIncludeContent = includeContent !== undefined ? includeContent : contextDefaults.includeContent;
    const finalTitleOnly = titleOnly !== undefined ? titleOnly : contextDefaults.titleOnly;

    console.log(`🔍 OPTIMIZED SEARCH: "${searchTerm}" (context: ${context}, maxResults: ${finalMaxResults})`);

    const isEmptySearch = !searchTerm || searchTerm.trim().length === 0;
    const searchTermLower = searchTerm?.toLowerCase().trim() || '';

    const allResults: PageSearchResult[] = [];
    const processedIds = new Set<string>();
    const queryPromises: Promise<QuerySnapshot<DocumentData>>[] = [];

    // Build queries based on search parameters
    if (userId) {
      const targetUserId = filterByUserId || userId;

      if (isEmptySearch) {
        const recentPagesQuery = query(
          collection(db, getCollectionName('pages')),
          where('userId', '==', targetUserId),
          limit(Math.min(finalMaxResults, 50))
        );
        queryPromises.push(getDocs(recentPagesQuery));
      } else {
        const titlePrefixQuery = query(
          collection(db, getCollectionName('pages')),
          where('title', '>=', searchTerm),
          where('title', '<=', searchTerm + '\uf8ff'),
          limit(Math.min(finalMaxResults, 100))
        );
        queryPromises.push(getDocs(titlePrefixQuery));

        // Case variations
        const caseVariations = new Set([
          searchTermLower,
          searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1).toLowerCase(),
          searchTerm.toUpperCase(),
          searchTerm.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ')
        ]);

        caseVariations.delete(searchTerm);

        for (const variation of caseVariations) {
          const caseVariationQuery = query(
            collection(db, getCollectionName('pages')),
            where('title', '>=', variation),
            where('title', '<=', variation + '\uf8ff'),
            limit(Math.min(finalMaxResults, 30))
          );
          queryPromises.push(getDocs(caseVariationQuery));
        }
      }
    }

    // All pages search (if not filtering by specific user)
    if (!filterByUserId && !isEmptySearch && searchTerm && searchTerm.length >= 2) {
      const allPagesTitleQuery = query(
        collection(db, getCollectionName('pages')),
        where('title', '>=', searchTerm),
        where('title', '<=', searchTerm + '\uf8ff'),
        limit(Math.min(finalMaxResults, 100))
      );
      queryPromises.push(getDocs(allPagesTitleQuery));
    }

    // Execute all queries in parallel
    console.log(`⚡ [SEARCH DEBUG] Executing ${queryPromises.length} parallel queries`);

    try {
      const queryResults = await Promise.allSettled(queryPromises);

      for (const result of queryResults) {
        if (result.status === 'rejected') {
          console.warn('⚡ [SEARCH DEBUG] Query failed:', result.reason);
          continue;
        }

        const snapshot = result.value;
        snapshot.forEach(docSnap => {
          if (processedIds.has(docSnap.id) || docSnap.id === currentPageId) return;

          const data = docSnap.data();

          if (!data.title && !data.content) return;
          if (data.deleted === true) return;

          const pageTitle = data.title || 'Untitled';

          let isMatch = false;
          let matchScore = 0;
          let isContentMatch = false;

          if (isEmptySearch) {
            isMatch = true;
            matchScore = 50;
          } else {
            const titleScore = calculateSearchScore(pageTitle, searchTerm, true);

            let contentScore = 0;
            if (!finalTitleOnly && finalIncludeContent && titleScore < 80 && data.content) {
              contentScore = calculateSearchScore(data.content, searchTerm, false);
              isContentMatch = contentScore > titleScore;
            }

            matchScore = Math.max(titleScore, contentScore);
            isMatch = matchScore > 0;
          }

          if (isMatch && allResults.length < finalMaxResults) {
            processedIds.add(docSnap.id);

            const resultItem: PageSearchResult = {
              id: docSnap.id,
              title: pageTitle,
              type: 'page',
              isOwned: data.userId === userId,
              isEditable: data.userId === userId,
              userId: data.userId,
              username: data.username || null,
              lastModified: data.lastModified,
              createdAt: data.createdAt,
              matchScore,
              isContentMatch,
              context: context as string
            };

            if (finalIncludeContent && isContentMatch && data.content) {
              resultItem.contentPreview = data.content.substring(0, 200) + '...';
            }

            allResults.push(resultItem);
          }
        });
      }
    } catch (error) {
      console.error('Error in parallel query execution:', error);
    }

    // Comprehensive client-side search for substring matches
    if (!isEmptySearch) {
      console.log(`⚡ [SEARCH DEBUG] Performing comprehensive client-side search`);

      try {
        const broadQuery = query(
          collection(db, getCollectionName('pages')),
          orderBy('lastModified', 'desc'),
          limit(1500)
        );

        const broadSnapshot = await getDocs(broadQuery);
        let broadSearchMatches = 0;

        broadSnapshot.forEach(docSnap => {
          if (processedIds.has(docSnap.id) || docSnap.id === currentPageId) return;
          if (allResults.length >= finalMaxResults * 2) return;

          const data = docSnap.data();
          if (data.deleted === true) return;

          const pageTitle = data.title || '';
          const titleLower = pageTitle.toLowerCase();
          const searchWords = searchTermLower.split(/\s+/).filter((word: string) => word.length > 1);

          let hasMatch = false;

          if (titleLower.includes(searchTermLower)) {
            hasMatch = true;
          }

          if (!hasMatch && searchWords.length > 1) {
            const allWordsFound = searchWords.every((word: string) => titleLower.includes(word));
            if (allWordsFound) {
              hasMatch = true;
            }
          }

          if (!hasMatch && searchWords.length === 1) {
            if (titleLower.includes(searchWords[0])) {
              hasMatch = true;
            }
          }

          if (hasMatch) {
            const matchScore = calculateSearchScore(pageTitle, searchTerm, true);

            if (matchScore > 0) {
              processedIds.add(docSnap.id);
              broadSearchMatches++;

              allResults.push({
                id: docSnap.id,
                title: pageTitle || 'Untitled',
                type: 'page',
                isOwned: data.userId === userId,
                isEditable: data.userId === userId,
                userId: data.userId,
                username: data.username || null,
                lastModified: data.lastModified,
                createdAt: data.createdAt,
                matchScore,
                isContentMatch: false,
                context: context as string
              });
            }
          }
        });

        console.log(`⚡ [SEARCH DEBUG] Comprehensive search added ${broadSearchMatches} additional matches`);
      } catch (error) {
        console.warn('Error in comprehensive client-side search:', error);
      }
    }

    // Sort results by relevance
    allResults.sort((a, b) => {
      if (a.isOwned && !b.isOwned) return -1;
      if (!a.isOwned && b.isOwned) return 1;
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      const aLen = (a.title || '').length;
      const bLen = (b.title || '').length;
      if (Math.abs(aLen - bLen) > 10) return aLen - bLen;
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
    });

    const finalResults = allResults.slice(0, finalMaxResults);
    const searchTime = Date.now() - searchStartTime;

    console.log(`⚡ OPTIMIZED SEARCH COMPLETE: ${finalResults.length} results in ${searchTime}ms`);

    return finalResults;
  } catch (error) {
    console.error('❌ Error in optimized search:', error);
    return [];
  }
}

/**
 * Search users with comprehensive matching
 */
async function searchUsersComprehensive(searchTerm: string, maxResults: number = 20): Promise<UserSearchResult[]> {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }

  try {
    const searchLower = searchTerm.toLowerCase().trim();
    const results = new Map<string, UserSearchResult>();

    try {
      const broadQuery = query(
        collection(db, getCollectionName('users')),
        limit(500)
      );
      const broadResults = await getDocs(broadQuery);

      broadResults.forEach(docSnap => {
        const userData = docSnap.data();
        const username = userData.username || '';
        const usernameLower = (userData.usernameLower || username).toLowerCase();

        if (!username || username.includes('@') || username === 'Anonymous' || username.toLowerCase().includes('missing')) {
          return;
        }

        const usernameMatch = usernameLower.includes(searchLower);

        if (usernameMatch) {
          const matchScore = calculateSearchScore(username, searchTerm, true);
          results.set(docSnap.id, {
            id: docSnap.id,
            username,
            photoURL: userData.photoURL || null,
            type: 'user',
            matchScore
          });
        }
      });
    } catch (error) {
      console.error('Error in comprehensive user search:', error);
    }

    const sortedResults = Array.from(results.values()).sort((a, b) => {
      if (a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return (a.username || '').localeCompare(b.username || '');
    });

    return sortedResults.slice(0, maxResults);

  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

/**
 * Search using Algolia
 */
async function searchWithAlgolia(
  searchTerm: string,
  userId: string | null,
  options: AlgoliaSearchOptions = {}
): Promise<{ pages: PageSearchResult[]; users: UserSearchResult[]; source: string; totalPages: number; totalUsers: number }> {
  const {
    maxResults = 100,
    includeUsers = true,
    filterByUserId = null,
    currentPageId = null,
    context = SEARCH_CONTEXTS.MAIN
  } = options;

  console.log(`🚀 [ALGOLIA] Searching for "${searchTerm}" (maxResults: ${maxResults}, includeUsers: ${includeUsers})`);

  try {
    let filters = '';
    if (filterByUserId) {
      filters = `authorId:${filterByUserId}`;
    }

    const [pagesResponse, usersResponse] = await Promise.all([
      searchPages(searchTerm, {
        hitsPerPage: Math.min(maxResults, 100),
        filters: filters || undefined
      }),
      includeUsers ? algoliaSearchUsers(searchTerm, { hitsPerPage: 10 }) : Promise.resolve({ hits: [], nbHits: 0 })
    ]);

    const pages: PageSearchResult[] = (pagesResponse.hits as Array<{
      objectID: string;
      title?: string;
      authorId?: string;
      authorUsername?: string;
      lastModified?: string;
      isPublic?: boolean;
      alternativeTitles?: string[];
      _highlightResult?: unknown;
    }>)
      .filter(hit => hit.objectID !== currentPageId)
      .map(hit => ({
        id: hit.objectID,
        title: hit.title || 'Untitled',
        type: 'page' as const,
        isOwned: hit.authorId === userId,
        isEditable: hit.authorId === userId,
        userId: hit.authorId || '',
        username: hit.authorUsername || null,
        lastModified: hit.lastModified || '',
        isPublic: hit.isPublic,
        alternativeTitles: hit.alternativeTitles,
        matchScore: 100,
        isContentMatch: false,
        context,
        _highlightResult: hit._highlightResult
      }));

    const users: UserSearchResult[] = ((usersResponse.hits || []) as Array<{
      objectID: string;
      username?: string;
      displayName?: string;
      photoURL?: string;
      _highlightResult?: unknown;
    }>).map(hit => ({
      id: hit.objectID,
      username: hit.username || '',
      displayName: hit.displayName,
      photoURL: hit.photoURL || null,
      type: 'user' as const,
      matchScore: 100,
      _highlightResult: hit._highlightResult
    }));

    console.log(`🚀 [ALGOLIA] Found ${pages.length} pages, ${users.length} users`);

    return {
      pages,
      users,
      source: 'algolia',
      totalPages: pagesResponse.nbHits || 0,
      totalUsers: (usersResponse as { nbHits?: number }).nbHits || 0
    };
  } catch (error) {
    console.error('🚀 [ALGOLIA] Search failed, falling back to Firestore:', error);
    throw error;
  }
}

/**
 * Main API route handler - GET
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let searchTerm = '';
  let userId: string | null = null;

  try {
    const { searchParams } = new URL(request.url);

    searchTerm = searchParams.get('searchTerm') || searchParams.get('q') || '';
    userId = searchParams.get('userId') || null;
    const context = searchParams.get('context') || SEARCH_CONTEXTS.MAIN;
    const maxResults = parseInt(searchParams.get('maxResults') || '') || null;
    const includeContent = searchParams.get('includeContent') !== 'false';
    const includeUsers = searchParams.get('includeUsers') !== 'false';
    const titleOnly = searchParams.get('titleOnly') === 'true';
    const filterByUserId = searchParams.get('filterByUserId') || null;
    const currentPageId = searchParams.get('currentPageId') || null;

    // Check cache first
    const cacheKey = getCacheKey(searchTerm, userId, context, maxResults, filterByUserId);
    const cachedResult = getCachedResult(cacheKey);

    if (cachedResult) {
      console.log(`🚀 CACHE HIT: Search served from cache`);

      recordProductionRead('/api/search-unified', 'search-cached', 0, {
        userId,
        cacheStatus: 'HIT',
        responseTime: 0,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      });

      return NextResponse.json({
        ...cachedResult,
        cached: true,
        cacheAge: Date.now() - (cachedResult.timestamp || 0)
      });
    }

    console.log(`🔍 Unified Search API called:`, {
      searchTerm,
      userId,
      context,
      maxResults,
      includeContent,
      includeUsers,
      titleOnly,
      useAlgolia: USE_ALGOLIA
    });

    // Handle empty search
    if (!searchTerm || searchTerm.trim().length === 0) {
      if (userId) {
        try {
          const pages = await searchPagesComprehensive(userId, '', {
            context,
            maxResults: maxResults || 50,
            includeContent: false,
            titleOnly: true,
            filterByUserId,
            currentPageId
          });

          const emptySearchResult: SearchResult = {
            pages: pages || [],
            users: [],
            source: 'unified_empty_search',
            searchTerm: '',
            performance: {
              searchTimeMs: Date.now() - startTime,
              pagesFound: pages?.length || 0,
              usersFound: 0
            }
          };

          setCachedResult(cacheKey, emptySearchResult, SEARCH_CACHE_TTL.EMPTY_SEARCH);

          recordProductionRead('/api/search-unified', 'empty-search', pages?.length || 0, {
            userId,
            cacheStatus: 'MISS',
            responseTime: Date.now() - startTime,
            userAgent: request.headers.get('user-agent'),
            referer: request.headers.get('referer')
          });

          return NextResponse.json(emptySearchResult, { status: 200 });
        } catch (error) {
          console.error('Error in empty search:', error);
          return NextResponse.json({
            pages: [],
            users: [],
            error: 'Search temporarily unavailable',
            source: 'unified_empty_search_error'
          }, { status: 200 });
        }
      } else {
        return NextResponse.json({
          pages: [],
          users: [],
          source: 'unified_empty_unauthenticated'
        }, { status: 200 });
      }
    }

    // Try Algolia first if enabled
    let pages: PageSearchResult[] = [];
    let users: UserSearchResult[] = [];
    let searchSource = 'firestore';

    if (USE_ALGOLIA) {
      try {
        const algoliaResults = await searchWithAlgolia(searchTerm, userId, {
          maxResults: maxResults || 100,
          includeUsers,
          filterByUserId,
          currentPageId,
          context
        });
        pages = algoliaResults.pages;
        users = algoliaResults.users;
        searchSource = 'algolia';
        console.log(`🚀 [ALGOLIA] Search successful: ${pages.length} pages, ${users.length} users`);
      } catch (algoliaError) {
        console.warn(`🚀 [ALGOLIA] Failed, falling back to Firestore:`, (algoliaError as Error).message);
      }
    }

    // Firestore fallback
    if (searchSource !== 'algolia') {
      const [firestorePages, firestoreUsers] = await Promise.all([
        searchPagesComprehensive(userId, searchTerm, {
          context,
          maxResults,
          includeContent,
          titleOnly,
          filterByUserId,
          currentPageId
        }),
        includeUsers ? searchUsersComprehensive(searchTerm, 10) : Promise.resolve([])
      ]);
      pages = firestorePages;
      users = firestoreUsers;
      searchSource = 'firestore';
    }

    // Batch fetch missing usernames
    console.log(`🔍 [USERNAME FETCH] Processing ${(pages || []).length} pages for username fetching`);

    const needsUsernameFetch = (page: PageSearchResult): boolean =>
      !page.username ||
      page.username === 'Anonymous' ||
      page.username === 'NULL' ||
      page.username === 'Missing username' ||
      (page.username && page.username.length >= 20 && /^[a-zA-Z0-9]+$/.test(page.username));

    const userIdsToFetch = [...new Set(
      (pages || [])
        .filter(page => needsUsernameFetch(page) && page.userId)
        .map(page => page.userId)
    )];

    console.log(`🔍 [USERNAME FETCH] Need to fetch ${userIdsToFetch.length} unique usernames`);

    const usernameMap = new Map<string, string>();
    if (userIdsToFetch.length > 0) {
      try {
        const batchSize = 30;
        for (let i = 0; i < userIdsToFetch.length; i += batchSize) {
          const batch = userIdsToFetch.slice(i, i + batchSize);
          const userDocs = await Promise.all(
            batch.map(uid => getDoc(doc(db, getCollectionName('users'), uid)))
          );
          userDocs.forEach((userDoc, index) => {
            if (userDoc.exists()) {
              usernameMap.set(batch[index], userDoc.data().username || 'Missing Username');
            } else {
              usernameMap.set(batch[index], 'Missing Username');
            }
          });
        }
        console.log(`🔍 [USERNAME FETCH] Batch fetched ${usernameMap.size} usernames`);
      } catch (error) {
        console.error(`🔍 [USERNAME FETCH] Error in batch username fetch:`, error);
      }
    }

    const pagesWithUsernames = (pages || []).map(page => {
      if (needsUsernameFetch(page) && page.userId && usernameMap.has(page.userId)) {
        page.username = usernameMap.get(page.userId) || null;
      }
      return page;
    });

    const searchTime = Date.now() - startTime;

    console.log(`✅ Unified search completed in ${searchTime}ms:`, {
      pagesFound: pages?.length || 0,
      usersFound: users?.length || 0,
      searchTerm,
      context
    });

    const totalResults = (pagesWithUsernames?.length || 0) + (users?.length || 0);
    searchPerformanceTracker.recordSearch(
      searchTerm,
      startTime,
      Date.now(),
      totalResults,
      false,
      'unified_search_api'
    );

    const searchResult: SearchResult = {
      pages: pagesWithUsernames || [],
      users: users || [],
      source: searchSource === 'algolia' ? 'algolia' : 'unified_search',
      searchTerm,
      context,
      performance: {
        searchTimeMs: searchTime,
        pagesFound: pagesWithUsernames?.length || 0,
        usersFound: users?.length || 0,
        maxResults: maxResults || 'unlimited',
        searchEngine: searchSource
      }
    };

    const isEmptySearch = !searchTerm || searchTerm.trim().length === 0;
    const cacheTTL = isEmptySearch ? SEARCH_CACHE_TTL.EMPTY_SEARCH :
                     userId ? SEARCH_CACHE_TTL.USER_SEARCH : SEARCH_CACHE_TTL.TERM_SEARCH;

    setCachedResult(cacheKey, searchResult, cacheTTL);

    recordProductionRead('/api/search-unified', 'search-fresh',
      (pagesWithUsernames?.length || 0) + (users?.length || 0), {
        userId,
        cacheStatus: 'MISS',
        responseTime: searchTime,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      });

    console.log(`🔍 Search completed and cached: ${pagesWithUsernames?.length || 0} pages, ${users?.length || 0} users in ${searchTime}ms`);

    return NextResponse.json(searchResult, { status: 200 });

  } catch (error) {
    console.error('❌ Error in unified search API:', error);

    searchPerformanceTracker.recordSearch(
      searchTerm || '',
      startTime,
      Date.now(),
      0,
      false,
      'unified_search_api',
      error as Error
    );

    return NextResponse.json({
      pages: [],
      users: [],
      error: 'Search temporarily unavailable',
      source: 'unified_search_error'
    }, { status: 500 });
  }
}
