import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../../auth-helper';
import { getFirebaseAdmin } from '../../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../../utils/environmentConfig';

/**
 * DELETE /api/groups/[id]/pages/[pageId] - Remove a page from the group
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const { id: groupId, pageId } = await params;
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const groupRef = db.collection(getCollectionName('groups')).doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists || groupSnap.data()?.deleted) {
      return createErrorResponse('NOT_FOUND', 'Group not found');
    }

    // Only page owner or group owner/admin can remove a page
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageSnap = await pageRef.get();

    if (!pageSnap.exists || pageSnap.data()?.groupId !== groupId) {
      return createErrorResponse('NOT_FOUND', 'Page not found in this group');
    }

    const isPageOwner = pageSnap.data()?.userId === userId;
    const memberSnap = await groupRef.collection('members').doc(userId).get();
    const role = memberSnap.data()?.role;
    const isGroupAdmin = role === 'owner' || role === 'admin';

    if (!isPageOwner && !isGroupAdmin) {
      return createErrorResponse('FORBIDDEN', 'Only page owner or group admin can remove pages');
    }

    // Remove groupId from page
    const { FieldValue } = await import('firebase-admin/firestore');
    await pageRef.update({
      groupId: FieldValue.delete(),
      visibility: FieldValue.delete(),
      lastModified: new Date().toISOString(),
    });

    // Decrement page count
    const groupData = groupSnap.data()!;
    await groupRef.update({
      pageCount: Math.max((groupData.pageCount || 0) - 1, 0),
      updatedAt: new Date().toISOString(),
    });

    return createApiResponse({ removed: pageId });
  } catch (error: any) {
    console.error('[Groups API] DELETE page error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}
