import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { getEffectiveTier } from '../../../utils/subscriptionTiers';

/**
 * Follow Suggestions API Route
 *
 * GET: Get suggested users to follow based on:
 * 1. Users followed by users you're following (friends of friends)
 * 2. Random active users as fallback
 *
 * Returns users the current user is NOT already following.
 */

// GET /api/follows/suggestions?limit=10
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);

    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    const admin = initAdmin();
    const db = admin.firestore();

    // Get the current user's following list
    const userFollowingRef = db.collection(getCollectionName('userFollowing')).doc(currentUserId);
    const userFollowingDoc = await userFollowingRef.get();
    const currentlyFollowing: string[] = userFollowingDoc.exists
      ? (userFollowingDoc.data()?.following || [])
      : [];

    // Set of users to exclude (already following + self)
    const excludeSet = new Set([currentUserId, ...currentlyFollowing]);

    // Track suggested users with their source
    const suggestionsMap = new Map<string, { userId: string; source: 'related' | 'discover'; score: number }>();

    // Step 1: Get users followed by users you're following (related suggestions)
    if (currentlyFollowing.length > 0) {
      // Limit to first 20 followed users to avoid too many queries
      const sampleFollowing = currentlyFollowing.slice(0, 20);

      const followingOfFollowingPromises = sampleFollowing.map(async (followedUserId) => {
        const theirFollowingRef = db.collection(getCollectionName('userFollowing')).doc(followedUserId);
        const theirFollowingDoc = await theirFollowingRef.get();
        if (theirFollowingDoc.exists) {
          return theirFollowingDoc.data()?.following || [];
        }
        return [];
      });

      const followingOfFollowingResults = await Promise.all(followingOfFollowingPromises);

      // Count how many of your followed users also follow each suggested user
      const relatedUserCounts = new Map<string, number>();
      for (const theirFollowing of followingOfFollowingResults) {
        for (const userId of theirFollowing) {
          if (!excludeSet.has(userId)) {
            relatedUserCounts.set(userId, (relatedUserCounts.get(userId) || 0) + 1);
          }
        }
      }

      // Sort by count (most commonly followed by your network first)
      const sortedRelated = Array.from(relatedUserCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      for (const [userId, count] of sortedRelated) {
        suggestionsMap.set(userId, { userId, source: 'related', score: count });
      }
    }

    // Step 2: Fill remaining slots with random/popular users
    const remainingSlots = limit - suggestionsMap.size;
    if (remainingSlots > 0) {
      // Get recently active or popular users
      const usersSnapshot = await db
        .collection(getCollectionName('users'))
        .orderBy('lastActiveAt', 'desc')
        .limit(remainingSlots * 3) // Fetch extra to filter out excluded
        .get();

      for (const userDoc of usersSnapshot.docs) {
        if (suggestionsMap.size >= limit) break;
        if (!excludeSet.has(userDoc.id) && !suggestionsMap.has(userDoc.id)) {
          suggestionsMap.set(userDoc.id, { userId: userDoc.id, source: 'discover', score: 0 });
        }
      }
    }

    // Fetch user details for all suggestions
    const suggestionIds = Array.from(suggestionsMap.keys());
    if (suggestionIds.length === 0) {
      return createApiResponse({
        suggestions: [],
        count: 0
      });
    }

    const userDetailsPromises = suggestionIds.map(async (userId) => {
      const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
      if (!userDoc.exists) return null;

      const userData = userDoc.data();
      const suggestionInfo = suggestionsMap.get(userId)!;

      // Fetch subscription data for this user
      let subscriptionData = null;
      try {
        const { parentPath, subCollectionName } = getSubCollectionPath(
          PAYMENT_COLLECTIONS.USERS,
          userId,
          PAYMENT_COLLECTIONS.SUBSCRIPTIONS
        );
        const subDoc = await db.doc(parentPath).collection(subCollectionName).doc('current').get();
        subscriptionData = subDoc.exists ? subDoc.data() : null;
      } catch (error) {
        console.warn(`Error fetching subscription for user ${userId}:`, error);
      }

      // Pre-compute effective tier using centralized logic
      const effectiveTier = getEffectiveTier(
        subscriptionData?.amount ?? null,
        subscriptionData?.tier ?? null,
        subscriptionData?.status ?? null
      );

      // Parse bio if it's EditorContent format
      let bioText = '';
      if (userData?.bio) {
        if (typeof userData.bio === 'string') {
          bioText = userData.bio;
        } else if (Array.isArray(userData.bio)) {
          bioText = userData.bio
            .map((node: any) =>
              node.children
                ?.map((child: any) => child.text || '')
                .join('')
            )
            .join(' ')
            .trim();
        }
      }

      return {
        id: userDoc.id,
        username: userData?.username || `user_${userDoc.id.slice(0, 8)}`,
        photoURL: userData?.photoURL,
        bio: bioText,
        tier: effectiveTier,
        followerCount: userData?.followerCount || 0,
        source: suggestionInfo.source,
        score: suggestionInfo.score
      };
    });

    const userDetails = (await Promise.all(userDetailsPromises)).filter(user => user !== null);

    // Sort: related first (by score), then discover
    userDetails.sort((a, b) => {
      if (a.source === 'related' && b.source !== 'related') return -1;
      if (a.source !== 'related' && b.source === 'related') return 1;
      return b.score - a.score;
    });

    return createApiResponse({
      suggestions: userDetails,
      count: userDetails.length
    });

  } catch (error) {
    console.error('Error fetching follow suggestions:', error);
    return createErrorResponse('Failed to fetch follow suggestions', 'INTERNAL_ERROR');
  }
}
