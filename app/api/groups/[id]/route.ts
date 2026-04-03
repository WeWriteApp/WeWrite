import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { isGroupsEnabled, groupsDisabledResponse } from '../featureFlagCheck';

/**
 * GET /api/groups/[id] - Get group details
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

    const docRef = db.collection(getCollectionName('groups')).doc(groupId);
    const docSnap = await docRef.get();

    if (!docSnap.exists || docSnap.data()?.deleted) {
      return createErrorResponse('NOT_FOUND', 'Group not found');
    }

    const group = { id: docSnap.id, ...docSnap.data() };

    // Private groups: only members can see details
    if (docSnap.data()?.visibility === 'private') {
      if (!userId || !docSnap.data()?.memberIds?.includes(userId)) {
        return createErrorResponse('NOT_FOUND', 'Group not found');
      }
    }

    // Get members
    const membersSnap = await docRef.collection('members').get();
    const members = membersSnap.docs.map((d) => d.data());

    return createApiResponse({ ...group, members });
  } catch (error: any) {
    console.error('[Groups API] GET [id] error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}

/**
 * PATCH /api/groups/[id] - Update group settings
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const docRef = db.collection(getCollectionName('groups')).doc(groupId);
    const docSnap = await docRef.get();

    if (!docSnap.exists || docSnap.data()?.deleted) {
      return createErrorResponse('NOT_FOUND', 'Group not found');
    }

    // Only owner or admin can update
    const memberRef = docRef.collection('members').doc(userId);
    const memberSnap = await memberRef.get();
    const role = memberSnap.data()?.role;

    if (role !== 'owner' && role !== 'admin') {
      return createErrorResponse('FORBIDDEN', 'Only group owner or admin can update settings');
    }

    const body = await request.json();
    const allowedFields = ['name', 'description', 'visibility', 'fundDistribution'];
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    await docRef.update(updates);

    return createApiResponse({ id: groupId, ...updates });
  } catch (error: any) {
    console.error('[Groups API] PATCH [id] error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}

/**
 * DELETE /api/groups/[id] - Soft delete group
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const docRef = db.collection(getCollectionName('groups')).doc(groupId);
    const docSnap = await docRef.get();

    if (!docSnap.exists || docSnap.data()?.deleted) {
      return createErrorResponse('NOT_FOUND', 'Group not found');
    }

    // Only owner can delete
    if (docSnap.data()?.ownerId !== userId) {
      return createErrorResponse('FORBIDDEN', 'Only the group owner can delete a group');
    }

    const { FieldValue } = await import('firebase-admin/firestore');

    // Soft-delete the group
    await docRef.update({
      deleted: true,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Clean up pages: remove groupId and visibility from all pages in this group
    const pagesSnap = await db
      .collection(getCollectionName('pages'))
      .where('groupId', '==', groupId)
      .get();

    const batch = db.batch();
    let batchCount = 0;

    for (const pageDoc of pagesSnap.docs) {
      batch.update(pageDoc.ref, {
        groupId: FieldValue.delete(),
        visibility: FieldValue.delete(),
        lastModified: new Date().toISOString(),
      });
      batchCount++;
    }

    // Clean up member subcollection
    const membersSnap = await docRef.collection('members').get();
    for (const memberDoc of membersSnap.docs) {
      batch.delete(memberDoc.ref);
      batchCount++;
    }

    // Cancel pending invitations
    const invitationsSnap = await db
      .collection(getCollectionName('groupInvitations'))
      .where('groupId', '==', groupId)
      .where('status', '==', 'pending')
      .get();

    for (const inviteDoc of invitationsSnap.docs) {
      batch.update(inviteDoc.ref, {
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      });
      batchCount++;
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return createApiResponse({ deleted: true });
  } catch (error: any) {
    console.error('[Groups API] DELETE [id] error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}
