import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';

// Initialize Firebase Admin lazily
let admin;

function initializeFirebase() {
  if (admin) return { admin }; // Already initialized

  try {
    admin = getFirebaseAdmin();
    if (!admin) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { admin: null };
    }
    console.log('Firebase Admin initialized successfully in stripe/account-status');
  } catch (error) {
    console.error('Error initializing Firebase Admin in stripe/account-status:', error);
    return { admin: null };
  }

  return { admin };
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = initializeFirebase();
    if (!admin) {
      console.warn('Firebase Admin not available for stripe/account-status');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { stripeConnectedAccountId: providedAccountId } = body;

    // Get user data to find their connected account ID
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    // Use provided account ID or get it from user data
    const stripeConnectedAccountId = providedAccountId || userData?.stripeConnectedAccountId;

    if (!stripeConnectedAccountId) {
      return NextResponse.json({
        error: 'No Stripe connected account found. Please set up your bank account first.',
        needsSetup: true
      }, { status: 400 });
    }

    // Verify the connected account belongs to this user (if account ID was provided)
    if (providedAccountId && userData?.stripeConnectedAccountId !== providedAccountId) {
      return NextResponse.json({
        error: 'Invalid connected account'
      }, { status: 400 });
    }

    // Initialize Stripe
    const stripe = new Stripe(getStripeSecretKey());

    // Get account status from Stripe with error handling
    let account;
    try {
      account = await stripe.accounts.retrieve(stripeConnectedAccountId);
    } catch (stripeError: any) {
      console.error('Error retrieving Stripe account:', stripeError);

      // Handle specific Stripe errors
      if (stripeError.code === 'account_invalid') {
        // Account doesn't exist or access was revoked - clear it from user data
        await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).update({
          stripeConnectedAccountId: null,
          payoutSetupComplete: false
        });

        return NextResponse.json({
          error: 'Stripe account no longer accessible. Please set up your bank account again.',
          needsSetup: true,
          accountCleared: true
        }, { status: 400 });
      }

      // Re-throw other errors
      throw stripeError;
    }

    // Get bank account details from external accounts
    let bankAccountDetails = null;
    if (account.external_accounts?.data && account.external_accounts.data.length > 0) {
      const bankAccount = account.external_accounts.data.find(
        (account: any) => account.object === 'bank_account'
      );

      if (bankAccount) {
        bankAccountDetails = {
          last4: bankAccount.last4,
          bank_name: bankAccount.bank_name,
          account_holder_type: bankAccount.account_holder_type,
          currency: bankAccount.currency,
          country: bankAccount.country,
          routing_number: bankAccount.routing_number ? `****${bankAccount.routing_number.slice(-4)}` : null
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: account.id,
        payouts_enabled: account.payouts_enabled,
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
        requirements: {
          currently_due: account.requirements?.currently_due || [],
          eventually_due: account.requirements?.eventually_due || [],
          past_due: account.requirements?.past_due || [],
          pending_verification: account.requirements?.pending_verification || []
        },
        capabilities: account.capabilities,
        country: account.country,
        default_currency: account.default_currency,
        bank_account: bankAccountDetails
      }
    });

  } catch (error) {
    console.error('Error checking Stripe account status:', error);
    return NextResponse.json({
      error: 'Failed to check account status'
    }, { status: 500 });
  }
}