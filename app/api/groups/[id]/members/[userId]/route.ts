import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../../auth-helper';
import { getFirebaseAdmin } from '../../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../../utils/environmentConfig';

/**
 * DELETE /api/groups/[id]/members/[userId] - Remove a member
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: groupId, userId: targetUserId } = await params;
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) return createErrorResponse('UNAUTHORIZED');

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const groupRef = db.collection(getCollectionName('groups')).doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists || groupSnap.data()?.deleted) {
      return createErrorResponse('NOT_FOUND', 'Group not found');
    }

    const groupData = groupSnap.data()!;

    // Cannot remove the owner
    if (targetUserId === groupData.ownerId) {
      return createErrorResponse('BAD_REQUEST', 'Cannot remove the group owner');
    }

    // Only owner/admin can remove others; members can remove themselves
    if (currentUserId !== targetUserId) {
      const currentMemberSnap = await groupRef.collection('members').doc(currentUserId).get();
      const currentRole = currentMemberSnap.data()?.role;
      if (currentRole !== 'owner' && currentRole !== 'admin') {
        return createErrorResponse('FORBIDDEN', 'Only group owner or admin can remove members');
      }
    }

    // Check target is actually a member
    const targetMemberSnap = await groupRef.collection('members').doc(targetUserId).get();
    if (!targetMemberSnap.exists) {
      return createErrorResponse('NOT_FOUND', 'User is not a member of this group');
    }

    // Remove from members subcollection
    await groupRef.collection('members').doc(targetUserId).delete();

    // Update memberIds and count
    const newMemberIds = (groupData.memberIds || []).filter((id: string) => id !== targetUserId);
    const updates: Record<string, any> = {
      memberIds: newMemberIds,
      memberCount: newMemberIds.length,
      updatedAt: new Date().toISOString(),
    };

    // Remove from fund distribution
    if (groupData.fundDistribution && groupData.fundDistribution[targetUserId]) {
      const newDist = { ...groupData.fundDistribution };
      delete newDist[targetUserId];
      updates.fundDistribution = newDist;
    }

    await groupRef.update(updates);

    return createApiResponse({ removed: targetUserId });
  } catch (error: any) {
    console.error('[Groups API] DELETE member error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}
