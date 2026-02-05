/**
 * Groups Database Module
 *
 * Firestore CRUD operations for groups and group invitations.
 * Uses environment-aware collection naming.
 */

import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from './core';
import { getCollectionName } from '../../utils/environmentConfig';
import type {
  Group,
  GroupMember,
  GroupInvitation,
  GroupRole,
  GroupVisibility,
} from '../../types/groups';

// ─── Groups ────────────────────────────────────────────────────────

/**
 * Create a new group
 */
export async function createGroup(data: {
  name: string;
  description?: string;
  visibility: GroupVisibility;
  ownerId: string;
  ownerUsername?: string;
}): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    const groupData: Omit<Group, 'id'> = {
      name: data.name,
      description: data.description || '',
      visibility: data.visibility,
      ownerId: data.ownerId,
      ownerUsername: data.ownerUsername || '',
      memberIds: [data.ownerId],
      memberCount: 1,
      pageCount: 0,
      fundDistribution: { [data.ownerId]: 100 },
      encrypted: false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };

    const colRef = collection(db, getCollectionName('groups'));
    const docRef = await addDoc(colRef, groupData);

    // Store owner as first member in subcollection
    const memberRef = doc(db, getCollectionName('groups'), docRef.id, 'members', data.ownerId);
    await setDoc(memberRef, {
      userId: data.ownerId,
      username: data.ownerUsername || '',
      role: 'owner' as GroupRole,
      joinedAt: now,
    });

    return docRef.id;
  } catch (error) {
    console.error('[Groups] Error creating group:', error);
    return null;
  }
}

/**
 * Get a group by ID
 */
export async function getGroupById(groupId: string): Promise<Group | null> {
  try {
    const docRef = doc(db, getCollectionName('groups'), groupId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Group;
  } catch (error) {
    console.error('[Groups] Error getting group:', error);
    return null;
  }
}

/**
 * Update a group
 */
export async function updateGroup(groupId: string, data: Partial<Group>): Promise<boolean> {
  try {
    const docRef = doc(db, getCollectionName('groups'), groupId);
    await setDoc(docRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error) {
    console.error('[Groups] Error updating group:', error);
    return false;
  }
}

/**
 * Soft-delete a group
 */
export async function deleteGroup(groupId: string): Promise<boolean> {
  return updateGroup(groupId, {
    deleted: true,
    deletedAt: new Date().toISOString(),
  } as Partial<Group>);
}

/**
 * List groups a user belongs to
 */
export async function getUserGroups(userId: string): Promise<Group[]> {
  try {
    const q = query(
      collection(db, getCollectionName('groups')),
      where('memberIds', 'array-contains', userId),
      where('deleted', '!=', true),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
  } catch (error) {
    console.error('[Groups] Error getting user groups:', error);
    return [];
  }
}

// ─── Members ───────────────────────────────────────────────────────

/**
 * Get all members of a group
 */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  try {
    const membersRef = collection(db, getCollectionName('groups'), groupId, 'members');
    const snap = await getDocs(membersRef);
    return snap.docs.map((d) => d.data() as GroupMember);
  } catch (error) {
    console.error('[Groups] Error getting members:', error);
    return [];
  }
}

/**
 * Get a single member
 */
export async function getGroupMember(groupId: string, userId: string): Promise<GroupMember | null> {
  try {
    const memberRef = doc(db, getCollectionName('groups'), groupId, 'members', userId);
    const snap = await getDoc(memberRef);
    if (!snap.exists()) return null;
    return snap.data() as GroupMember;
  } catch (error) {
    console.error('[Groups] Error getting member:', error);
    return null;
  }
}

/**
 * Add a member to a group
 */
export async function addGroupMember(
  groupId: string,
  userId: string,
  username: string,
  role: GroupRole = 'member'
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const memberRef = doc(db, getCollectionName('groups'), groupId, 'members', userId);
    await setDoc(memberRef, {
      userId,
      username,
      role,
      joinedAt: now,
    });

    // Update group memberIds array and count
    const group = await getGroupById(groupId);
    if (group && !group.memberIds.includes(userId)) {
      const newMemberIds = [...group.memberIds, userId];
      await updateGroup(groupId, {
        memberIds: newMemberIds,
        memberCount: newMemberIds.length,
      } as Partial<Group>);
    }

    return true;
  } catch (error) {
    console.error('[Groups] Error adding member:', error);
    return false;
  }
}

/**
 * Remove a member from a group
 */
export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
  try {
    const memberRef = doc(db, getCollectionName('groups'), groupId, 'members', userId);
    await deleteDoc(memberRef);

    // Update group memberIds array and count
    const group = await getGroupById(groupId);
    if (group) {
      const newMemberIds = group.memberIds.filter((id) => id !== userId);
      const updates: Partial<Group> = {
        memberIds: newMemberIds,
        memberCount: newMemberIds.length,
      };
      // Remove from fund distribution if present
      if (group.fundDistribution && group.fundDistribution[userId]) {
        const newDist = { ...group.fundDistribution };
        delete newDist[userId];
        updates.fundDistribution = newDist;
      }
      await updateGroup(groupId, updates);
    }

    return true;
  } catch (error) {
    console.error('[Groups] Error removing member:', error);
    return false;
  }
}

