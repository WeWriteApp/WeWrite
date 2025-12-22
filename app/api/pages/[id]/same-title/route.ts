/**
 * API endpoint for finding pages with the same title
 * GET /api/pages/[id]/same-title
 *
 * Returns pages by other users that have the exact same title (case-insensitive)
 * This enables the "see what others wrote about this topic" feature
 */

import { NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../firebase/admin';
import { createApiResponse, createErrorResponse } from '../../../auth-helper';
import { getCollectionName } from '../../../../utils/environmentConfig';
import type { Page } from '../../../../types/database';

/**
 * Page data type for same-title lookup - uses centralized Page type
 */
type PageData = Partial<Page> & { id: string; titleLower?: string; [key: string]: any };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;

    if (!pageId) {
      return createErrorResponse('BAD_REQUEST', 'Page ID is required');
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    // Get the source page to find its title
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'Page not found');
    }

    const pageData = pageDoc.data();
    const sourceTitle = pageData?.title;
    const sourceUserId = pageData?.userId;

    if (!sourceTitle) {
      return createApiResponse({
        pageId,
        title: null,
        sameTitlePages: [],
        message: 'Page has no title'
      });
    }

    // Normalize title for comparison (lowercase, trimmed)
    const normalizedTitle = sourceTitle.toLowerCase().trim();

    // Query for pages with the same normalized title using the titleLower index
    // This is O(k) where k is the number of matching pages, not O(n) for all pages
    let sameTitlePages: any[] = [];

    // Use the titleLower index for efficient querying
    // Note: Run `npx tsx scripts/backfill-title-lower.ts` to populate titleLower on existing pages
    const titleLowerQuery = db.collection(getCollectionName('pages'))
      .where('titleLower', '==', normalizedTitle)
      .where('deleted', '==', false) // Compound index: titleLower + deleted
      .limit(50);

    const titleLowerSnapshot = await titleLowerQuery.get();

    sameTitlePages = titleLowerSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PageData))
      .filter((page: PageData) =>
        // Exclude the source page
        page.id !== pageId &&
        // Exclude pages by the same user
        page.userId !== sourceUserId
      );

    // Fetch user data for each matching page
    const userIds = [...new Set(sameTitlePages.map(p => p.userId).filter(Boolean))];
    const userDataMap = new Map<string, any>();

    if (userIds.length > 0) {
      // Batch fetch user data
      const userPromises = userIds.map(async (userId) => {
        try {
          const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
          if (userDoc.exists) {
            return { userId, data: userDoc.data() };
          }
        } catch (err) {
          console.warn(`Failed to fetch user ${userId}:`, err);
        }
        return { userId, data: null };
      });

      const userResults = await Promise.all(userPromises);
      userResults.forEach(({ userId, data }) => {
        if (data) {
          userDataMap.set(userId, data);
        }
      });
    }

    // Format the response with user data
    const formattedPages = sameTitlePages.map(page => {
      const userData = userDataMap.get(page.userId);
      return {
        pageId: page.id,
        title: page.title,
        userId: page.userId,
        username: userData?.username || null,
        displayName: userData?.displayName || null,
        subscriptionTier: userData?.subscriptionTier || null,
        subscriptionStatus: userData?.subscriptionStatus || null,
        subscriptionAmount: userData?.subscriptionAmount || null,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt || page.lastModified
      };
    });

    // Sort by most recent first
    formattedPages.sort((a, b) => {
      const dateA = a.updatedAt || a.createdAt;
      const dateB = b.updatedAt || b.createdAt;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    console.log(`[SAME_TITLE] Found ${formattedPages.length} pages with title "${sourceTitle}"`);

    return createApiResponse({
      pageId,
      title: sourceTitle,
      sameTitlePages: formattedPages,
      count: formattedPages.length
    });

  } catch (error) {
    console.error('[SAME_TITLE] Error finding pages with same title:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to find pages with same title');
  }
}
