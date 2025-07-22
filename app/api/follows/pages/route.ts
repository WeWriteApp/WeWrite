import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Page Following API Route
 * 
 * GET: Get pages followed by user or followers of a page
 * POST: Follow a page
 * DELETE: Unfollow a page
 * 
 * This route replaces direct Firebase calls for page following operations
 * and ensures environment-aware collection naming.
 */

// GET /api/follows/pages?userId=xxx&pageId=xxx&type=following|followers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const pageId = searchParams.get('pageId');
    const type = searchParams.get('type') || 'following'; // 'following' or 'followers'
    const currentUserId = await getUserIdFromRequest(request);

    if (!userId && !pageId) {
      return createErrorResponse('Either userId or pageId is required', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    if (type === 'following' && userId) {
      // Get pages followed by user
      const userFollowsRef = db.collection(getCollectionName('userFollows')).doc(userId);
      const userFollowsDoc = await userFollowsRef.get();

      if (userFollowsDoc.exists()) {
        const data = userFollowsDoc.data();
        const followedPageIds = data?.followedPages || [];

        // Get page details for followed pages
        if (followedPageIds.length > 0) {
          const pagePromises = followedPageIds.map(async (pageId: string) => {
            const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();
            if (pageDoc.exists()) {
              return { id: pageDoc.id, ...pageDoc.data() };
            }
            return null;
          });

          const pages = (await Promise.all(pagePromises)).filter(page => page !== null);
          
          return createApiResponse({
            followedPages: pages,
            count: pages.length
          });
        }
      }

      return createApiResponse({
        followedPages: [],
        count: 0
      });

    } else if (type === 'followers' && pageId) {
      // Get followers of a page
      const pageFollowersQuery = db.collection(getCollectionName('pageFollowers'))
        .where('pageId', '==', pageId);
      
      const pageFollowersSnapshot = await pageFollowersQuery.get();
      const followerIds = pageFollowersSnapshot.docs.map(doc => doc.data().userId);

      // Get user details for followers
      if (followerIds.length > 0) {
        const userPromises = followerIds.map(async (userId: string) => {
          const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              id: userDoc.id,
              username: userData?.username,
              displayName: userData?.displayName,
              photoURL: userData?.photoURL
            };
          }
          return null;
        });

        const followers = (await Promise.all(userPromises)).filter(user => user !== null);
        
        return createApiResponse({
          followers,
          count: followers.length
        });
      }

      return createApiResponse({
        followers: [],
        count: 0
      });

    } else {
      return createErrorResponse('Invalid request parameters', 'BAD_REQUEST');
    }

  } catch (error) {
    console.error('Error in follows pages API:', error);
    return createErrorResponse('Failed to fetch follow data', 'INTERNAL_ERROR');
  }
}

// POST /api/follows/pages
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { pageId } = body;

    if (!pageId) {
      return createErrorResponse('Page ID is required', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Check if page exists
    const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();
    if (!pageDoc.exists()) {
      return createErrorResponse('Page not found', 'NOT_FOUND');
    }

    // Add page to user's followed pages
    const userFollowsRef = db.collection(getCollectionName('userFollows')).doc(currentUserId);
    const userFollowsDoc = await userFollowsRef.get();

    if (userFollowsDoc.exists()) {
      // Update existing document
      await userFollowsRef.update({
        followedPages: admin.firestore.FieldValue.arrayUnion(pageId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Create new document
      await userFollowsRef.set({
        userId: currentUserId,
        followedPages: [pageId],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Update page's follower count
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    await pageRef.update({
      followerCount: admin.firestore.FieldValue.increment(1)
    });

    // Add record to pageFollowers collection
    const pageFollowerRef = db.collection(getCollectionName('pageFollowers')).doc(`${pageId}_${currentUserId}`);
    await pageFollowerRef.set({
      pageId,
      userId: currentUserId,
      followedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return createApiResponse({
      success: true,
      message: 'Page followed successfully',
      pageId
    });

  } catch (error) {
    console.error('Error following page:', error);
    return createErrorResponse('Failed to follow page', 'INTERNAL_ERROR');
  }
}

// DELETE /api/follows/pages
export async function DELETE(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return createErrorResponse('Page ID is required', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Remove page from user's followed pages
    const userFollowsRef = db.collection(getCollectionName('userFollows')).doc(currentUserId);
    await userFollowsRef.update({
      followedPages: admin.firestore.FieldValue.arrayRemove(pageId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update page's follower count
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    await pageRef.update({
      followerCount: admin.firestore.FieldValue.increment(-1)
    });

    // Remove record from pageFollowers collection
    const pageFollowerRef = db.collection(getCollectionName('pageFollowers')).doc(`${pageId}_${currentUserId}`);
    await pageFollowerRef.delete();

    return createApiResponse({
      success: true,
      message: 'Page unfollowed successfully',
      pageId
    });

  } catch (error) {
    console.error('Error unfollowing page:', error);
    return createErrorResponse('Failed to unfollow page', 'INTERNAL_ERROR');
  }
}
