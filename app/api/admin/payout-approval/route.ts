/**
 * Admin Payout Approval API
 *
 * Allows admin users to approve or reject payouts that require manual review.
 *
 * POST /api/admin/payout-approval
 * Body: { approvalId, action: 'approve' | 'reject', notes?: string }
 *
 * Security:
 * - Requires admin authentication (isAdmin claim)
 * - Validates approval record exists
 * - Updates both approval record and payout record
 * - Notifies user of decision
 * - Processes approved payouts immediately
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';
import { PayoutService } from '../../../services/payoutService';
import { sendUserNotification } from '../../../utils/notifications';

interface ApprovalRequestBody {
  approvalId: string;
  action: 'approve' | 'reject';
  notes?: string;
}

async function handlePayoutApproval(req: NextRequest) {
  try {
    // Get admin user from request (set by middleware/auth)
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Server not available' }, { status: 500 });
    }

    // Verify admin token
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    if (!decodedToken.admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body
    const body: ApprovalRequestBody = await req.json();
    const { approvalId, action, notes } = body;

    if (!approvalId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 });
    }

    const db = admin.firestore();

    // Get approval record
    const approvalDoc = await db
      .collection(getCollectionName('payoutApprovalQueue'))
      .doc(approvalId)
      .get();

    if (!approvalDoc.exists) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
    }

    const approvalData = approvalDoc.data();
    if (!approvalData) {
      return NextResponse.json({ error: 'Invalid approval record' }, { status: 400 });
    }

    // Check if already reviewed
    if (approvalData.status !== 'pending') {
      return NextResponse.json(
        { error: `This payout has already been ${approvalData.status}` },
        { status: 400 }
      );
    }

    const { payoutId, userId, amountCents } = approvalData;

    // Update approval record
    await approvalDoc.ref.update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: decodedToken.uid,
      reviewNotes: notes || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Get payout record
    const payoutDoc = await db
      .collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
      .doc(payoutId)
      .get();

    if (!payoutDoc.exists) {
      return NextResponse.json({ error: 'Payout record not found' }, { status: 404 });
    }

    if (action === 'approve') {
      // Update payout status to pending and process it
      await payoutDoc.ref.update({
        status: 'pending',
        approvalRequired: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Process the payout
      const processResult = await PayoutService.processPayout(payoutId);

      if (processResult.success) {
        // Notify user of approval
        await sendUserNotification(userId, {
          type: 'payout_approved',
          title: 'Payout Approved',
          body: `Your payout of $${(amountCents / 100).toFixed(2)} has been approved and is being processed.`,
          metadata: { payoutId, amountCents, transferId: processResult.transferId },
        });

        return NextResponse.json({
          success: true,
          message: 'Payout approved and processed successfully',
          transferId: processResult.transferId,
        });
      } else {
        // Processing failed after approval
        return NextResponse.json({
          success: false,
          error: `Payout approved but processing failed: ${processResult.error}`,
        });
      }
    } else {
      // Reject the payout
      await payoutDoc.ref.update({
        status: 'failed',
        failureReason: `Rejected by admin${notes ? `: ${notes}` : ''}`,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify user of rejection
      await sendUserNotification(userId, {
        type: 'payout_rejected',
        title: 'Payout Rejected',
        body: `Your payout of $${(amountCents / 100).toFixed(2)} has been rejected.${notes ? ` Reason: ${notes}` : ''}`,
        metadata: { payoutId, amountCents, reason: notes },
      });

      return NextResponse.json({
        success: true,
        message: 'Payout rejected successfully',
      });
    }
  } catch (error) {
    console.error('[Admin Payout Approval] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process approval',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Wrap handler with admin context for proper environment handling
export async function POST(req: NextRequest) {
  return withAdminContext(req, handlePayoutApproval);
}
