/**
 * New Page API
 * Creates new pages with client-provided or auto-generated IDs
 *
 * Flow (Option C - Direct Navigation):
 * 1. Client generates page ID using generatePageId()
 * 2. Client navigates directly to /{pageId}?new=true
 * 3. ContentPageView calls this API to create the page with the specific ID
 * 4. If user saves → isNewPage flag removed
 * 5. If user cancels → page is HARD deleted (no trace)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { sanitizeUsername } from '../../../utils/usernameSecurity';

// Validate page ID format (20 chars, alphanumeric)
function isValidPageId(id: string): boolean {
  return /^[A-Za-z0-9]{20}$/.test(id);
}

// POST endpoint - Create a new page with optional custom ID
export async function POST(request: NextRequest) {
  console.log('🔵 NEW PAGE: POST endpoint called');
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const body = await request.json();
    const {
      id: clientProvidedId, // Client can provide the ID (generated via generatePageId())
      replyTo,
      replyToTitle,
      replyToUsername,
      groupId,
      customDate,
      title: initialTitle,
      content: initialContent
    } = body;

    // Validate client-provided ID if present
    if (clientProvidedId) {
      if (!isValidPageId(clientProvidedId)) {
        return createErrorResponse('BAD_REQUEST', 'Invalid page ID format');
      }

      // Check if page already exists
      const existingPage = await db.collection(getCollectionName('pages')).doc(clientProvidedId).get();
      if (existingPage.exists) {
        // Page already exists - this is fine, return success
        // This handles the case where the page was already created (e.g., user refreshed)
        console.log('🔵 NEW PAGE: Page already exists, returning existing ID:', clientProvidedId);
        return createApiResponse({
          id: clientProvidedId,
          alreadyExists: true,
          message: 'Page already exists'
        });
      }
    }

    // Get user information
    const isDevelopment = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
    let username = 'Anonymous';

    if (isDevelopment) {
      if (currentUserId === 'dev_test_user_1') {
        username = 'testuser';
      } else if (currentUserId === 'dev_admin_user') {
        username = 'jamie';
      } else {
        username = currentUserId.replace('dev_', '').replace('_user', '');
      }
    } else {
      const userDoc = await db.collection(getCollectionName('users')).doc(currentUserId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      username = sanitizeUsername(
        userData?.username || null,
        'User',
        'User'
      );
      if (!username || username === 'User') {
        username = `user_${currentUserId.substring(0, 8)}`;
      }
    }

    // Create new page data
    const pageData: any = {
      title: initialTitle || '',
      content: initialContent || [{ type: "paragraph", children: [{ text: "" }] }],
      userId: currentUserId,
      username,
      groupId: groupId || null,
      lastModified: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      deleted: false,
      // isNewPage flag indicates this page was just created and hasn't been saved yet
      // Used to determine if we should hard delete on cancel
      isNewPage: true,
      customDate: customDate || null
    };

    // If this is a reply, include reply metadata
    if (replyTo) {
      pageData.isReply = true;
      pageData.replyTo = replyTo;
      pageData.replyToTitle = replyToTitle || null;
      pageData.replyToUsername = replyToUsername || null;
    }

    // Create the page - use client-provided ID or let Firestore generate one
    const collectionName = getCollectionName('pages');
    let pageId: string;

    if (clientProvidedId) {
      // Use the client-provided ID
      await db.collection(collectionName).doc(clientProvidedId).set(pageData);
      pageId = clientProvidedId;
      console.log('🔵 NEW PAGE: Created page with client-provided ID:', pageId);
    } else {
      // Let Firestore generate the ID (fallback for legacy /new route)
      const pageRef = await db.collection(collectionName).add(pageData);
      pageId = pageRef.id;
      console.log('🔵 NEW PAGE: Created page with auto-generated ID:', pageId);
    }

    // Sync to Algolia for search indexing (only if page has a title)
    if (pageData.title) {
      try {
        console.log('🔍 Syncing new page to Algolia:', pageId);
        const { syncPageToAlgoliaServer } = await import('../../../lib/algoliaSync');
        const algoliaResult = await syncPageToAlgoliaServer({
          pageId,
          title: pageData.title,
          content: JSON.stringify(pageData.content),
          authorId: currentUserId,
          authorUsername: username,
          isPublic: true,
          alternativeTitles: [],
          lastModified: pageData.lastModified,
          createdAt: pageData.createdAt,
        });
        console.log('✅ Algolia sync result:', algoliaResult);
      } catch (algoliaError) {
        console.error('⚠️ Error syncing to Algolia (non-fatal):', algoliaError);
        // Don't fail the page creation if Algolia sync fails
      }
    }

    return createApiResponse({
      id: pageId,
      message: 'Page created successfully'
    });

  } catch (error: any) {
    console.error('Error creating page:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create page');
  }
}

// DELETE endpoint - Hard delete an unsaved new page
export async function DELETE(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('id');

    if (!pageId) {
      return createErrorResponse('BAD_REQUEST', 'Page ID is required');
    }

    // Get the page
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      // Page already deleted, that's fine
      return createApiResponse({
        id: pageId,
        message: 'Page already deleted'
      });
    }

    const pageData = pageDoc.data();

    // Check ownership
    if (pageData?.userId !== currentUserId) {
      return createErrorResponse('FORBIDDEN', 'You can only delete your own pages');
    }

    // Only allow hard deletion of new/unsaved pages (isNewPage flag)
    // or pages that have no meaningful content
    const hasEmptyTitle = !pageData?.title || pageData.title.trim() === '';
    const hasEmptyContent = !pageData?.content ||
      (Array.isArray(pageData.content) && pageData.content.length <= 1 &&
       (!pageData.content[0]?.children?.[0]?.text || pageData.content[0].children[0].text.trim() === ''));

    if (!pageData?.isNewPage && !(hasEmptyTitle && hasEmptyContent)) {
      return createErrorResponse('BAD_REQUEST', 'Cannot hard delete pages with content through this endpoint');
    }

    // HARD DELETE - permanently remove the page (no soft delete)
    await pageRef.delete();

    console.log('🗑️ HARD DELETE: Permanently deleted unsaved page:', pageId);

    return createApiResponse({
      id: pageId,
      message: 'Page permanently deleted'
    });

  } catch (error: any) {
    console.error('Error deleting page:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to delete page');
  }
}
