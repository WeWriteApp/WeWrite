import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/admin';
import { getCollectionName } from '../../utils/environmentConfig';

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
    const backgroundImagesRef = db.collection(getCollectionName('defaultBackgroundImages'));
    const snapshot = await backgroundImagesRef
      .where('active', '==', true)
      .orderBy('order', 'asc')
      .get();
    
    const images: DefaultBackgroundImage[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      images.push({
        id: doc.id,
        filename: data.filename,
        url: data.url,
        order: data.order,
        active: data.active
      });
    });

    return NextResponse.json({
      success: true,
      images,
      count: images.length
    });

  } catch (error) {
    console.error('[API] Error fetching background images:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch background images'
      },
      { status: 500 }
    );
  }
}
