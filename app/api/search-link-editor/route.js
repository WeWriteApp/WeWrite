import { NextResponse } from "next/server";

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

/**
 * Lightweight search function optimized specifically for link editor
 * 
 * Key optimizations for link editor:
 * - Title-only search (no content search needed)
 * - Minimal field selection (only title, id, userId, isPublic)
 * - Smaller result limits (20-30 results max)
 * - Faster response times for better UX
 * - Excludes current page from results
 */
async function searchPagesForLinkEditor(userId, searchTerm, currentPageId = null, maxResults = 25) {
  try {
    const isEmptySearch = !searchTerm || searchTerm.trim().length === 0;
    
    // Import Firestore modules
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database');

    const searchTermLower = searchTerm.toLowerCase().trim();
    const allResults = [];

    console.log(`🔗 Link editor search for: "${searchTermLower}" (maxResults: ${maxResults})`);

    // Minimal fields for link editor - MAJOR OPTIMIZATION
    const linkEditorFields = ['title', 'userId', 'username', 'isPublic', 'lastModified'];

    // STEP 1: Search user's own pages (higher priority for link editor)
    if (userId) {
      const userQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        where('deleted', '!=', true),
        orderBy('deleted'),
        orderBy('lastModified', 'desc'),
        limit(Math.min(maxResults, 50)) // Small limit for fast response
      );

      try {
        const userPagesSnapshot = await getDocs(userQuery);
        console.log(`📄 Link editor found ${userPagesSnapshot.size} user pages`);

        userPagesSnapshot.forEach(doc => {
          // Skip current page to prevent self-referential links
          if (currentPageId && doc.id === currentPageId) {
            return;
          }

          const data = doc.data();
          const pageTitle = data.title || 'Untitled';
          const normalizedTitle = pageTitle.toLowerCase();

          // Also search in page content like the main search API
          const pageContent = data.content || '';
          const normalizedContent = pageContent.toLowerCase();

          let isMatch = false;
          if (isEmptySearch) {
            isMatch = true;
          } else {
            // Enhanced search logic - check both title and content (like main search API)
            const titleMatch = normalizedTitle.includes(searchTermLower) ||
                             normalizedTitle.startsWith(searchTermLower) ||
                             pageTitle.toLowerCase().split(/\s+/).some(word =>
                               word.startsWith(searchTermLower) ||
                               word === searchTermLower ||
                               (searchTermLower.endsWith('s') && word === searchTermLower.slice(0, -1)) ||
                               (word.endsWith('s') && searchTermLower === word.slice(0, -1))
                             );

            const contentMatch = pageContent && normalizedContent.includes(searchTermLower);
            isMatch = titleMatch || contentMatch;
          }

          if (isMatch && allResults.length < maxResults) {
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: true,
              isEditable: true,
              userId: data.userId,
              username: data.username || null,
              isPublic: data.isPublic,
              lastModified: data.lastModified,
              type: 'user'
            });
          }
        });
      } catch (queryError) {
        console.warn('Error in link editor user pages query:', queryError);
      }
    }

    // STEP 2: Search public pages (if we haven't reached the limit)
    if (allResults.length < maxResults) {
      const remainingSlots = maxResults - allResults.length;
      
      const publicQuery = query(
        collection(db, 'pages'),
        where('isPublic', '==', true),
        where('deleted', '!=', true),
        orderBy('deleted'),
        orderBy('lastModified', 'desc'),
        limit(Math.min(remainingSlots * 2, 30)) // Small limit for fast response
      );

      try {
        const publicPagesSnapshot = await getDocs(publicQuery);
        console.log(`🌐 Link editor found ${publicPagesSnapshot.size} public pages`);

        publicPagesSnapshot.forEach(doc => {
          // Skip current page and user's own pages
          if ((currentPageId && doc.id === currentPageId) || 
              (userId && doc.data().userId === userId)) {
            return;
          }

          const data = doc.data();
          const pageTitle = data.title || 'Untitled';
          const normalizedTitle = pageTitle.toLowerCase();

          // Also search in page content like the main search API
          const pageContent = data.content || '';
          const normalizedContent = pageContent.toLowerCase();

          let isMatch = false;
          if (isEmptySearch) {
            isMatch = true;
          } else {
            // Enhanced search logic - check both title and content (like main search API)
            const titleMatch = normalizedTitle.includes(searchTermLower) ||
                             normalizedTitle.startsWith(searchTermLower) ||
                             pageTitle.toLowerCase().split(/\s+/).some(word =>
                               word.startsWith(searchTermLower) ||
                               word === searchTermLower ||
                               (searchTermLower.endsWith('s') && word === searchTermLower.slice(0, -1)) ||
                               (word.endsWith('s') && searchTermLower === word.slice(0, -1))
                             );

            const contentMatch = pageContent && normalizedContent.includes(searchTermLower);
            isMatch = titleMatch || contentMatch;
          }

          if (isMatch && allResults.length < maxResults) {
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              username: data.username || null,
              isPublic: data.isPublic,
              lastModified: data.lastModified,
              type: 'public'
            });
          }
        });
      } catch (queryError) {
        console.warn('Error in link editor public pages query:', queryError);
      }
    }

    console.log(`🔗 Link editor total matches found: ${allResults.length}`);

    // Simple sorting for link editor (no complex scoring needed)
    let finalResults;
    if (isEmptySearch) {
      // For empty searches, prioritize user's own pages, then sort by recency
      finalResults = allResults.sort((a, b) => {
        // User's own pages first
        if (a.isOwned && !b.isOwned) return -1;
        if (!a.isOwned && b.isOwned) return 1;
        
        // Then by recency
        const aTime = new Date(a.lastModified || 0).getTime();
        const bTime = new Date(b.lastModified || 0).getTime();
        return bTime - aTime;
      });
    } else {
      // For searches, prioritize exact title matches, then user's own pages
      finalResults = allResults.sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        
        // Exact matches first
        const aExact = aTitle === searchTermLower;
        const bExact = bTitle === searchTermLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Title starts with search term
        const aStarts = aTitle.startsWith(searchTermLower);
        const bStarts = bTitle.startsWith(searchTermLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // User's own pages
        if (a.isOwned && !b.isOwned) return -1;
        if (!a.isOwned && b.isOwned) return 1;
        
        // Finally by recency
        const aTime = new Date(a.lastModified || 0).getTime();
        const bTime = new Date(b.lastModified || 0).getTime();
        return bTime - aTime;
      });
    }

    return finalResults.slice(0, maxResults);

  } catch (error) {
    console.error('❌ Error in link editor search:', error);
    return [];
  }
}

