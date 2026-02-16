import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../firebase/config';
import { verifyAdminAccess, createAdminUnauthorizedResponse } from '../../../utils/adminSecurity';
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp
} from 'firebase/firestore';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { PayoutService } from '../../../services/payoutService';
import { adminRateLimiter } from '../../../utils/rateLimiter';
import { withAdminContext } from '../../../utils/adminRequestContext';

const PAYOUTS_COLLECTION = USD_COLLECTIONS.USD_PAYOUTS;

/**
 * GET /api/admin/payouts
 * Get paginated list of payouts with filtering and search
 */
export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      const adminAuth = await verifyAdminAccess(request);
      if (!adminAuth.isAdmin) {
        return createAdminUnauthorizedResponse(adminAuth.auditId);
      }

      const rateLimitResult = await adminRateLimiter.checkLimit(adminAuth.userId!);
      if (!rateLimitResult.allowed) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        }, { status: 429 });
      }

      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status');
      const userId = searchParams.get('userId');
      const pageSize = parseInt(searchParams.get('pageSize') || '20');
      const lastPayoutId = searchParams.get('lastPayoutId');
      const sortOrder = searchParams.get('sortOrder') || 'desc';

      // Build query against the active usdPayouts collection
      let payoutsRef = collection(db, getCollectionName(PAYOUTS_COLLECTION));
      const constraints: any[] = [];

      if (status) {
        constraints.push(where('status', '==', status));
      }

      if (userId) {
        constraints.push(where('userId', '==', userId));
      }

      constraints.push(orderBy('requestedAt', sortOrder as any));
      constraints.push(limit(pageSize));

      if (lastPayoutId) {
        const lastDoc = await getDoc(doc(db, getCollectionName(PAYOUTS_COLLECTION), lastPayoutId));
        if (lastDoc.exists()) {
          constraints.push(startAfter(lastDoc));
        }
      }

      const payoutsQuery = query(payoutsRef, ...constraints);
      const payoutsSnapshot = await getDocs(payoutsQuery);

      const payouts = payoutsSnapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          amountCents: data.amountCents || 0,
          amountDollars: (data.amountCents || 0) / 100,
          status: data.status,
          stripePayoutId: data.stripePayoutId || null,
          failureReason: data.failureReason || null,
          requestedAt: data.requestedAt,
          completedAt: data.completedAt || null,
          approvalRequired: data.approvalRequired || false,
          approvalFlags: data.approvalFlags || [],
          adminNotes: data.adminNotes || [],
        };
      });

      // Summary stats from recent payouts
      const statsQuery = query(
        collection(db, getCollectionName(PAYOUTS_COLLECTION)),
        orderBy('requestedAt', 'desc'),
        limit(1000)
      );
      const statsSnapshot = await getDocs(statsQuery);
      const allPayouts = statsSnapshot.docs.map(d => d.data());

      const stats = {
        total: allPayouts.length,
        pending: allPayouts.filter(p => p.status === 'pending').length,
        pending_approval: allPayouts.filter(p => p.status === 'pending_approval').length,
        completed: allPayouts.filter(p => p.status === 'completed').length,
        failed: allPayouts.filter(p => p.status === 'failed').length,
        totalAmountCents: allPayouts.reduce((sum, p) => sum + (p.amountCents || 0), 0),
      };

      return NextResponse.json({
        success: true,
        data: {
          payouts,
          stats,
          pagination: {
            hasMore: payoutsSnapshot.docs.length === pageSize,
            lastPayoutId: payoutsSnapshot.docs.length > 0
              ? payoutsSnapshot.docs[payoutsSnapshot.docs.length - 1].id
              : null
          }
        }
      });

    } catch (error: any) {
      console.error('Error getting admin payouts:', error);
      return NextResponse.json({
        error: 'Internal server error',
        details: error.message
      }, { status: 500 });
    }
  });
}

/**
 * POST /api/admin/payouts
 * Admin actions on payouts: reprocess, cancel, force_complete, add_note
 */
export async function POST(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      const adminAuth = await verifyAdminAccess(request);
      if (!adminAuth.isAdmin) {
        return createAdminUnauthorizedResponse(adminAuth.auditId);
      }

      const adminUserId = adminAuth.userId!;
      const body = await request.json();
      const { action, payoutId, reason, data } = body;

      if (!action || !payoutId) {
        return NextResponse.json({ error: 'Action and payoutId are required' }, { status: 400 });
      }

      // Verify payout exists in the active collection
      const payoutRef = doc(db, getCollectionName(PAYOUTS_COLLECTION), payoutId);
      const payoutDoc = await getDoc(payoutRef);
      if (!payoutDoc.exists()) {
        return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
      }

      switch (action) {
        case 'reprocess': {
          const result = await PayoutService.processPayout(payoutId);
          if (result.success) {
            return NextResponse.json({ success: true, message: 'Payout reprocessed' });
          }
          return NextResponse.json({ error: 'Failed to reprocess', details: result.error }, { status: 400 });
        }

        case 'cancel': {
          await updateDoc(payoutRef, {
            status: 'failed',
            failureReason: reason || 'Cancelled by admin',
            completedAt: serverTimestamp(),
          });
          return NextResponse.json({ success: true, message: 'Payout cancelled' });
        }

        case 'force_complete': {
          await updateDoc(payoutRef, {
            status: 'completed',
            completedAt: serverTimestamp(),
          });
          return NextResponse.json({ success: true, message: 'Payout marked as completed' });
        }

        case 'add_note': {
          const currentPayout = payoutDoc.data();
          const adminNotes = currentPayout.adminNotes || [];
          adminNotes.push({
            adminUserId,
            note: data?.note || reason,
            timestamp: serverTimestamp(),
            action: data?.relatedAction,
          });
          await updateDoc(payoutRef, { adminNotes, updatedAt: serverTimestamp() });
          return NextResponse.json({ success: true, message: 'Admin note added' });
        }

        default:
          return NextResponse.json({
            error: 'Invalid action. Supported: reprocess, cancel, force_complete, add_note'
          }, { status: 400 });
      }

    } catch (error: any) {
      console.error('Error processing admin payout action:', error);
      return NextResponse.json({
        error: 'Internal server error',
        details: error.message
      }, { status: 500 });
    }
  });
}
