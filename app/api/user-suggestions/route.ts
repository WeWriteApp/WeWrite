import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    // Get the current user ID
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const admin = getFirebaseAdmin();
    const adminDb = admin.firestore();

    // Get users who are not the current user and have recent activity
    const usersQuery = adminDb.collection(getCollectionName('users'))
      .where('id', '!=', currentUserId)
      .limit(20);

    const usersSnapshot = await usersQuery.get();

    if (usersSnapshot.empty) {
      return NextResponse.json({
        success: true,
        data: { suggestions: [] }
      });
    }

    const suggestions = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Skip users without usernames
      if (!userData.username) continue;

      // Get recent pages by this user
      const pagesQuery = adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userData.id)
        .where('isPublic', '==', true)
        .orderBy('lastModified', 'desc')
        .limit(10);

      try {
        const pagesSnapshot = await pagesQuery.get();
        
        if (!pagesSnapshot.empty) {
          const recentPages = pagesSnapshot.docs.map(pageDoc => {
            const pageData = pageDoc.data();
            return {
              id: pageDoc.id,
              title: pageData.title || 'Untitled',
              lastModified: pageData.lastModified?.toDate() || new Date()
            };
          });

          suggestions.push({
            id: userData.id,
            username: userData.username,
            displayName: userData.displayName,
            recentPages
          });
        }
      } catch (error) {
        // Skip this user if there's an error fetching their pages
        console.error(`Error fetching pages for user ${userData.id}:`, error);
        continue;
      }

      // Limit to 5 suggestions
      if (suggestions.length >= 5) break;
    }

    // Sort suggestions by most recent activity
    suggestions.sort((a, b) => {
      const aLatest = a.recentPages[0]?.lastModified || new Date(0);
      const bLatest = b.recentPages[0]?.lastModified || new Date(0);
      return bLatest.getTime() - aLatest.getTime();
    });

    return NextResponse.json({
      success: true,
      data: { suggestions }
    });

  } catch (error) {
    console.error('Error fetching user suggestions:', error);

    // Return empty suggestions instead of 500 error to prevent UI breaking
    return NextResponse.json({
      success: true,
      data: { suggestions: [] },
      error: 'Failed to fetch user suggestions - returning empty list'
    }, { status: 200 });
  }
}
