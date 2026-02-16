import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

/**
 * GET /api/timeline
 * 
 * Efficiently fetches pages with custom dates for timeline view
 * Returns pages organized by their custom date field (user-assigned dates)
 * 
 * Query parameters:
 * - userId: The user ID to fetch pages for (required)
 * - startDate: Start date in YYYY-MM-DD format (optional)
 * - endDate: End date in YYYY-MM-DD format (optional)
 */

export async function GET(request: NextRequest) {
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('📅 [timeline API] Firebase Admin not initialized');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const db = admin.firestore();

    // Build query to get ALL pages for the user first, then filter for custom dates
    let pagesQuery = db.collection(getCollectionName('pages'))
      .where('userId', '==', userId);


    const snapshot = await pagesQuery.get();

    const pages = snapshot.docs
      .map(doc => {
        const data = doc.data();
        
        // Normalize timestamps
        let normalizedLastModified = null;
        let normalizedCreatedAt = null;

        if (data.lastModified) {
          if (typeof data.lastModified === 'string') {
            normalizedLastModified = data.lastModified;
          } else if (data.lastModified?.seconds) {
            normalizedLastModified = new Date(data.lastModified.seconds * 1000).toISOString();
          }
        }

        if (data.createdAt) {
          if (typeof data.createdAt === 'string') {
            normalizedCreatedAt = data.createdAt;
          } else if (data.createdAt?.seconds) {
            normalizedCreatedAt = new Date(data.createdAt.seconds * 1000).toISOString();
          }
        }

        return {
          id: doc.id,
          title: data.title || 'Untitled',
          customDate: data.customDate,
          lastModified: normalizedLastModified,
          createdAt: normalizedCreatedAt,
          deleted: data.deleted || false
        };
      })
      .filter(page => {
        // Filter out deleted pages
        if (page.deleted) return false;

        // Only include pages with customDate field
        if (!page.customDate) return false;

        // Apply date range filter if specified
        if (startDate && page.customDate < startDate) return false;
        if (endDate && page.customDate > endDate) return false;

        return true;
      });


    // Debug: Show first few pages to understand what we're returning
    if (pages.length > 0) {
    }

    return NextResponse.json({
      success: true,
      pages,
      count: pages.length
    });

  } catch (error) {
    console.error('📅 [timeline API] Error fetching timeline pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline pages' },
      { status: 500 }
    );
  }
}
