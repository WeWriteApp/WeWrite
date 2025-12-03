import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * POST /api/analytics/page-view
 * Record a page view for analytics
 * 
 * Document structure for pageViews collection:
 * - Document ID: {pageId}_{date} (e.g., "abc123_2025-12-03")
 * - Fields:
 *   - pageId: string
 *   - date: string (YYYY-MM-DD format)
 *   - hours: Record<number, number> (hourly view counts, e.g., { 0: 5, 14: 10 })
 *   - totalViews: number (sum of all hourly views)
 *   - lastUpdated: Timestamp
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
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentHour = now.getUTCHours();

    // Use deterministic document ID: {pageId}_{date}
    const pageViewsCollection = getCollectionName('pageViews');
    const docId = `${pageId}_${dateStr}`;
    const pageViewRef = db.collection(pageViewsCollection).doc(docId);

    // Use transaction to safely increment the hourly view count
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(pageViewRef);
      
      if (doc.exists) {
        // Update existing document
        const data = doc.data();
        const hours = data?.hours || {};
        hours[currentHour] = (hours[currentHour] || 0) + 1;
        const totalViews = Object.values(hours).reduce((sum: number, count: number) => sum + count, 0);
        
        transaction.update(pageViewRef, {
          hours,
          totalViews,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Create new document
        const hours = { [currentHour]: 1 };
        transaction.set(pageViewRef, {
          pageId,
          date: dateStr,
          hours,
          totalViews: 1,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    // Update page view count on the page document
    const pagesCollection = getCollectionName('pages');
    const pageRef = db.collection(pagesCollection).doc(pageId);
    
    // Use update with merge to handle missing documents gracefully
    try {
      await pageRef.update({
        viewCount: admin.firestore.FieldValue.increment(1),
        lastViewed: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError: any) {
      // If page doesn't exist, log but don't fail
      if (updateError.code === 5) { // NOT_FOUND
        console.warn(`Page ${pageId} not found when updating view count`);
      } else {
        throw updateError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording page view:', error);
    return NextResponse.json(
      { error: 'Failed to record page view' },
      { status: 500 }
    );
  }
}
