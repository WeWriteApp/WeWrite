/**
 * Admin/Test helper to fund Payments Balance in Stripe test mode by creating a test charge.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUserIdFromRequest } from '../../auth-helper';
import { isAdminUser } from '../../../utils/adminUtils';
import { detectEnvironmentType } from '../../../utils/environmentDetection';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia'
});

export async function POST(request: NextRequest) {
  const envType = detectEnvironmentType();
  const host = request.headers.get('host') || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  try {
    const body = await request.json();
    const { amount } = body;

    const userId = await getUserIdFromRequest(request);
    const isAdmin = userId ? await isAdminUser(userId) : false;
    const devBypass = envType === 'development' && isLocalhost;
    if (!userId && !devBypass) {
      return NextResponse.json({ error: 'Unauthorized', debug: { envType, host } }, { status: 401 });
    }
    if (!isAdmin && !devBypass) {
      return NextResponse.json({ error: 'Admin access required', debug: { envType, host, userId } }, { status: 403 });
    }

    const cents = Math.max(1, Math.round((Number(amount) || 0) * 100));

    // Create and confirm a test PaymentIntent to fund payments balance
    const pi = await stripe.paymentIntents.create({
      amount: cents,
      currency: 'usd',
      payment_method_types: ['card'],
      confirm: true,
      payment_method: 'pm_card_visa',
      description: 'Test funding for Payments Balance'
    });

    return NextResponse.json({
      success: true,
      message: `Funded payments balance with $${(cents / 100).toFixed(2)}`,
      paymentIntentId: pi.id,
      debug: { envType, host, devBypass }
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] test-payments-fund error', error);
    return NextResponse.json({
      error: 'Failed to fund payments balance',
      details: error?.message || String(error)
    }, { status: 500 });
  }
}
