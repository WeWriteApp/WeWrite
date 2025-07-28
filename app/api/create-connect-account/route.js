import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../utils/stripeConfig';
import { getUserIdFromRequest } from '../auth-helper';
import { getCollectionName, COLLECTIONS } from '../../utils/environmentConfig';
import { StripeUrls } from '../../utils/urlConfig';

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
    const userDocRef = db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId);
    const userDoc = await userDocRef.get();
    
    let userData = {};
    if (userDoc.exists) {
      userData = userDoc.data();
    }

    // Get user email from cookie or Firestore (for development mode compatibility)
    console.log('Getting user email for userId:', userId);
    let userEmail;

    // Try to get email from userSession cookie first (development mode)
    const userSessionCookie = request.cookies.get('userSession')?.value;
    if (userSessionCookie) {
      try {
        const userSession = JSON.parse(userSessionCookie);
        if (userSession.email) {
          userEmail = userSession.email;
          console.log('User email from cookie:', userEmail);
        }
      } catch (error) {
        console.log('Could not parse userSession cookie for email');
      }
    }

    // Fallback to Firebase Auth if no email from cookie
    if (!userEmail) {
      try {
        const userRecord = await admin.auth().getUser(userId);
        userEmail = userRecord.email;
        console.log('User email from Firebase Auth:', userEmail);
      } catch (error) {
        console.log('Could not get user from Firebase Auth, trying Firestore...');

        // Final fallback: get email from Firestore user document
        const userDoc = await userDocRef.get();
        const userData = userDoc.data();
        userEmail = userData?.email;
        console.log('User email from Firestore:', userEmail);
      }
    }

    if (!userEmail) {
      return NextResponse.json({
        error: 'Could not determine user email for Stripe account creation'
      }, { status: 400 });
    }

    let accountId = userData.stripeConnectedAccountId;

    // If the user doesn't have a connected account, create one
    if (!accountId) {
      // Get username for better account identification
      let username = 'Unknown User';
      try {
        if (userData.username) {
          username = userData.username;
        } else if (userData.displayName) {
          username = userData.displayName;
        } else if (userEmail) {
          username = userEmail.split('@')[0];
        }
      } catch (error) {
        console.warn('Could not determine username for Stripe account:', error);
      }

      const account = await stripe.accounts.create({
        type: 'express',
        email: userEmail,
        metadata: {
          firebaseUID: userId,
          username: username}});

      accountId = account.id;

      // Save the account ID to Firestore
      await userDocRef.set({
        stripeConnectedAccountId: accountId}, { merge: true });
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: StripeUrls.connectOnboarding.failed(),
      return_url: StripeUrls.connectOnboarding.success(),
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