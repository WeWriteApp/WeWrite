import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { initServerAdmin } from '../../firebase/serverAdmin';
import { createApiResponse } from '../../utils/apiResponse';

export async function GET(request: NextRequest) {
  try {
    // Get the current user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        createApiResponse(null, 'Authentication required', false),
        { status: 401 }
      );
    }

    const currentUserId = session.user.id;
    if (!currentUserId) {
      return NextResponse.json(
        createApiResponse(null, 'User ID not found', false),
        { status: 401 }
      );
    }

    const { db } = initServerAdmin();

    // Get users who are not the current user and have recent activity
    const usersQuery = db.collection('users')
      .where('id', '!=', currentUserId)
      .limit(20);

    const usersSnapshot = await usersQuery.get();
    
    if (usersSnapshot.empty) {
      return NextResponse.json(
        createApiResponse({ suggestions: [] }, 'No user suggestions found')
      );
    }

    const suggestions = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Skip users without usernames
      if (!userData.username) continue;

      // Get recent pages by this user
      const pagesQuery = db.collection('pages')
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

    return NextResponse.json(
      createApiResponse({ suggestions }, 'User suggestions fetched successfully')
    );

  } catch (error) {
    console.error('Error fetching user suggestions:', error);
    return NextResponse.json(
      createApiResponse(null, 'Failed to fetch user suggestions', false),
      { status: 500 }
    );
  }
}
