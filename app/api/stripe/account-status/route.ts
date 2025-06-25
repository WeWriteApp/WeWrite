import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../auth-helper';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { stripeConnectedAccountId } = body;

    if (!stripeConnectedAccountId) {
      return NextResponse.json({ 
        error: 'Stripe connected account ID is required' 
      }, { status: 400 });
    }

    // Verify the connected account belongs to this user
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (userData?.stripeConnectedAccountId !== stripeConnectedAccountId) {
      return NextResponse.json({ 
        error: 'Invalid connected account' 
      }, { status: 400 });
    }

    // Initialize Stripe
    const stripe = new Stripe(getStripeSecretKey());

    // Get account status from Stripe
    const account = await stripe.accounts.retrieve(stripeConnectedAccountId);

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
