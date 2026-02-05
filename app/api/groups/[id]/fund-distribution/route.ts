import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';

/**
 * GET /api/groups/[id]/fund-distribution - Get fund distribution for a group
 */
export async function GET(
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

    const data = docSnap.data()!;

    // Only members can view fund distribution
    if (!data.memberIds?.includes(userId)) {
      return createErrorResponse('FORBIDDEN', 'Not a group member');
    }

    return createApiResponse({
      fundDistribution: data.fundDistribution || {},
      memberIds: data.memberIds || [],
    });
  } catch (error) {
    console.error('[API] GET /api/groups/[id]/fund-distribution error:', error);
    return createErrorResponse('INTERNAL_ERROR');
  }
}

/**
 * PATCH /api/groups/[id]/fund-distribution - Update fund distribution
 * Body: { fundDistribution: Record<string, number> }
 * Percentages must sum to 100 and only include current member IDs.
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

    const data = docSnap.data()!;

    // Only owner or admin can update fund distribution
    const memberRef = docRef.collection('members').doc(userId);
    const memberSnap = await memberRef.get();
    const role = memberSnap.data()?.role;

    if (role !== 'owner' && role !== 'admin') {
      return createErrorResponse('FORBIDDEN', 'Only owner or admin can update fund distribution');
    }

    const body = await request.json();
    const { fundDistribution } = body;

    if (!fundDistribution || typeof fundDistribution !== 'object') {
      return createErrorResponse('BAD_REQUEST', 'fundDistribution must be an object');
    }

    // Validate: all keys must be current member IDs
    const memberIds: string[] = data.memberIds || [];
    for (const memberId of Object.keys(fundDistribution)) {
      if (!memberIds.includes(memberId)) {
        return createErrorResponse('BAD_REQUEST', `User ${memberId} is not a group member`);
      }
    }

    // Validate: all values must be non-negative numbers
    for (const [memberId, percentage] of Object.entries(fundDistribution)) {
      if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
        return createErrorResponse('BAD_REQUEST', `Invalid percentage for ${memberId}: must be 0-100`);
      }
    }

    // Validate: percentages must sum to 100
    const total = Object.values(fundDistribution).reduce(
      (sum: number, val) => sum + (val as number),
      0
    );
    if (Math.abs(total - 100) > 0.01) {
      return createErrorResponse('BAD_REQUEST', `Percentages must sum to 100 (got ${total})`);
    }

    await docRef.update({
      fundDistribution,
      updatedAt: new Date().toISOString(),
    });

    return createApiResponse({ fundDistribution });
  } catch (error) {
    console.error('[API] PATCH /api/groups/[id]/fund-distribution error:', error);
    return createErrorResponse('INTERNAL_ERROR');
  }
}
