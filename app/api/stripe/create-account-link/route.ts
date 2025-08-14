import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

export async function POST(request: NextRequest) {
  try {
    const admin = initAdmin();
    if (!admin) {
      console.error('Firebase Admin initialization returned null');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, return_url, refresh_url } = await request.json();

    const db = admin.firestore();

    // Get user data from Firestore
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get or create Stripe Connect account for user
    let stripeAccountId = userData.stripeConnectedAccountId;

    if (!stripeAccountId) {
      // Create new Stripe Connect account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US', // You may want to make this configurable
        email: userData.email,
        business_profile: {
          url: 'https://www.getwewrite.app/',
          mcc: '5815', // Digital goods/services
          product_description: 'Content creation and writing platform'
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          firebaseUID: userId,
          username: userData.username || 'Unknown User'
        }
      });

      stripeAccountId = account.id;

      // Save the account ID to Firestore
      await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
        stripeConnectedAccountId: stripeAccountId
      }, { merge: true });
    }

    // Create account link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      type: type || 'account_onboarding',
      return_url: return_url || `${process.env.NEXT_PUBLIC_BASE_URL}/settings/earnings`,
      refresh_url: refresh_url || `${process.env.NEXT_PUBLIC_BASE_URL}/settings/earnings`,
    });

    return NextResponse.json({ url: accountLink.url });

  } catch (error) {
    console.error('Create account link error:', error);
    return NextResponse.json(
      { error: 'Failed to create account link' },
      { status: 500 }
    );
  }
}
