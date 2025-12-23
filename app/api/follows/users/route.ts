import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { sanitizeUsername } from '../../../utils/usernameSecurity';
import { sendNewFollowerEmail } from '../../../services/emailService';

/**
 * User Following API Route
 *
 * GET: Get users followed by user or followers of a user
 * POST: Follow a user
 * DELETE: Unfollow a user
 *
 * This route replaces direct Firebase calls for user following operations
 * and ensures environment-aware collection naming.
 *
 * Updated: 2025-12-04 - Added email notification on follow
 */

// GET /api/follows/users?userId=xxx&type=following|followers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') || 'following'; // 'following' or 'followers'
    const currentUserId = await getUserIdFromRequest(request);

    if (!userId) {
      return createErrorResponse('User ID is required', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    if (type === 'following') {
      // Get users followed by user
      const userFollowingRef = db.collection(getCollectionName('userFollowing')).doc(userId);
      const userFollowingDoc = await userFollowingRef.get();

      if (userFollowingDoc.exists) {
        const data = userFollowingDoc.data();
        const followingUserIds = data?.following || [];

        // Get user details for followed users
        if (followingUserIds.length > 0) {
          const userPromises = followingUserIds.map(async (followedUserId: string) => {
            const userDoc = await db.collection(getCollectionName('users')).doc(followedUserId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              // Only use username field - displayName is deprecated
              const username = sanitizeUsername(
                userData?.username || `user_${userDoc.id.slice(0, 8)}`,
                'User',
                `user_${userDoc.id.slice(0, 8)}`
              );
              return {
                id: userDoc.id,
                username,
                photoURL: userData?.photoURL,
                bio: userData?.bio
              };
            }
            return null;
          });

          const followingUsers = (await Promise.all(userPromises)).filter(user => user !== null);
          
          return createApiResponse({
            following: followingUsers,
            count: followingUsers.length
          });
        }
      }

      return createApiResponse({
        following: [],
        count: 0
      });

    } else if (type === 'followers') {
      // Get followers of a user
      const userFollowersRef = db.collection(getCollectionName('userFollowers')).doc(userId);
      const userFollowersDoc = await userFollowersRef.get();

      if (userFollowersDoc.exists) {
        const data = userFollowersDoc.data();
        const followerIds = data?.followers || [];

        // Get user details for followers
        if (followerIds.length > 0) {
          const userPromises = followerIds.map(async (followerId: string) => {
            const userDoc = await db.collection(getCollectionName('users')).doc(followerId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              return {
                id: userDoc.id,
                username: userData?.username || `user_${userDoc.id.slice(0, 8)}`,
                photoURL: userData?.photoURL,
                bio: userData?.bio
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
      }

      return createApiResponse({
        followers: [],
        count: 0
      });

    } else {
      return createErrorResponse('Invalid type parameter. Use "following" or "followers"', 'BAD_REQUEST');
    }

  } catch (error) {
    return createErrorResponse('Failed to fetch follow data', 'INTERNAL_ERROR');
  }
}

// POST /api/follows/users
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);

    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const body = await request.json();

    const { userId: targetUserId } = body;

    if (!targetUserId) {
      return createErrorResponse('Target user ID is required', 'BAD_REQUEST');
    }

    if (currentUserId === targetUserId) {
      return createErrorResponse('Cannot follow yourself', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Check if target user exists
    const targetUserDoc = await db.collection(getCollectionName('users')).doc(targetUserId).get();

    if (!targetUserDoc.exists) {
      return createErrorResponse('User not found', 'NOT_FOUND');
    }

    // Add target user to current user's following list
    const userFollowingRef = db.collection(getCollectionName('userFollowing')).doc(currentUserId);
    const userFollowingDoc = await userFollowingRef.get();

    if (userFollowingDoc.exists) {
      // Update existing document
      await userFollowingRef.update({
        following: admin.firestore.FieldValue.arrayUnion(targetUserId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Create new document
      await userFollowingRef.set({
        userId: currentUserId,
        following: [targetUserId],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Add current user to target user's followers list
    const userFollowersRef = db.collection(getCollectionName('userFollowers')).doc(targetUserId);
    const userFollowersDoc = await userFollowersRef.get();

    if (userFollowersDoc.exists) {
      // Update existing document
      await userFollowersRef.update({
        followers: admin.firestore.FieldValue.arrayUnion(currentUserId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Create new document
      await userFollowersRef.set({
        userId: targetUserId,
        followers: [currentUserId],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Update follower counts
    await db.collection(getCollectionName('users')).doc(currentUserId).update({
      followingCount: admin.firestore.FieldValue.increment(1)
    });

    await db.collection(getCollectionName('users')).doc(targetUserId).update({
      followerCount: admin.firestore.FieldValue.increment(1)
    });

    // Send notifications (fire-and-forget, don't block response)
    try {
      const targetUserData = targetUserDoc.data();
      const targetEmail = targetUserData?.email;
      const targetUsername = targetUserData?.username || `user_${targetUserId.slice(0, 8)}`;

      // Get follower (current user) info
      const followerDoc = await db.collection(getCollectionName('users')).doc(currentUserId).get();
      const followerData = followerDoc.data();
      const followerUsername = followerData?.username || `user_${currentUserId.slice(0, 8)}`;

      // Convert bio to plain text if it's an EditorContent object
      let followerBio = '';
      if (followerData?.bio) {
        if (typeof followerData.bio === 'string') {
          followerBio = followerData.bio;
        } else if (Array.isArray(followerData.bio)) {
          // EditorContent is an array of nodes, extract text from all children
          followerBio = followerData.bio
            .map((node: any) =>
              node.children
                ?.map((child: any) => child.text || '')
                .join('')
            )
            .join(' ')
            .trim();
        }
      }

      // Check user's notification preferences
      const emailPrefs = targetUserData?.emailPreferences;
      const shouldSendEmail = emailPrefs?.newFollowers !== false; // Default to true if not set

      // Create in-app notification (always, unless user has disabled in-app notifications for follows)
      try {
        const notificationBatch = db.batch();

        const notificationsRef = db.collection(getCollectionName('users'))
          .doc(targetUserId)
          .collection(getCollectionName('notifications'));
        const notificationRef = notificationsRef.doc();

        const notification = {
          userId: targetUserId,
          type: 'follow',
          title: 'New Follower',
          message: `@${followerUsername} started following you`,
          sourceUserId: currentUserId,
          actionUrl: `/u/${followerUsername}`,
          metadata: {
            followerUsername,
            followerBio: followerBio || undefined
          },
          read: false,
          criticality: 'normal',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        notificationBatch.set(notificationRef, notification);

        // Increment unread count
        const userDocRef = db.collection(getCollectionName('users')).doc(targetUserId);
        notificationBatch.update(userDocRef, {
          unreadNotificationsCount: admin.firestore.FieldValue.increment(1)
        });

        await notificationBatch.commit();
      } catch (notificationErr) {
        // Don't fail if in-app notification fails
        console.error('Failed to create follow notification:', notificationErr);
      }

      // Send email notification if user hasn't opted out
      if (targetEmail && shouldSendEmail) {
        sendNewFollowerEmail({
          to: targetEmail,
          username: targetUsername,
          followerUsername,
          followerBio,
          userId: targetUserId
        }).catch(() => {
          // Silently catch email errors
        });
      }
    } catch (notificationErr) {
      // Don't fail the follow operation if notifications fail
    }

    return createApiResponse({
      success: true,
      message: 'User followed successfully',
      targetUserId
    });

  } catch (error) {
    return createErrorResponse('Failed to follow user', 'INTERNAL_ERROR');
  }
}

// DELETE /api/follows/users
export async function DELETE(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return createErrorResponse('Target user ID is required', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Remove target user from current user's following list
    const userFollowingRef = db.collection(getCollectionName('userFollowing')).doc(currentUserId);
    await userFollowingRef.update({
      following: admin.firestore.FieldValue.arrayRemove(targetUserId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Remove current user from target user's followers list
    const userFollowersRef = db.collection(getCollectionName('userFollowers')).doc(targetUserId);
    await userFollowersRef.update({
      followers: admin.firestore.FieldValue.arrayRemove(currentUserId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update follower counts
    await db.collection(getCollectionName('users')).doc(currentUserId).update({
      followingCount: admin.firestore.FieldValue.increment(-1)
    });

    await db.collection(getCollectionName('users')).doc(targetUserId).update({
      followerCount: admin.firestore.FieldValue.increment(-1)
    });

    return createApiResponse({
      success: true,
      message: 'User unfollowed successfully',
      targetUserId
    });

  } catch (error) {
    return createErrorResponse('Failed to unfollow user', 'INTERNAL_ERROR');
  }
}
