import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';

interface RecentSearch {
  term: string;
  timestamp: number;
}

const MAX_RECENT_SEARCHES = 10;

/**
 * GET /api/user-preferences/recent-searches
 * Get user's recent searches from database
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get user preferences document
    const preferencesRef = db.collection(getCollectionName(COLLECTIONS.USER_PREFERENCES)).doc(userId);
    const preferencesDoc = await preferencesRef.get();

    if (!preferencesDoc.exists) {
      // Return empty array if no preferences exist
      return createApiResponse({
        recentSearches: []
      });
    }

    const data = preferencesDoc.data();
    const recentSearches = data?.recentSearches || [];

    // Ensure it's an array and validate structure
    const validSearches = Array.isArray(recentSearches) 
      ? recentSearches.filter(search => 
          search && 
          typeof search.term === 'string' && 
          typeof search.timestamp === 'number'
        )
      : [];

    return createApiResponse({
      recentSearches: validSearches
    });

  } catch (error) {
    console.error('[Recent Searches GET] Error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to get recent searches');
  }
}

/**
 * POST /api/user-preferences/recent-searches
 * Add a new search term to user's recent searches
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const { searchTerm } = await request.json();

    // Validate search term
    if (!searchTerm || typeof searchTerm !== 'string') {
      return createErrorResponse('BAD_REQUEST', 'Search term is required');
    }

    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) {
      return createErrorResponse('BAD_REQUEST', 'Search term cannot be empty');
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get current preferences
    const preferencesRef = db.collection(getCollectionName(COLLECTIONS.USER_PREFERENCES)).doc(userId);
    const preferencesDoc = await preferencesRef.get();

    let recentSearches: RecentSearch[] = [];
    
    if (preferencesDoc.exists) {
      const data = preferencesDoc.data();
      recentSearches = Array.isArray(data?.recentSearches) ? data.recentSearches : [];
    }

    // Remove existing search term if it exists (to avoid duplicates and move to front)
    recentSearches = recentSearches.filter(search => 
      search.term.toLowerCase() !== trimmedTerm.toLowerCase()
    );

    // Add new search term to the beginning
    recentSearches.unshift({
      term: trimmedTerm,
      timestamp: Date.now()
    });

    // Keep only the most recent searches
    recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);

    // Update user preferences
    await preferencesRef.set({
      recentSearches,
      updatedAt: new Date()
    }, { merge: true });

    return createApiResponse({
      success: true,
      recentSearches
    });

  } catch (error) {
    console.error('[Recent Searches POST] Error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to save recent search');
  }
}

/**
 * DELETE /api/user-preferences/recent-searches
 * Clear all recent searches for the user, or remove a specific search term
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('term');

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const preferencesRef = db.collection(getCollectionName(COLLECTIONS.USER_PREFERENCES)).doc(userId);

    if (searchTerm) {
      // Remove specific search term
      const preferencesDoc = await preferencesRef.get();
      let recentSearches: RecentSearch[] = [];

      if (preferencesDoc.exists) {
        const data = preferencesDoc.data();
        recentSearches = Array.isArray(data?.recentSearches) ? data.recentSearches : [];
      }

      // Filter out the specific search term
      recentSearches = recentSearches.filter(search =>
        search.term.toLowerCase() !== searchTerm.toLowerCase()
      );

      await preferencesRef.set({
        recentSearches,
        updatedAt: new Date()
      }, { merge: true });

      return createApiResponse({
        success: true,
        message: 'Search term removed',
        recentSearches
      });
    } else {
      // Clear all recent searches
      await preferencesRef.set({
        recentSearches: [],
        updatedAt: new Date()
      }, { merge: true });

      return createApiResponse({
        success: true,
        message: 'Recent searches cleared'
      });
    }

  } catch (error) {
    console.error('[Recent Searches DELETE] Error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to clear recent searches');
  }
}
