import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    const admin = initAdmin();
    const db = admin.firestore();

    // Get all pages and check for location data
    const pagesRef = db.collection(getCollectionName('pages'));
    const snapshot = await pagesRef.limit(100).get();

    const results = {
      totalPages: snapshot.size,
      pagesWithLocation: 0,
      pagesWithoutLocation: 0,
      locationFormats: {
        object: 0,
        string: 0,
        invalid: 0
      },
      samplePages: [] as any[]
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      const pageInfo = {
        id: doc.id,
        title: data.title,
        userId: data.userId,
        username: data.username,
        location: data.location,
        locationType: typeof data.location,
        hasLocation: !!data.location
      };

      if (data.location) {
        results.pagesWithLocation++;
        
        if (typeof data.location === 'object' && data.location.lat && data.location.lng) {
          results.locationFormats.object++;
        } else if (typeof data.location === 'string') {
          results.locationFormats.string++;
        } else {
          results.locationFormats.invalid++;
        }

        // Add to sample if we have less than 10
        if (results.samplePages.length < 10) {
          results.samplePages.push(pageInfo);
        }
      } else {
        results.pagesWithoutLocation++;
      }
    });

    return NextResponse.json({
      success: true,
      results,
      message: `Found ${results.pagesWithLocation} pages with location data out of ${results.totalPages} total pages`
    });

  } catch (error) {
    console.error('Error checking locations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check locations' },
      { status: 500 }
    );
  }
}
