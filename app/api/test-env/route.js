import { NextResponse } from 'next/server';

export async function GET() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  return NextResponse.json({
    secretKeyDetails: {
      exists: !!stripeKey,
      length: stripeKey?.length,
      prefix: stripeKey?.substring(0, 7),
      suffix: stripeKey?.substring(stripeKey.length - 4),
      isTestKey: stripeKey?.startsWith('sk_test_'),
      isComplete: stripeKey?.length >= 90,
      format: stripeKey?.match(/^sk_test_[A-Za-z0-9]{24,}$/) ? 'valid' : 'invalid',
    },
    publishableKeyDetails: {
      exists: !!publishableKey,
      length: publishableKey?.length,
      prefix: publishableKey?.substring(0, 7),
      suffix: publishableKey?.substring(publishableKey.length - 4),
      isTestKey: publishableKey?.startsWith('pk_test_'),
      isComplete: publishableKey?.length >= 80,
      format: publishableKey?.match(/^pk_test_[A-Za-z0-9]{24,}$/) ? 'valid' : 'invalid',
    },
    webhookSecretDetails: {
      exists: !!webhookSecret,
      length: webhookSecret?.length,
      prefix: webhookSecret?.substring(0, 7),
      isComplete: webhookSecret?.length >= 30,
      format: webhookSecret?.match(/^whsec_[A-Za-z0-9]{24,}$/) ? 'valid' : 'invalid',
    },
    nodeEnv: process.env.NODE_ENV,
  });
}

export async function POST(request) {
  try {
    const { customerId, amount, percentage } = await request.json();

    const mockSubscription = {
      id: `mock_sub_${Date.now()}`,
      customer: customerId,
      status: 'active',
      items: {
        data: [{
          price: {
            unit_amount: amount * 100,
          },
          quantity: 1,
        }],
      },
      metadata: {
        percentage: percentage,
      },
    };

    return NextResponse.json(mockSubscription);
  } catch (error) {
    console.error('Error creating mock subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
