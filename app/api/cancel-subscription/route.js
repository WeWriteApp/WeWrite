import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { db } from '../../firebase/database';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getStripeSecretKey } from '../../utils/stripeConfig';

const admin = getFirebaseAdmin();
const stripe = new Stripe(getStripeSecretKey());

export async function POST(request) {
  try {
    // Get request body
    const { userId } = await request.json();

    if (!userId) {
      return new NextResponse(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // Verify the user exists in Firebase
    try {
      await admin.auth().getUser(userId);
    } catch (error) {
      console.error('Error verifying user:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    // Fetch user data from Firestore
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return new NextResponse(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userData = userDoc.data();

    let stripeCustomerId = userData.stripeCustomerId;

    if (!stripeCustomerId) {
      return new NextResponse(JSON.stringify({ error: 'User has no subscription' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active', // optional: active, canceled, past_due, etc.
      limit: 1,    // optional: max results
    });

    if (subscriptions.data.length == 0) {
      return new NextResponse(JSON.stringify({ error: 'User has no subscription' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const subscription = subscriptions.data[0];
    try {
      // Cancel the subscription with Stripe
      const canceledSubscription = await stripe.subscriptions.cancel(subscription.id);
      console.log('Stripe subscription canceled successfully:', canceledSubscription.id);

    } catch (stripeError) {
      console.error('Error with Stripe cancellation:', stripeError);
      return NextResponse.json(
        { error: stripeError.message || 'Failed to cancel subscription with Stripe', success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription canceled successfully'
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}