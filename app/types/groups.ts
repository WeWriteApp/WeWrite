/**
 * Group types for WeWrite Groups system
 */

import { Timestamp } from 'firebase/firestore';

export type GroupRole = 'owner' | 'admin' | 'member';
export type GroupVisibility = 'public' | 'private';
export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface Group {
  id: string;
  name: string;
  slug: string;
  description?: string;
  visibility: GroupVisibility;
  ownerId: string;
  ownerUsername?: string;
  memberIds: string[];
  memberCount: number;
  pageCount: number;
  /** Fund distribution percentages by userId (must sum to 100) */
  fundDistribution?: Record<string, number>;
  /** Whether content in this group is encrypted */
  encrypted?: boolean;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
  deleted?: boolean;
  deletedAt?: string | Timestamp;
}

export interface GroupMember {
  userId: string;
  username?: string;
  role: GroupRole;
  joinedAt: string | Timestamp;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  inviterId: string;
  inviterUsername?: string;
  inviteeId: string;
  inviteeUsername?: string;
  status: InvitationStatus;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
}
