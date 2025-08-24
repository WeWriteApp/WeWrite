import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/admin';
import { getCollectionName, COLLECTIONS } from '../../utils/environmentConfig';

interface DefaultBackgroundImage {
  id: string;
  filename: string;
  url: string;
  order: number;
  active: boolean;
}

/**
 * GET /api/background-images
 * Fetch active default background images for all users
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get only active default background images
    const backgroundImagesRef = db.collection(getCollectionName(COLLECTIONS.DEFAULT_BACKGROUND_IMAGES));

    // Use a simpler query first to avoid index issues on empty collections
    let snapshot;
    try {
      snapshot = await backgroundImagesRef
        .where('active', '==', true)
        .orderBy('order', 'asc')
        .get();
    } catch (indexError) {
      // If the composite index doesn't exist, fall back to a simpler query
      console.log('[API] Composite index not available, using simple query:', indexError.message);
      try {
        snapshot = await backgroundImagesRef
          .where('active', '==', true)
          .get();
      } catch (simpleQueryError) {
        // If even the simple query fails, return empty results
        console.log('[API] Simple query also failed, returning empty results:', simpleQueryError.message);
        return NextResponse.json({
          success: true,
          images: [],
          count: 0
        });
      }
    }

    const images: DefaultBackgroundImage[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      images.push({
        id: doc.id,
        filename: data.filename,
        url: data.url,
        order: data.order || 0,
        active: data.active
      });
    });

    // Sort by order if we used the fallback query
    if (images.length > 0) {
      images.sort((a, b) => a.order - b.order);
    }

    return NextResponse.json({
      success: true,
      images,
      count: images.length
    });

  } catch (error) {
    console.error('[API] Error fetching background images:', error);

    // Return empty array instead of error for non-existent collections
    // This allows the UI to show "No default backgrounds available" instead of an error
    return NextResponse.json({
      success: true,
      images: [],
      count: 0
    });
  }
}
