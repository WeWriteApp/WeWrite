import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { detectEnvironmentType } from '../../../utils/environmentDetection';

export async function GET(request: NextRequest) {
  try {
    const envType = detectEnvironmentType();
    const host = request.headers.get('host') || '';
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY not set', envType, host },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });

    // Lightweight call to confirm key validity and mode
    const balance = await stripe.balance.retrieve();

    return NextResponse.json({
      envType,
      host,
      stripeLiveMode: balance.livemode,
      currency: balance.available?.[0]?.currency || 'usd',
      available: balance.available?.map(b => ({ amount: b.amount, currency: b.currency })) || [],
      pending: balance.pending?.map(b => ({ amount: b.amount, currency: b.currency })) || []
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to read Stripe environment',
        details: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}
