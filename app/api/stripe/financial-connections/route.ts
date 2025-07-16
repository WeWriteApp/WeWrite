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

// POST /api/stripe/financial-connections - Create Financial Connections Session
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { account_holder } = await request.json();

    if (!account_holder || !account_holder.type) {
      return NextResponse.json({ 
        error: 'Account holder information is required' 
      }, { status: 400 });
    }

    // Get user data to find their connected account ID
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    let stripeConnectedAccountId = userData?.stripeConnectedAccountId;

    // Create Stripe Connect account if it doesn't exist
    if (!stripeConnectedAccountId) {
      const userEmail = userData?.email;
      if (!userEmail) {
        return NextResponse.json({
          error: 'User email not found'
        }, { status: 400 });
      }

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
          username: userData?.username || 'Unknown User'
        }
      });

      stripeConnectedAccountId = account.id;

      // Save the account ID to Firestore
      await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
        stripeConnectedAccountId: stripeConnectedAccountId
      }, { merge: true });

      console.log(`Created Stripe Connect account ${stripeConnectedAccountId} for user ${userId}`);
    }

    // Create Financial Connections Session
    const session = await stripe.financialConnections.sessions.create({
      account_holder: account_holder,
      permissions: ['payment_method', 'balances'],
      filters: {
        countries: ['US']
      },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/earnings?tab=payouts&fc_success=true`
    });

    console.log(`Created Financial Connections session ${session.id} for user ${userId}`);

    return NextResponse.json({
      success: true,
      client_secret: session.client_secret,
      session_id: session.id,
      return_url: session.return_url
    });

  } catch (error) {
    console.error('Error creating Financial Connections session:', error);
    
    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({
        error: `Stripe error: ${error.message}`,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to create Financial Connections session. Please try again.'
    }, { status: 500 });
  }
}

// GET /api/stripe/financial-connections - Retrieve session or account info
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ 
        error: 'Session ID is required' 
      }, { status: 400 });
    }

    // Retrieve the Financial Connections session
    const session = await stripe.financialConnections.sessions.retrieve(sessionId);

    console.log(`Retrieved Financial Connections session ${sessionId} for user ${userId}`);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        accounts: session.accounts?.data || [],
        return_url: session.return_url
      }
    });

  } catch (error) {
    console.error('Error retrieving Financial Connections session:', error);
    
    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({
        error: `Stripe error: ${error.message}`,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to retrieve Financial Connections session. Please try again.'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    { message: 'Method allowed' },
    { status: 200 }
  );
}
