import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * POST /api/analytics/page-view
 * Record a page view for analytics
 */
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const { pageId, userId } = await request.json();

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    const db = admin.firestore();
    const batch = db.batch();

    // Record page view in environment-aware collection
    const pageViewsCollection = getCollectionName('pageViews');
    const pageViewRef = db.collection(pageViewsCollection).doc();
    
    batch.set(pageViewRef, {
      pageId,
      userId: userId || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: request.headers.get('user-agent') || null,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
    });

    // Update page view count
    const pagesCollection = getCollectionName('pages');
    const pageRef = db.collection(pagesCollection).doc(pageId);
    batch.update(pageRef, {
      viewCount: admin.firestore.FieldValue.increment(1),
      lastViewed: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording page view:', error);
    return NextResponse.json(
      { error: 'Failed to record page view' },
      { status: 500 }
    );
  }
}