export async function GET(request) {
  try {
    // Extract query parameters from the URL
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const searchTerm = searchParams.get("searchTerm") || "";
    const currentPageId = searchParams.get("currentPageId"); // Exclude current page
    const maxResults = parseInt(searchParams.get("maxResults") || "25");

    console.log(`🔗 Link Editor Search API called:`, {
      searchTerm,
      userId,
      currentPageId,
      maxResults,
      timestamp: new Date().toISOString()
    });

    const startTime = Date.now();

    // Use specialized link editor search function
    const pages = await searchPagesForLinkEditor(userId, searchTerm, currentPageId, maxResults);
    
    const searchTime = Date.now() - startTime;
    console.log(`🔗 Link editor search completed in ${searchTime}ms. Found ${pages?.length || 0} pages`);

    const response = {
      pages: pages || [],
      source: "link_editor_optimized",
      searchTerm: searchTerm,
      userId: userId,
      performance: {
        searchTimeMs: searchTime,
        pagesFound: pages?.length || 0,
        maxResults,
        currentPageExcluded: !!currentPageId
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Unexpected error in link editor search API:', error);
    return NextResponse.json({
      pages: [],
      error: 'Search temporarily unavailable',
      source: "link_editor_search_error"
    }, { status: 200 });
  }
}
