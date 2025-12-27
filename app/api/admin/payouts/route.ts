import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
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
import { getCollectionName } from '../../../utils/environmentConfig';
import { payoutStatusService } from '../../../services/payoutStatusService';
import { payoutRetryService } from '../../../services/payoutRetryService';
import { StripePayoutService } from '../../../services/stripePayoutService';
import { PayoutMonitoringService } from '../../../services/payoutMonitoringService';
import { FinancialUtils } from '../../../types/financial';
import { adminRateLimiter } from '../../../utils/rateLimiter';
import { withAdminContext } from '../../../utils/adminRequestContext';

// SECURITY: Removed vulnerable admin check - now using centralized security module

/**
 * GET /api/admin/payouts
 * Get paginated list of payouts with filtering and search
 */
export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      // SECURITY: Use centralized admin verification with audit logging
      const adminAuth = await verifyAdminAccess(request);
      if (!adminAuth.isAdmin) {
        return createAdminUnauthorizedResponse(adminAuth.auditId);
      }

    // Apply admin rate limiting
    const rateLimitResult = await adminRateLimiter.checkLimit(adminAuth.userId!);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: 'Too many admin requests. Please wait before trying again.',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
        }
      });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const recipientId = searchParams.get('recipientId');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const lastPayoutId = searchParams.get('lastPayoutId');
    const sortBy = searchParams.get('sortBy') || 'scheduledAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query
    let payoutsQuery = collection(db, getCollectionName('payouts'));
    const constraints = [];

    if (status) {
      constraints.push(where('status', '==', status));
    }

    if (recipientId) {
      constraints.push(where('recipientId', '==', recipientId));
    }

    constraints.push(orderBy(sortBy, sortOrder as any));
    constraints.push(limit(pageSize));

    if (lastPayoutId) {
      const lastDoc = await getDoc(doc(db, getCollectionName('payouts'), lastPayoutId));
      if (lastDoc.exists()) {
        constraints.push(startAfter(lastDoc));
      }
    }

    payoutsQuery = query(payoutsQuery, ...constraints);
    const payoutsSnapshot = await getDocs(payoutsQuery);

    const payouts = payoutsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get recipient information for each payout
    const recipientIds = [...new Set(payouts.map(p => p.recipientId))];
    const recipientPromises = recipientIds.map(id =>
      getDoc(doc(db, getCollectionName('payoutRecipients'), id))
    );
    const recipientDocs = await Promise.all(recipientPromises);
    
    const recipients = {};
    recipientDocs.forEach(doc => {
      if (doc.exists()) {
        recipients[doc.id] = doc.data();
      }
    });

    // Get summary statistics
    const statsQuery = query(
      collection(db, getCollectionName('payouts')),
      orderBy('scheduledAt', 'desc'),
      limit(1000) // Get recent payouts for stats
    );
    const statsSnapshot = await getDocs(statsQuery);
    const allPayouts = statsSnapshot.docs.map(doc => doc.data());

    const stats = {
      total: allPayouts.length,
      pending: allPayouts.filter(p => p.status === 'pending').length,
      processing: allPayouts.filter(p => p.status === 'processing').length,
      completed: allPayouts.filter(p => p.status === 'completed').length,
      failed: allPayouts.filter(p => p.status === 'failed').length,
      cancelled: allPayouts.filter(p => p.status === 'cancelled').length,
      totalAmount: allPayouts.reduce((sum, p) => sum + (p.amount || 0), 0),
      averageAmount: allPayouts.length > 0 ? allPayouts.reduce((sum, p) => sum + (p.amount || 0), 0) / allPayouts.length : 0
    };

      return NextResponse.json({
        success: true,
        data: {
          payouts,
          recipients,
          stats,
          pagination: {
            hasMore: payoutsSnapshot.docs.length === pageSize,
            lastPayoutId: payoutsSnapshot.docs.length > 0 ? payoutsSnapshot.docs[payoutsSnapshot.docs.length - 1].id : null
          }
        }
      });

    } catch (error) {
      console.error('Error getting admin payouts:', error);
      return NextResponse.json({
        error: 'Internal server error',
        details: error.message
      }, { status: 500 });
    }
  }); // End withAdminContext
}

