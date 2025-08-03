import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { createErrorResponse, createSuccessResponse } from '../../../utils/apiHelpers';

/**
 * GET /api/pages/similar?pageId=xxx&title=xxx&maxPages=3
 * 
 * Find pages similar to the current page based on title keywords.
 * Environment-aware API replacement for SimilarPages direct Firebase calls.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const title = searchParams.get('title');
    const maxPages = parseInt(searchParams.get('maxPages') || '3');

    if (!pageId || !title) {
      return createErrorResponse('BAD_REQUEST', 'pageId and title are required');
    }

    console.log('🔍 [SIMILAR PAGES API] Finding similar pages for:', { pageId, title, maxPages });

    // Use environment-aware collection naming
    const pagesRef = db.collection(getCollectionName('pages'));

    // Extract significant words from title
    const titleWords = title
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length >= 3)
      .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'to', 'of', 'in', 'on', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could'].includes(word));

    let similarPages = [];

    if (titleWords.length === 0) {
      // If no significant words, use a generic query for recent public pages
      console.log('🔍 [SIMILAR PAGES API] No significant words, using generic query');
      
      const genericQuery = pagesRef
        .where('isPublic', '==', true)
        .where('deleted', '!=', true)
        .orderBy('lastModified', 'desc')
        .limit(maxPages * 2);

      const snapshot = await genericQuery.get();
      similarPages = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(page => page.id !== pageId)
        .slice(0, maxPages);

    } else {
      // Search for pages with similar title words
      console.log('🔍 [SIMILAR PAGES API] Searching with keywords:', titleWords);
      
      const allPages = new Map();
      const scoreMap = new Map();

      // For each significant word, find pages that might contain it
      for (const word of titleWords.slice(0, 5)) { // Limit to first 5 words for performance
        try {
          // Query for pages that might contain this word in title
          // Since Firestore doesn't support full-text search, we'll get recent public pages
          // and filter client-side (this is a limitation we'll note)
          const wordQuery = pagesRef
            .where('isPublic', '==', true)
            .where('deleted', '!=', true)
            .orderBy('lastModified', 'desc')
            .limit(100); // Get more pages to filter from

          const snapshot = await wordQuery.get();
          
          snapshot.docs.forEach(doc => {
            const pageData = { id: doc.id, ...doc.data() };
            
            // Skip the current page
            if (pageData.id === pageId) return;
            
            // Check if the page title contains the word
            const pageTitle = (pageData.title || '').toLowerCase();
            if (pageTitle.includes(word)) {
              allPages.set(pageData.id, pageData);
              
              // Increase score for each matching word
              const currentScore = scoreMap.get(pageData.id) || 0;
              scoreMap.set(pageData.id, currentScore + 1);
            }
          });
        } catch (error) {
          console.warn('🔍 [SIMILAR PAGES API] Error searching for word:', word, error);
        }
      }

      // Sort pages by score (number of matching words) and take top results
      similarPages = Array.from(allPages.values())
        .sort((a, b) => {
          const scoreA = scoreMap.get(a.id) || 0;
          const scoreB = scoreMap.get(b.id) || 0;
          if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first
          
          // If same score, sort by last modified
          const dateA = a.lastModified?.toDate?.() || new Date(0);
          const dateB = b.lastModified?.toDate?.() || new Date(0);
          return dateB - dateA;
        })
        .slice(0, maxPages);
    }

    console.log('🔍 [SIMILAR PAGES API] Found similar pages:', similarPages.length);

    return createSuccessResponse({
      pages: similarPages,
      totalFound: similarPages.length,
      searchTerms: titleWords
    });

  } catch (error) {
    console.error('❌ [SIMILAR PAGES API] Error finding similar pages:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to find similar pages');
  }
}
