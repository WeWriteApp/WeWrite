import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../utils/stripeConfig';
import { getUserIdFromRequest } from '../auth-helper';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

export async function POST(request) {
  try {
    // Add detailed logging for debugging
    console.log('Create connect account request received');

    // Fix: Use request.cookies.getAll() instead of entries() for Next.js App Router
    const cookies = request.cookies.getAll();
    const cookieEntries = cookies.reduce((acc, cookie) => {
      acc[cookie.name] = cookie.value;
      return acc;
    }, {});
    console.log('Request cookies:', cookieEntries);

    // Fix: Use request.headers.entries() safely
    const headers = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('Request headers:', headers);

    // Get user ID from request using our helper
    const userId = await getUserIdFromRequest(request);
    console.log('Extracted userId:', userId);

    if (!userId) {
      console.error('No userId found in request');
      return NextResponse.json({
        error: 'PERMISSION_DENIED: Missing or insufficient permissions',
        details: 'User authentication failed'
      }, { status: 401 });
    }

    // Initialize Stripe
    const stripe = new Stripe(getStripeSecretKey());

    // Get the user's data from Firestore
    const db = admin.firestore();
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    let userData = {};
    if (userDoc.exists) {
      userData = userDoc.data();
    }

    // Get user email from Firebase Auth
    console.log('Getting user record for userId:', userId);
    const userRecord = await admin.auth().getUser(userId);
    const userEmail = userRecord.email;
    console.log('User email:', userEmail);

    let accountId = userData.stripeConnectedAccountId;

    // If the user doesn't have a connected account, create one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: userEmail,
        metadata: {
          firebaseUID: userId}});

      accountId = account.id;

      // Save the account ID to Firestore
      await userDocRef.set({
        stripeConnectedAccountId: accountId}, { merge: true });
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?setup=failed`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?setup=success`,
      type: 'account_onboarding'});

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error('Error creating connect account:', error);
    console.error('Error stack:', error.stack);

    // Return more specific error messages
    if (error.message?.includes('permission')) {
      return NextResponse.json(
        { error: 'PERMISSION_DENIED: Missing or insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create connect account' },
      { status: 500 }
    );
  }
}