import { NextRequest, NextResponse } from 'next/server';
import { detectEnvironmentType } from '../../../utils/environmentDetection';
import { getStripe } from '../../../lib/stripe';
import { requireDevelopmentEnvironment } from '../debugHelper';

export async function GET(request: NextRequest) {
  // SECURITY: Only allow in local development
  const devCheck = requireDevelopmentEnvironment();
  if (devCheck) return devCheck;

  try {
    const envType = detectEnvironmentType();
    const host = request.headers.get('host') || '';
    const stripe = getStripe();

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
