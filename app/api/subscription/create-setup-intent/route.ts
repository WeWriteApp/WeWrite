/**
 * Create Setup Intent for Subscription
 * 
 * Creates Stripe setup intent for new subscription payment method collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getUsernameById } from '../../../utils/userUtils';
import { initAdmin } from '../../../firebase/admin';

// Initialize Firebase Admin
const admin = initAdmin();
const adminAuth = admin.auth();
const adminDb = admin.firestore();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tier, amount, tierName, tokens, successUrl, cancelUrl } = body;

    if (!amount || !tier) {
      return NextResponse.json({ 
        error: 'amount and tier are required' 
      }, { status: 400 });
    }

    console.log(`[CREATE SETUP INTENT] Creating setup intent for user ${userId}, tier: ${tier}, amount: $${amount}`);

    // Get or create Stripe customer
    let customerId: string;
    
    // Check if user already has a Stripe customer ID
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    customerId = userData?.stripeCustomerId;

    if (!customerId) {
      // Create new Stripe customer
      const userRecord = await adminAuth.getUser(userId);
      const username = await getUsernameById(userId) || userRecord.displayName || userRecord.email?.split('@')[0] || 'Unknown User';

      const customer = await stripe.customers.create({
        email: userRecord.email,
        description: `WeWrite user ${username} (${userId})`,
        metadata: {
          firebaseUID: userId,
          username: username
        }
      });

      customerId = customer.id;

      // Save customer ID to Firestore
      await adminDb.collection('users').doc(userId).set({
        stripeCustomerId: customerId
      }, { merge: true });

      console.log(`[CREATE SETUP INTENT] Created new Stripe customer ${customerId} for user ${userId}`);
    }

    // Create setup intent for payment method collection
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: {
        userId,
        tier,
        amount: amount.toString(),
        tierName: tierName || tier,
        tokens: tokens?.toString() || (amount * 10).toString()
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
