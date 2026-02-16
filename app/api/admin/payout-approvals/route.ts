/**
 * Admin Payout Approvals List API
 *
 * Get list of pending payout approvals for admin review.
 *
 * GET /api/admin/payout-approvals
 * Query params:
 *   - status: 'pending' | 'approved' | 'rejected' | 'all' (default: 'pending')
 *   - limit: number (default: 50)
 *
 * Security:
 * - Requires admin authentication (isAdmin claim)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';
import { checkAdminPermissions } from '../../admin-auth-helper';

async function handleGetApprovals(req: NextRequest) {
  try {
    const adminCheck = await checkAdminPermissions(req);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Server not available' }, { status: 500 });
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const db = admin.firestore();
    let query = db.collection(getCollectionName('payoutApprovalQueue'));

    // Filter by status if not 'all'
    if (status !== 'all') {
      query = query.where('status', '==', status) as any;
    }

    // Order by creation date (newest first)
    query = query.orderBy('createdAt', 'desc').limit(limit) as any;

    const snapshot = await query.get();

    // Get user data for each approval
    const approvals = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Get user info
        let userData = null;
        try {
          const userDoc = await db.collection(getCollectionName('users')).doc(data.userId).get();
          if (userDoc.exists) {
            const user = userDoc.data();
            userData = {
              username: user?.username,
              email: user?.email,
            };
          }
        } catch (error) {
          console.error('[Admin Approvals] Error getting user data:', error);
        }

        return {
          id: doc.id,
          payoutId: data.payoutId,
          userId: data.userId,
          user: userData,
          amountCents: data.amountCents,
          status: data.status,
          reason: data.reason,
          flags: data.flags || [],
          metadata: data.metadata,
          requestedAt: data.requestedAt?.toDate?.()?.toISOString(),
          reviewedAt: data.reviewedAt?.toDate?.()?.toISOString(),
          reviewedBy: data.reviewedBy,
          reviewNotes: data.reviewNotes,
          createdAt: data.createdAt?.toDate?.()?.toISOString(),
        };
      })
    );

    // Get counts for each status
    const pendingCount = await db
      .collection(getCollectionName('payoutApprovalQueue'))
      .where('status', '==', 'pending')
      .count()
      .get();

    return NextResponse.json({
      approvals,
      count: approvals.length,
      pendingCount: pendingCount.data().count,
      status,
    });
  } catch (error) {
    console.error('[Admin Approvals] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch approvals',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Wrap handler with admin context for proper environment handling
export async function GET(req: NextRequest) {
  return withAdminContext(req, handleGetApprovals);
}
