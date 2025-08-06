/**
 * Create Setup Intent for Subscription
 * 
 * Creates Stripe setup intent for new subscription payment method collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getUsernameById } from '../../../utils/userUtils';
import { getCollectionName } from '../../../utils/environmentConfig';
import { subscriptionAuditService } from '../../../services/subscriptionAuditService';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Firebase Admin using standardized function
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    const adminDb = admin.firestore();
    const adminAuth = admin.auth();

    const body = await request.json();
    const { tier, amount, tierName, tokens, successUrl, cancelUrl } = body;

    if (!amount || !tier) {
      return NextResponse.json({
        error: 'amount and tier are required'
      }, { status: 400 });
    }

    // Generate a shared correlation ID for all related audit events
    const setupCorrelationId = `setup_intent_${Date.now()}_${userId}`;

    console.log(`[CREATE SETUP INTENT] Creating setup intent for user ${userId}, tier: ${tier}, amount: $${amount}`);

    // Get or create Stripe customer
    let customerId: string;

    // Check if user already has a Stripe customer ID using environment-aware collection
    const userDoc = await adminDb.collection(getCollectionName('users')).doc(userId).get();
    const userData = userDoc.data();
    customerId = userData?.stripeCustomerId;

    // Verify customer exists in Stripe (handle deleted customers)
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
        console.log(`[CREATE SETUP INTENT] Verified existing Stripe customer ${customerId} for user ${userId}`);
      } catch (error) {
        console.warn(`[CREATE SETUP INTENT] Stripe customer ${customerId} not found, will create new one:`, error.message);
        customerId = null; // Force creation of new customer
      }
    }

    if (!customerId) {
      // Get user data from Firestore (works for both real and development users)
      if (!userData) {
        return NextResponse.json({
          error: 'User not found in database'
        }, { status: 404 });
      }

      const username = userData.username || 'Unknown User';
      const email = userData.email || `${userId}@wewrite.dev`;

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: email,
        description: `WeWrite user ${username} (${userId})`,
        metadata: {
          firebaseUID: userId,
          username: username,
          environment: process.env.NODE_ENV || 'development'
        }
      });

      customerId = customer.id;

      // Save customer ID to Firestore using environment-aware collection
      await adminDb.collection(getCollectionName('users')).doc(userId).set({
        stripeCustomerId: customerId
      }, { merge: true });

      // Log customer creation/recreation for audit trail
      const isRecreation = !!userData?.stripeCustomerId;
      await subscriptionAuditService.logEvent({
        userId,
        eventType: isRecreation ? 'subscription_updated' : 'subscription_created',
        description: isRecreation
          ? `Stripe customer recreated (previous customer deleted)`
          : `Stripe customer created`,
        entityType: 'subscription',
        entityId: customerId,
        afterState: {
          stripeCustomerId: customerId,
          email,
          username
        },
        metadata: {
          stripeCustomerId: customerId,
          email,
          username,
          isRecreation,
          reason: isRecreation ? 'Previous customer deleted from Stripe' : 'New customer'
        },
        source: 'system',
        correlationId: setupCorrelationId,
        severity: isRecreation ? 'warning' : 'info'
      });

      console.log(`[CREATE SETUP INTENT] ${isRecreation ? 'Recreated' : 'Created'} Stripe customer ${customerId} for user ${userId}`);
    }

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
