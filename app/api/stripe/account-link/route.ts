import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: requestUserId, type, returnUrl, refreshUrl } = await request.json();

    // Verify the user is requesting for themselves
    if (userId !== requestUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('🔗 Creating account link for user:', userId);

    // Get user data to find or create their connected account ID
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    let stripeConnectedAccountId = userData?.stripeConnectedAccountId;

    // Create Stripe Connect account if it doesn't exist
    if (!stripeConnectedAccountId) {
      console.log('📝 Creating new Stripe Connect account...');
      
      const userEmail = userData?.email;
      const username = userData?.username || 'Unknown User';

      if (!userEmail) {
        return NextResponse.json({ error: 'User email not found' }, { status: 400 });
      }

      // Create Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: 'express',
        email: userEmail,
        business_profile: {
          url: `https://www.getwewrite.app/user/${userId}`,
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

      console.log('✅ Created Stripe Connect account:', stripeConnectedAccountId);
    }

    // Create account link
    const accountLink = await stripe.accountLinks.create({
      account: stripeConnectedAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: type || 'account_onboarding'
    });

    console.log('✅ Created account link for user:', userId);

    return NextResponse.json({
      url: accountLink.url
    });

  } catch (error) {
    console.error('Error creating account link:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
