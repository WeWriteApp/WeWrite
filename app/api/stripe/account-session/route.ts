import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getUserIdFromRequest } from '../../auth-helper';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { sanitizeUsername } from '../../../utils/usernameSecurity';
import { getStripe } from '../../../lib/stripe';

const stripe = getStripe();

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


    // Get user data to find their connected account ID
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    let stripeConnectedAccountId = userData?.stripeConnectedAccountId;

    // If no connected account exists, create one
    if (!stripeConnectedAccountId) {
      
      // Get user email from Firestore (avoids admin.auth() jose issues)
      let userEmail = userData?.email;
      if (!userEmail) {
        console.error('User email not found in Firestore');
        return NextResponse.json({
          error: 'Could not determine user email for account creation'
        }, { status: 400 });
      }

      // Get username for better account identification
      let username = 'Unknown User';
      try {
        // Only use username field - displayName is deprecated
        username = sanitizeUsername(
          userData?.username || null,
          'User',
          'User'
        );
        if (!username || username === 'User') {
          username = `user_${userId.substring(0, 8)}`;
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

    }

    // Create Account Session for embedded components
    const accountSession = await stripe.accountSessions.create({
      account: stripeConnectedAccountId,
      components: finalComponents
    });


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
