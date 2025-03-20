import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '../../firebase/auth';
import { getUserSubscription, updateSubscription } from '../../firebase/subscription';

export async function POST(request) {
  try {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Get request body
    const body = await request.json();
    const { subscriptionId } = body;
    
    // Verify authenticated user
    const user = auth.currentUser;
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get the user's subscription from Firestore
    const subscription = await getUserSubscription(user.uid);
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 400 }
      );
    }
    
    // Handle demo subscriptions differently
    if (subscriptionId.startsWith('demo_')) {
      // Update the subscription in Firestore
      await updateSubscription(user.uid, {
        status: 'inactive',
        stripeSubscriptionId: null,
        amount: 0,
        renewalDate: null
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Demo subscription canceled successfully' 
      });
    }
    
    // For real Stripe subscriptions
    if (!subscription.stripeSubscriptionId || subscription.stripeSubscriptionId !== subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID mismatch' },
        { status: 400 }
      );
    }
    
    // Cancel the subscription with Stripe
    const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);
    
    // Update the subscription in Firestore
    await updateSubscription(user.uid, {
      status: 'canceled',
      canceledAt: new Date().toISOString()
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Subscription canceled successfully',
      subscription: canceledSubscription
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
} 