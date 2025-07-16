import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { components } = await request.json();

    if (!components || typeof components !== 'object') {
      return NextResponse.json({ 
        error: 'Components configuration is required' 
      }, { status: 400 });
    }

    // Get user data to find their connected account ID
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    let stripeConnectedAccountId = userData?.stripeConnectedAccountId;

    // If no connected account exists, create one
    if (!stripeConnectedAccountId) {
      console.log(`Creating new Stripe Connect account for user ${userId}`);
      
      // Get user email
      let userEmail = userData?.email;
      if (!userEmail) {
        try {
          const userRecord = await admin.auth().getUser(userId);
          userEmail = userRecord.email;
        } catch (error) {
          console.error('Could not get user email:', error);
          return NextResponse.json({
            error: 'Could not determine user email for account creation'
          }, { status: 400 });
        }
      }

      // Get username for better account identification
      let username = 'Unknown User';
      try {
        if (userData?.username) {
          username = userData.username;
        } else if (userData?.displayName) {
          username = userData.displayName;
        } else if (userEmail) {
          username = userEmail.split('@')[0];
        }
      } catch (error) {
        console.warn('Could not determine username for Stripe account:', error);
      }

      // Create Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: 'express',
        email: userEmail,
        controller: {
          stripe_dashboard: {
            type: 'none'
          }
        },
        metadata: {
          firebaseUID: userId,
          username: username
        }
      });

      stripeConnectedAccountId = account.id;

      // Save the account ID to Firestore
      await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
        stripeConnectedAccountId: stripeConnectedAccountId
      }, { merge: true });

      console.log(`Created Stripe Connect account ${stripeConnectedAccountId} for user ${userId}`);
    }

    // Create Account Session for embedded components
    const accountSession = await stripe.accountSessions.create({
      account: stripeConnectedAccountId,
      components: components
    });

    console.log(`Created Account Session for user ${userId}, account ${stripeConnectedAccountId}`);

    return NextResponse.json({
      success: true,
      client_secret: accountSession.client_secret,
      account_id: stripeConnectedAccountId,
      expires_at: accountSession.expires_at
    });

  } catch (error) {
    console.error('Error creating Account Session:', error);
    
    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({
        error: `Stripe error: ${error.message}`,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to create Account Session. Please try again.'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to create Account Session.' },
    { status: 405 }
  );
}
