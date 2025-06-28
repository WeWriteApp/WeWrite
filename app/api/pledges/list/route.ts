import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';

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

    // Get user's pledges from token allocations
    const allocationsQuery = db.collection('tokenAllocations')
      .where('userId', '==', userId)
      .where('resourceType', '==', 'page');

    const allocationsSnapshot = await allocationsQuery.get();
    const pledges: any[] = [];

    for (const doc of allocationsSnapshot.docs) {
      const data = doc.data();
      
      // Get page metadata for display
      let pageTitle = 'Unknown Page';
      let authorUsername = 'Unknown Author';
      
      try {
        const pageRef = db.collection('pages').doc(data.resourceId);
        const pageDoc = await pageRef.get();
        
        if (pageDoc.exists) {
          const pageData = pageDoc.data();
          pageTitle = pageData?.title || pageTitle;
          
          // Get author username if available
          if (pageData?.userId) {
            const authorRef = db.collection('users').doc(pageData.userId);
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
        amount: data.tokens || 0,
        status: data.status || 'active',
        originalAmount: data.originalAmount || data.tokens || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        suspendedAt: data.suspendedAt,
        suspensionReason: data.suspensionReason
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
