/**
 * Stripe Customer Portal API
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initAdmin } from '../../../firebase/admin';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../../api/auth-helper';

// Initialize Firebase Admin and Stripe
const adminApp = initAdmin();
const adminDb = adminApp.firestore();
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-06-20',
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's Stripe customer ID
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists || !userDoc.data()?.stripeCustomerId) {
      return NextResponse.json({
        error: 'No Stripe customer found for this user'
      }, { status: 404 });
    }

    const stripeCustomerId = userDoc.data()!.stripeCustomerId;

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription`,
    });

    console.log(`Created portal session for user ${userId}`);

    return NextResponse.json({
      url: session.url,
    });

  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
