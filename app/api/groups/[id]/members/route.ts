import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { isGroupsEnabled, groupsDisabledResponse } from '../../featureFlagCheck';

/**
 * GET /api/groups/[id]/members - List group members
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

    // Private groups: only members can list members
    if (groupSnap.data()?.visibility === 'private') {
      if (!userId || !groupSnap.data()?.memberIds?.includes(userId)) {
        return createErrorResponse('NOT_FOUND', 'Group not found');
      }
    }

    const membersSnap = await groupRef.collection('members').get();
    const members = membersSnap.docs.map((d) => d.data());

    return createApiResponse({ members });
  } catch (error: any) {
    console.error('[Groups API] GET members error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}

/**
 * POST /api/groups/[id]/members - Invite a member
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

    // Only owner or admin can invite
    const memberSnap = await groupRef.collection('members').doc(userId).get();
    const role = memberSnap.data()?.role;
    if (role !== 'owner' && role !== 'admin') {
      return createErrorResponse('FORBIDDEN', 'Only group owner or admin can invite members');
    }

    const body = await request.json();
    const { inviteeId, inviteeUsername } = body;

    if (!inviteeId) {
      return createErrorResponse('BAD_REQUEST', 'inviteeId is required');
    }

    // Check if already a member
    const groupData = groupSnap.data();
    if (groupData?.memberIds?.includes(inviteeId)) {
      return createErrorResponse('BAD_REQUEST', 'User is already a member of this group');
    }

    // Check for existing pending invitation
    const existingInvite = await db
      .collection(getCollectionName('groupInvitations'))
      .where('groupId', '==', groupId)
      .where('inviteeId', '==', inviteeId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingInvite.empty) {
      return createErrorResponse('BAD_REQUEST', 'An invitation is already pending for this user');
    }

    // Get inviter info
    const inviterDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    const inviterUsername = inviterDoc.exists ? inviterDoc.data()?.username || '' : '';

    const now = new Date().toISOString();
    const invitation = {
      groupId,
      groupName: groupData?.name || '',
      inviterId: userId,
      inviterUsername,
      inviteeId,
      inviteeUsername: inviteeUsername || '',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const inviteRef = await db.collection(getCollectionName('groupInvitations')).add(invitation);

    // Create notification for the invitee
    const { FieldValue } = await import('firebase-admin/firestore');
    await db
      .collection(getCollectionName('users'))
      .doc(inviteeId)
      .collection('notifications')
      .add({
        type: 'group_invite',
        title: `Group Invitation`,
        message: `${inviterUsername} invited you to join "${groupData?.name || 'a group'}"`,
        sourceUserId: userId,
        actionUrl: `/g/${groupId}`,
        metadata: {
          groupId,
          groupName: groupData?.name || '',
          invitationId: inviteRef.id,
          inviterId: userId,
          inviterUsername,
        },
        read: false,
        criticality: 'normal',
        createdAt: FieldValue.serverTimestamp(),
      });

    // Increment unread count
    await db
      .collection(getCollectionName('users'))
      .doc(inviteeId)
      .update({
        unreadNotificationCount: FieldValue.increment(1),
      });

    return createApiResponse({ id: inviteRef.id, ...invitation }, null, 201);
  } catch (error: any) {
    console.error('[Groups API] POST members error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}
