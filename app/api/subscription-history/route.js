import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getStripeSecretKey } from '../../utils/stripeConfig';

// Initialize Stripe with the appropriate key based on environment
const stripeSecretKey = getStripeSecretKey();
const stripe = new Stripe(stripeSecretKey);
console.log('Stripe initialized for subscription history');

const admin = getFirebaseAdmin();

export async function GET(request) {
  try {

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify the user exists in Firebase
    try {
      await admin.auth().getUser(userId);
    } catch (error) {
      console.error('Error verifying user:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's subscription from Firestore
    const db = admin.firestore();

    // Fetch user data from Firestore
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      return new NextResponse(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userData = userDoc.data();
    const stripeCustomerId = userData.stripeCustomerId;
    
    if (!stripeCustomerId) {
      return NextResponse.json({ subscriptions: [] });
    }

    // Get subscription history from Stripe using subscriptions (better for subscriptions)
    console.log('Fetching subscription history for customer:', stripeCustomerId);

    try {
      let subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'all', // optional: active, canceled, past_due, etc.
        limit: 10,    // optional: max results
      });

      console.log(`Found ${subscriptions.data.length} subscriptions for customer`);
      //console.log(subscriptions.data);

      // Format the subscription data
      subscriptions = subscriptions.data.map(subscription => ({
        id: subscription.id,
        amount: subscription.items.data.reduce((acc, item) => acc + item.price.unit_amount, 0) / 100, // Convert from cents to dollars
        status: subscription.status,
        created: subscription.created,
        ended: subscription.ended_at,
        currency: subscription.currency,
        description: subscription.description || 'Wewrite Subscription'
      }));

      return NextResponse.json({ subscriptions });
    } catch (stripeError) {
      console.error('Error fetching from Stripe:', stripeError);
      return NextResponse.json({ subscriptions: [], error: stripeError.message });
    }
  } catch (error) {
    console.error('Error fetching subscription history:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
