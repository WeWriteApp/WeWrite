/**
 * EMERGENCY COST OPTIMIZATION: Batch Page Loading API
 * 
 * This API allows loading multiple pages in a single request to dramatically
 * reduce Firestore reads from individual page API calls.
 * 
 * Instead of 11 individual API calls (11+ reads each), this does 1 batch read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';

// EMERGENCY COST OPTIMIZATION: Batch page cache
const batchPageCache = new Map<string, { data: any; timestamp: number }>();
const BATCH_CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { pageIds } = await request.json();

    if (!pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return NextResponse.json(
        { error: 'pageIds array is required' },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    if (pageIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 pages per batch request' },
        { status: 400 }
      );
    }

    // Get the current user ID for access control
    const userId = await getUserIdFromRequest(request);

    // EMERGENCY COST OPTIMIZATION: Check cache first
    const cacheKey = `batch-pages:${pageIds.sort().join(',')}:${userId || 'anon'}`;
    const cached = batchPageCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < BATCH_CACHE_TTL) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
    }

    // OPTIMIZATION: Import modules in parallel
    const [
      { getFirebaseAdmin },
      { getCollectionName }
    ] = await Promise.all([
      import('../../../firebase/admin'),
      import('../../../utils/environmentConfig')
    ]);

    // Get Firebase Admin instance
    let admin;
    try {
      admin = getFirebaseAdmin();
    } catch (error) {
      console.error('Error getting Firebase Admin:', error);
      return NextResponse.json(
        { error: 'Firebase Admin initialization failed' },
        { status: 500 }
      );
    }

    if (!admin) {
      console.error('Firebase Admin not available');
      return NextResponse.json(
        { error: 'Firebase Admin not available' },
        { status: 500 }
      );
    }

    const db = admin.firestore();
    const pagesCollection = db.collection(getCollectionName('pages'));

    // CRITICAL OPTIMIZATION: Batch read all pages in a single query
    
    const batchQuery = pagesCollection.where(admin.firestore.FieldPath.documentId(), 'in', pageIds);
    const querySnapshot = await batchQuery.get();


    const pages: Record<string, any> = {};
    const rtdbPromise = admin.database(); // Pre-start RTDB connection

    // Process all pages
    for (const doc of querySnapshot.docs) {
      const pageData = doc.data();
      const pageId = doc.id;

      // CRITICAL: Check if page is soft-deleted
      if (pageData.deleted === true) {
        if (userId && pageData.userId === userId) {
        } else {
          // Skip deleted pages for non-owners
          continue;
        }
      }

      // Skip private group pages for non-members
      if (pageData.visibility === 'private' && pageData.groupId) {
        if (!userId || pageData.userId !== userId) {
          // Non-owner: skip private pages (group membership not checked in batch for performance)
          continue;
        }
      }

      // Get author information (use cached username first)
      let authorUsername = pageData.username || null;

      // Only fetch from RTDB if we don't have a username
      if (!authorUsername && pageData.userId) {
        try {
          const rtdb = await rtdbPromise;
          const userRef = rtdb.ref(`users/${pageData.userId}`);
          const userSnapshot = await userRef.once('value');

          if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            authorUsername = userData.username || null;
          }
        } catch (userError) {
          console.error(`Error fetching user data for ${pageData.userId}:`, userError);
        }
      }

      // Build page response
      pages[pageId] = {
        id: pageId,
        title: pageData.title || 'Untitled',
        content: pageData.content || '',
        userId: pageData.userId,
        // Only use username - displayName is deprecated
        username: authorUsername,
        createdAt: pageData.createdAt,
        lastModified: pageData.lastModified,
        isPublic: pageData.isPublic || false,
        totalPledged: pageData.totalPledged || 0,
        pledgeCount: pageData.pledgeCount || 0,
        customDate: pageData.customDate || null,
        location: pageData.location || null,
        deleted: pageData.deleted || false
      };
    }

    // Add missing pages as null (not found)
    for (const pageId of pageIds) {
      if (!pages[pageId]) {
        pages[pageId] = null;
      }
    }

    const responseData = {
      pages,
      totalRequested: pageIds.length,
      totalFound: Object.values(pages).filter(p => p !== null).length,
      queryTime: Date.now() - startTime
    };

    // EMERGENCY COST OPTIMIZATION: Cache the response
    batchPageCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });


    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error in batch page loading:', error);
    return NextResponse.json(
      {
        error: 'Failed to load pages in batch',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
