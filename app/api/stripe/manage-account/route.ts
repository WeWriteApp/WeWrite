import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

export async function POST(request: NextRequest) {
  console.warn('⚠️ DEPRECATED: /api/stripe/manage-account is deprecated. Use embedded Stripe Connect components instead.');

  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return deprecation notice with redirect to embedded flow
    return NextResponse.json({
      deprecated: true,
      message: 'This API endpoint is deprecated. Bank account management is now handled through embedded Stripe Connect components.',
      redirectTo: '/dashboard/payouts',
      useEmbeddedFlow: true
    }, { status: 410 }); // 410 Gone - indicates deprecated endpoint

  } catch (error) {
    console.error('Error in deprecated manage-account endpoint:', error);

    return NextResponse.json({
      error: 'This endpoint is deprecated. Please use the embedded bank account management interface.',
      redirectTo: '/dashboard/payouts'
    }, { status: 410 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to create account management link.' },
    { status: 405 }
  );
}