/**
 * POST /api/admin/payouts
 * Admin actions on payouts (retry, cancel, force complete, etc.)
 */
export async function POST(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      const adminAuth = await verifyAdminAccess(request);
      if (!adminAuth.isAdmin) {
        return createAdminUnauthorizedResponse(adminAuth.auditId);
      }

      const userId = adminAuth.userId!;

    const body = await request.json();
    const { action, payoutId, reason, data } = body;

    if (!action || !payoutId) {
      return NextResponse.json({
        error: 'Action and payoutId are required'
      }, { status: 400 });
    }

    const correlationId = FinancialUtils.generateCorrelationId();

    switch (action) {
      case 'retry':
        // Force retry a failed payout
        const retryResult = await payoutRetryService.scheduleRetry(
          payoutId,
          reason || 'Admin manual retry'
        );

        if (retryResult.success) {
          return NextResponse.json({
            success: true,
            message: 'Payout scheduled for retry',
            data: { nextRetryAt: retryResult.nextRetryAt },
            correlationId
          });
        } else {
          return NextResponse.json({
            error: 'Failed to schedule retry',
            details: retryResult.error,
            correlationId
          }, { status: 400 });
        }

      case 'cancel':
        // Cancel a pending or processing payout
        const cancelResult = await payoutStatusService.updatePayoutStatus({
          payoutId,
          status: 'cancelled',
          reason: reason || 'Admin cancellation',
          updateRecipientBalance: true
        });

        if (cancelResult.success) {
          return NextResponse.json({
            success: true,
            message: 'Payout cancelled',
            correlationId
          });
        } else {
          return NextResponse.json({
            error: 'Failed to cancel payout',
            details: cancelResult.error,
            correlationId
          }, { status: 400 });
        }

      case 'force_complete':
        // Force mark a payout as completed (use with caution)
        const completeResult = await payoutStatusService.updatePayoutStatus({
          payoutId,
          status: 'completed',
          reason: reason || 'Admin force completion',
          updateRecipientBalance: true
        });

        if (completeResult.success) {
          return NextResponse.json({
            success: true,
            message: 'Payout marked as completed',
            correlationId
          });
        } else {
          return NextResponse.json({
            error: 'Failed to complete payout',
            details: completeResult.error,
            correlationId
          }, { status: 400 });
        }

      case 'reprocess':
        // Reprocess a payout through Stripe
        const stripeService = StripePayoutService.getInstance();
        const reprocessResult = await stripeService.processPayout(payoutId);

        if (reprocessResult.success) {
          return NextResponse.json({
            success: true,
            message: 'Payout reprocessed',
            correlationId
          });
        } else {
          return NextResponse.json({
            error: 'Failed to reprocess payout',
            details: reprocessResult.error,
            correlationId
          }, { status: 400 });
        }

      case 'add_note':
        // Add admin note to payout
        const payoutDoc = await getDoc(doc(db, getCollectionName('payouts'), payoutId));
        if (!payoutDoc.exists()) {
          return NextResponse.json({
            error: 'Payout not found'
          }, { status: 404 });
        }

        const currentPayout = payoutDoc.data();
        const adminNotes = currentPayout.adminNotes || [];
        
        adminNotes.push({
          id: correlationId,
          adminUserId: userId,
          note: data?.note || reason,
          timestamp: serverTimestamp(),
          action: data?.relatedAction
        });

        await updateDoc(doc(db, getCollectionName('payouts'), payoutId), {
          adminNotes,
          updatedAt: serverTimestamp()
        });

        return NextResponse.json({
          success: true,
          message: 'Admin note added',
          correlationId
        });

      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: retry, cancel, force_complete, reprocess, add_note'
        }, { status: 400 });
    }

    } catch (error) {
      console.error('Error processing admin payout action:', error);
      return NextResponse.json({
        error: 'Internal server error',
        details: error.message
      }, { status: 500 });
    }
  }); // End withAdminContext
}
