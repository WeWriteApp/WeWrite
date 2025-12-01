import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { sanitizeUsername } from '../../../utils/usernameSecurity';

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

// Updated API route for embedded Stripe components
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

    const { components, email, businessUrl } = await request.json();

    // Default components for bank account management if not provided
    const defaultComponents = {
      account_onboarding: {
        enabled: true,
        features: {
          external_account_collection: true
        }
      },
      account_management: {
        enabled: true,
        features: {
          external_account_collection: true
        }
      }
    };

    const finalComponents = components || defaultComponents;

    console.log('Creating account session with components:', JSON.stringify(finalComponents, null, 2));

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
        const emailLocalPart = userEmail ? userEmail.split('@')[0] : null;
        username = sanitizeUsername(
          userData?.username || userData?.displayName || null,
          'User',
          'User'
        );
        if (!username || username === 'User') {
          username = `user_${userId.substring(0, 8)}`;
        }
        if (emailLocalPart) {
          console.log('Using email_local_part for backend metadata only');
        }
      } catch (error) {
        console.warn('Could not determine username for Stripe account:', error);
      }

      // Create Stripe Connect Express account
      // Note: Express accounts don't use controller parameters - they're mutually exclusive
      const account = await stripe.accounts.create({
        type: 'express',
        email: email || userEmail, // Use provided email or fallback to user email
        business_profile: {
          url: businessUrl || `https://www.getwewrite.app/user/${userId}`, // Use provided business URL or generate user URL
          mcc: '5815', // Digital goods/services
          product_description: 'Content creation and writing platform'
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
      components: finalComponents
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
