import { NextRequest, NextResponse } from 'next/server';
import { getStripePublishableKey, getStripeSecretKey } from '../../../utils/stripeConfig';

/**
 * Simple configuration check for Stripe
 * Returns basic configuration status without exposing sensitive data
 */
export async function GET(request: NextRequest) {
  try {
    const publishableKey = getStripePublishableKey();
    const secretKey = getStripeSecretKey();

    // Basic validation without exposing actual keys
    const hasPublishableKey = !!publishableKey && publishableKey.startsWith('pk_');
    const hasSecretKey = !!secretKey && secretKey.startsWith('sk_');

    if (!hasPublishableKey || !hasSecretKey) {
      return NextResponse.json({
        configured: false,
        error: 'Stripe keys not properly configured'
      }, { status: 500 });
    }

    // Check if we're in the correct environment
    const isTestMode = publishableKey.includes('test');
    const environment = process.env.NODE_ENV;

    return NextResponse.json({
      configured: true,
      testMode: isTestMode,
      environment: environment,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stripe configuration check failed:', error);
    
    return NextResponse.json({
      configured: false,
      error: 'Configuration check failed'
    }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to check configuration.' },
    { status: 405 }
  );
}
