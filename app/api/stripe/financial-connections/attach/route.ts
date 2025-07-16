import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getCollectionName, COLLECTIONS } from '../../../../utils/environmentConfig';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

// POST /api/stripe/financial-connections/attach - Attach Financial Connections account to Connect account
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { financial_account_id } = await request.json();

    if (!financial_account_id) {
      return NextResponse.json({ 
        error: 'Financial account ID is required' 
      }, { status: 400 });
    }

    // Get user data to find their connected account ID
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    const stripeConnectedAccountId = userData?.stripeConnectedAccountId;

    if (!stripeConnectedAccountId) {
      return NextResponse.json({
        error: 'No Stripe connected account found. Please complete account setup first.'
      }, { status: 400 });
    }

    // Retrieve the Financial Connections account to get bank details
    const financialAccount = await stripe.financialConnections.accounts.retrieve(financial_account_id);

    if (!financialAccount) {
      return NextResponse.json({
        error: 'Financial Connections account not found'
      }, { status: 404 });
    }

    // Check current bank account count
    const externalAccounts = await stripe.accounts.listExternalAccounts(
      stripeConnectedAccountId,
      { object: 'bank_account', limit: 10 }
    );

    if (externalAccounts.data.length >= 3) {
      return NextResponse.json({
        error: 'Maximum of 3 bank accounts allowed'
      }, { status: 400 });
    }

    // Create external account using Financial Connections account
    const bankAccount = await stripe.accounts.createExternalAccount(
      stripeConnectedAccountId,
      {
        external_account: financial_account_id
      }
    );

    console.log(`Attached Financial Connections account ${financial_account_id} to Connect account ${stripeConnectedAccountId} for user ${userId}`);

    // If this is the first bank account, make it primary
    if (externalAccounts.data.length === 0) {
      await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
        primaryBankAccountId: bankAccount.id
      }, { merge: true });

      console.log(`Set bank account ${bankAccount.id} as primary for user ${userId}`);
    }

    return NextResponse.json({
      success: true,
      bankAccount: {
        id: bankAccount.id,
        bankName: bankAccount.bank_name,
        last4: bankAccount.last4,
        accountType: bankAccount.account_type,
        status: bankAccount.status,
        isPrimary: externalAccounts.data.length === 0,
        financialConnectionsId: financial_account_id
      },
      message: 'Bank account connected successfully via instant verification'
    });

  } catch (error) {
    console.error('Error attaching Financial Connections account:', error);
    
    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({
        error: `Stripe error: ${error.message}`,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to attach bank account. Please try again.'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    { message: 'Method allowed' },
    { status: 200 }
  );
}
