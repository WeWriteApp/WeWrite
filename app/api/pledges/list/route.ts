import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { getCurrentMonth } from '../../../utils/usdConstants';

/**
 * API endpoint to get user's pledges with metadata
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get user's pledges from USD allocations (current month)
    const currentMonth = getCurrentMonth();
    const allocationsQuery = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS))
      .where('userId', '==', userId)
      .where('resourceType', '==', 'page')
      .where('month', '==', currentMonth)
      .where('status', '==', 'active');

    const allocationsSnapshot = await allocationsQuery.get();
    const pledges: any[] = [];

    for (const doc of allocationsSnapshot.docs) {
      const data = doc.data();
      
      // Get page metadata for display
      let pageTitle = 'Unknown Page';
      let authorUsername = 'Unknown Author';
      
      try {
        const pageRef = db.collection(getCollectionName('pages')).doc(data.resourceId);
        const pageDoc = await pageRef.get();

        if (pageDoc.exists) {
          const pageData = pageDoc.data();
          pageTitle = pageData?.title || pageTitle;

          // Get author username if available
          if (pageData?.userId) {
            const authorRef = db.collection(getCollectionName('users')).doc(pageData.userId);
            const authorDoc = await authorRef.get();
            if (authorDoc.exists) {
              authorUsername = authorDoc.data()?.username || authorUsername;
            }
          }
        }
      } catch (error) {
        console.warn('Error loading page metadata for pledge:', error);
      }

      pledges.push({
        id: doc.id,
        pageId: data.resourceId,
        pageTitle,
        authorId: data.recipientUserId || '',
        authorUsername,
        amount: Math.round((data.usdCents || 0) / 10), // Convert USD cents to token equivalent for backward compatibility
        usdCents: data.usdCents || 0,
        status: data.status || 'active',
        originalAmount: Math.round((data.usdCents || 0) / 10), // Convert USD cents to token equivalent
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        month: data.month
      });
    }

    return NextResponse.json({ pledges });
  } catch (error) {
    console.error('Error getting user pledges:', error);
    return NextResponse.json(
      { error: 'Failed to get user pledges' },
      { status: 500 }
    );
  }
}