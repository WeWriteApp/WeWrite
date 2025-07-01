/**
 * DEPRECATED: This endpoint has been replaced by the comprehensive payout system
 *
 * Use the following endpoints instead:
 * - POST /api/payouts/earnings - For manual payout requests
 * - Automated payouts are handled by the PayoutSchedulerService
 *
 * This endpoint is kept for backward compatibility but will redirect to the new system.
 */

import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

export async function POST(request) {
  console.warn('⚠️ DEPRECATED ENDPOINT: /api/initiate-payout is deprecated. Redirecting to new payout system.');

  try {
    const { userId, amount } = await request.json();

    if (!userId || !amount) {
      return NextResponse.json({
        error: 'User ID and amount are required',
        deprecated: true,
        newEndpoint: '/api/payouts/earnings'
      }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({
        error: 'Amount must be greater than 0',
        deprecated: true,
        newEndpoint: '/api/payouts/earnings'
      }, { status: 400 });
    }

    // Verify the user exists in Firebase
    try {
      await admin.auth().getUser(userId);
    } catch (error) {
      console.error('Error verifying user:', error);
      return NextResponse.json({
        error: 'Unauthorized',
        deprecated: true,
        newEndpoint: '/api/payouts/earnings'
      }, { status: 401 });
    }

    // Redirect to the new payout system
    console.log('Redirecting payout request to new system:', { userId, amount });

    try {
      // Make internal request to the new payout endpoint
      const newPayoutResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/payouts/earnings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true',
          'X-Deprecated-Endpoint': '/api/initiate-payout'
        },
        body: JSON.stringify({
          action: 'request_payout',
          userId: userId,
          amount: amount,
          source: 'legacy_endpoint'
        })
      });

      if (newPayoutResponse.ok) {
        const result = await newPayoutResponse.json();
        return NextResponse.json({
          ...result,
          deprecated: true,
          message: 'Payout processed via new system (legacy endpoint used)',
          newEndpoint: '/api/payouts/earnings',
          migration: 'Please update your client to use the new endpoint'
        });
      } else {
        const error = await newPayoutResponse.json();
        return NextResponse.json({
          error: error.error || 'Failed to process payout via new system',
          deprecated: true,
          newEndpoint: '/api/payouts/earnings',
          details: error
        }, { status: newPayoutResponse.status });
      }

    } catch (redirectError) {
      console.error('Error redirecting to new payout system:', redirectError);

      // Fallback: Return deprecation notice
      return NextResponse.json({
        error: 'This endpoint is deprecated and the new payout system is not available',
        deprecated: true,
        newEndpoint: '/api/payouts/earnings',
        message: 'Please use the new payout system endpoint',
        fallback: true
      }, { status: 503 });
    }

  } catch (error) {
    console.error('Error initiating payout:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}