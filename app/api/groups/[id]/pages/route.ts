import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { isGroupsEnabled, groupsDisabledResponse } from '../../featureFlagCheck';

/**
 * GET /api/groups/[id]/pages - List pages in a group
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getUserIdFromRequest(request);

    if (!(await isGroupsEnabled(userId))) return groupsDisabledResponse();

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const groupRef = db.collection(getCollectionName('groups')).doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists || groupSnap.data()?.deleted) {
      return createErrorResponse('NOT_FOUND', 'Group not found');
    }

    // Private groups: only members can see pages
    if (groupSnap.data()?.visibility === 'private') {
      if (!userId || !groupSnap.data()?.memberIds?.includes(userId)) {
        return createErrorResponse('NOT_FOUND', 'Group not found');
      }
    }

    const pagesSnap = await db
      .collection(getCollectionName('pages'))
      .where('groupId', '==', groupId)
      .where('deleted', '!=', true)
      .orderBy('lastModified', 'desc')
      .get();

    const pages = pagesSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return createApiResponse({ pages });
  } catch (error: any) {
    console.error('[Groups API] GET pages error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}

/**
 * POST /api/groups/[id]/pages - Add a page to the group
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    if (!(await isGroupsEnabled(userId))) return groupsDisabledResponse();

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const groupRef = db.collection(getCollectionName('groups')).doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists || groupSnap.data()?.deleted) {
      return createErrorResponse('NOT_FOUND', 'Group not found');
    }

    // Only members can add pages
    if (!groupSnap.data()?.memberIds?.includes(userId)) {
      return createErrorResponse('FORBIDDEN', 'Only group members can add pages');
    }

    const body = await request.json();
    const { pageId } = body;

    if (!pageId) {
      return createErrorResponse('BAD_REQUEST', 'pageId is required');
    }

    // Verify page exists and user owns it
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageSnap = await pageRef.get();

    if (!pageSnap.exists || pageSnap.data()?.deleted) {
      return createErrorResponse('NOT_FOUND', 'Page not found');
    }

    if (pageSnap.data()?.userId !== userId) {
      return createErrorResponse('FORBIDDEN', 'You can only add your own pages to a group');
    }

    // Check if page is already in this group
    const existingGroupId = pageSnap.data()?.groupId;
    if (existingGroupId === groupId) {
      return createErrorResponse('CONFLICT', 'Page is already in this group');
    }

    // Check if page is in a different group
    if (existingGroupId) {
      return createErrorResponse('BAD_REQUEST', 'Page is already in another group. Remove it from that group first.');
    }

    // Set groupId on the page
    const { FieldValue } = await import('firebase-admin/firestore');
    const groupData = groupSnap.data()!;
    const pageUpdate: Record<string, any> = {
      groupId,
      lastModified: new Date().toISOString(),
    };

    if (groupData.visibility === 'private') {
      pageUpdate.visibility = 'private';
    } else {
      // For public groups, remove any existing visibility field
      pageUpdate.visibility = FieldValue.delete();
    }

    await pageRef.update(pageUpdate);

    // Increment page count
    await groupRef.update({
      pageCount: (groupData.pageCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    });

    return createApiResponse({ pageId, groupId });
  } catch (error: any) {
    console.error('[Groups API] POST pages error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}
