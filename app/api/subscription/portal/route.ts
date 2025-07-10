/**
 * Subscription Portal API
 * 
 * Creates Stripe customer portal session for subscription management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';

// Initialize Firebase Admin
const admin = initAdmin();
const adminDb = admin.firestore();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[SUBSCRIPTION PORTAL] Creating portal session for user ${userId}`);

    // Get user's Stripe customer ID
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const customerId = userData?.stripeCustomerId;

    if (!customerId) {
      return NextResponse.json({ 
        error: 'No Stripe customer found. Please create a subscription first.' 
      }, { status: 400 });
    }

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://getwewrite.app'}/settings/subscription`,
    });

    console.log(`[SUBSCRIPTION PORTAL] Created portal session ${portalSession.id} for user ${userId}`);

    return NextResponse.json({
      url: portalSession.url
    });

  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create portal session' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to create portal session.' },
    { status: 405 }
  );
}