/**
 * Check if a user is a member of a group
 */
export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const member = await getGroupMember(groupId, userId);
  return member !== null;
}

// ─── Invitations ───────────────────────────────────────────────────

/**
 * Create a group invitation
 */
export async function createInvitation(data: {
  groupId: string;
  groupName: string;
  inviterId: string;
  inviterUsername?: string;
  inviteeId: string;
  inviteeUsername?: string;
}): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    const invitation: Omit<GroupInvitation, 'id'> = {
      groupId: data.groupId,
      groupName: data.groupName,
      inviterId: data.inviterId,
      inviterUsername: data.inviterUsername || '',
      inviteeId: data.inviteeId,
      inviteeUsername: data.inviteeUsername || '',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const colRef = collection(db, getCollectionName('groupInvitations'));
    const docRef = await addDoc(colRef, invitation);
    return docRef.id;
  } catch (error) {
    console.error('[Groups] Error creating invitation:', error);
    return null;
  }
}

/**
 * Get pending invitations for a user
 */
export async function getPendingInvitations(userId: string): Promise<GroupInvitation[]> {
  try {
    const q = query(
      collection(db, getCollectionName('groupInvitations')),
      where('inviteeId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupInvitation));
  } catch (error) {
    console.error('[Groups] Error getting invitations:', error);
    return [];
  }
}

/**
 * Update invitation status (accept/decline)
 */
export async function updateInvitationStatus(
  invitationId: string,
  status: 'accepted' | 'declined'
): Promise<boolean> {
  try {
    const docRef = doc(db, getCollectionName('groupInvitations'), invitationId);
    await setDoc(docRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error) {
    console.error('[Groups] Error updating invitation:', error);
    return false;
  }
}

/**
 * Get invitation by ID
 */
export async function getInvitationById(invitationId: string): Promise<GroupInvitation | null> {
  try {
    const docRef = doc(db, getCollectionName('groupInvitations'), invitationId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as GroupInvitation;
  } catch (error) {
    console.error('[Groups] Error getting invitation:', error);
    return null;
  }
}

// ─── Group Pages ───────────────────────────────────────────────────

/**
 * Get pages belonging to a group
 */
export async function getGroupPages(groupId: string): Promise<any[]> {
  try {
    const q = query(
      collection(db, getCollectionName('pages')),
      where('groupId', '==', groupId),
      where('deleted', '!=', true),
      orderBy('lastModified', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('[Groups] Error getting group pages:', error);
    return [];
  }
}
