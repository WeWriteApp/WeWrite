/**
 * Create Setup Intent for Subscription
 * 
 * Creates Stripe setup intent for new subscription payment method collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getStripe } from '../../../lib/stripe';
import { getOrCreateStripeCustomer } from '../../../lib/stripeCustomer';
import { getCollectionName } from '../../../utils/environmentConfig';

const stripe = getStripe();

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Firebase Admin using standardized function
    // NOTE: We only use Firestore here, NOT Auth, to avoid jose/jwks-rsa dependency issues on Vercel
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    const adminDb = admin.firestore();

    const body = await request.json();
    const { tier, amount, tierName, tokens, successUrl, cancelUrl } = body;

    if (!amount || !tier) {
      return NextResponse.json({
        error: 'amount and tier are required'
      }, { status: 400 });
    }

    console.log(`[CREATE SETUP INTENT] Creating setup intent for user ${userId}, tier: ${tier}, amount: $${amount}`);

    // Get or create Stripe customer (with deduplication)
    const userData = (await adminDb.collection(getCollectionName('users')).doc(userId).get()).data();
    const email = userData?.email || `${userId}@wewrite.dev`;

    const { customerId } = await getOrCreateStripeCustomer({
      userId,
      email,
      db: adminDb,
    });

    console.log(`[CREATE SETUP INTENT] Using Stripe customer ${customerId} for user ${userId}`);

    // Create setup intent for payment method collection
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      // STRIPE LINK: Add Link support along with other payment methods
      payment_method_types: ['card', 'link'],
      usage: 'off_session',
      metadata: {
        userId,
        tier,
        amount: amount.toString(),
        tierName: tierName || tier
      }
    });

    console.log(`[CREATE SETUP INTENT] Created setup intent ${setupIntent.id} for user ${userId}`);

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
      setupIntentId: setupIntent.id
    });

  } catch (error) {
    console.error('Error creating setup intent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create setup intent' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to create setup intent.' },
    { status: 405 }
  );
}
