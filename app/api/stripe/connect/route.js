import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '../../../firebase/auth';
import { db } from '../../../firebase/database';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a Stripe Connect account for a creator
 */
export async function POST(request) {
  try {
    // Get request body
    const { userId } = await request.json();
    
    // Verify the authenticated user
    const user = auth.currentUser;
    if (!user || user.uid !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get user data from Firestore
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userData = userDoc.data();
    
    // Check if user already has a Stripe Connect account
    if (userData.stripeConnectAccountId) {
      // Get the account to check its status
      const account = await stripe.accounts.retrieve(userData.stripeConnectAccountId);
      
      // If the account exists and is not rejected, return the existing account
      if (account && account.id) {
        return NextResponse.json({
          accountId: account.id,
          accountStatus: account.details_submitted ? 'complete' : 'incomplete',
          accountLink: null // Will be created if needed
        });
      }
    }
    
    // Create a new Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // Default to US, can be updated later
      email: userData.email || user.email,
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        firebaseUID: userId
      }
    });
    
    // Update user document with Stripe Connect account ID
    await updateDoc(userDocRef, {
      stripeConnectAccountId: account.id,
      payoutEnabled: false, // Will be set to true when account is fully onboarded
      updatedAt: new Date().toISOString()
    });
    
    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/account/payouts?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account/payouts/success`,
      type: 'account_onboarding',
    });
    
    return NextResponse.json({
      accountId: account.id,
      accountStatus: 'incomplete',
      accountLink: accountLink.url
    });
  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create Stripe Connect account' },
      { status: 500 }
    );
  }
}

/**
 * Get Stripe Connect account status and create account link if needed
 */
export async function GET(request) {
  try {
    // Get user ID from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    // Verify the authenticated user
    const user = auth.currentUser;
    if (!user || user.uid !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get user data from Firestore
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userData = userDoc.data();
    
    // If user doesn't have a Stripe Connect account, return error
    if (!userData.stripeConnectAccountId) {
      return NextResponse.json(
        { error: 'No Stripe Connect account found' },
        { status: 404 }
      );
    }
    
    // Get the account to check its status
    const account = await stripe.accounts.retrieve(userData.stripeConnectAccountId);
    
    // Create an account link for onboarding if needed
    let accountLink = null;
    if (!account.details_submitted) {
      accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/account/payouts?refresh=true`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account/payouts/success`,
        type: 'account_onboarding',
      });
    }
    
    // If account is complete, create a login link instead
    let loginLink = null;
    if (account.details_submitted) {
      const linkResponse = await stripe.accounts.createLoginLink(account.id);
      loginLink = linkResponse.url;
    }
    
    // Update user document with latest account status
    await updateDoc(userDocRef, {
      payoutEnabled: account.details_submitted && account.charges_enabled,
      updatedAt: new Date().toISOString()
    });
    
    return NextResponse.json({
      accountId: account.id,
      accountStatus: account.details_submitted ? 'complete' : 'incomplete',
      accountLink: accountLink ? accountLink.url : null,
      loginLink: loginLink,
      payoutEnabled: account.details_submitted && account.charges_enabled
    });
  } catch (error) {
    console.error('Error getting Stripe Connect account:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get Stripe Connect account' },
      { status: 500 }
    );
  }
}
