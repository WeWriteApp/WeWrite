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

// POST /api/stripe/bank-accounts/primary - Set a bank account as primary
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bankAccountId } = await request.json();

    if (!bankAccountId) {
      return NextResponse.json({ 
        error: 'Bank account ID is required' 
      }, { status: 400 });
    }

    // Get user data
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    const stripeConnectedAccountId = userData?.stripeConnectedAccountId;

    if (!stripeConnectedAccountId) {
      return NextResponse.json({
        error: 'No Stripe connected account found'
      }, { status: 400 });
    }

    // Verify the bank account exists and belongs to this user
    try {
      const bankAccount = await stripe.accounts.retrieveExternalAccount(
        stripeConnectedAccountId,
        bankAccountId
      );

      if (!bankAccount || bankAccount.object !== 'bank_account') {
        return NextResponse.json({
          error: 'Bank account not found'
        }, { status: 404 });
      }
    } catch (error) {
      console.error('Error verifying bank account:', error);
      return NextResponse.json({
        error: 'Bank account not found or access denied'
      }, { status: 404 });
    }

    // Update primary bank account in Firestore
    await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
      primaryBankAccountId: bankAccountId
    }, { merge: true });

    // Set as default external account in Stripe (for payouts)
    try {
      await stripe.accounts.update(stripeConnectedAccountId, {
        default_for_currency: {
          usd: bankAccountId // TODO: Make currency configurable
        }
      });
    } catch (error) {
      console.warn('Could not set as default in Stripe, but primary status saved:', error);
      // Continue even if this fails - the primary status is still saved in our database
    }

    return NextResponse.json({
      success: true,
      message: 'Primary bank account updated successfully',
      primaryBankAccountId: bankAccountId
    });

  } catch (error) {
    console.error('Error setting primary bank account:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({
        error: `Stripe error: ${error.message}`,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to set primary bank account'
    }, { status: 500 });
  }
}

// GET /api/stripe/bank-accounts/primary - Get current primary bank account
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    const stripeConnectedAccountId = userData?.stripeConnectedAccountId;
    const primaryBankAccountId = userData?.primaryBankAccountId;

    if (!stripeConnectedAccountId || !primaryBankAccountId) {
      return NextResponse.json({
        primaryBankAccount: null,
        message: 'No primary bank account set'
      });
    }

    // Get bank account details from Stripe
    try {
      const bankAccount = await stripe.accounts.retrieveExternalAccount(
        stripeConnectedAccountId,
        primaryBankAccountId
      );

      if (bankAccount && bankAccount.object === 'bank_account') {
        return NextResponse.json({
          success: true,
          primaryBankAccount: {
            id: bankAccount.id,
            bankName: (bankAccount as any).bank_name || 'Unknown Bank',
            last4: (bankAccount as any).last4,
            accountType: (bankAccount as any).account_type,
            isPrimary: true,
            isVerified: (bankAccount as any).status === 'verified',
            country: (bankAccount as any).country,
            currency: (bankAccount as any).currency
          }
        });
      }
    } catch (error) {
      console.error('Error retrieving primary bank account:', error);
      // Bank account might have been deleted, clear the primary setting
      await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
        primaryBankAccountId: null
      }, { merge: true });
    }

    return NextResponse.json({
      primaryBankAccount: null,
      message: 'Primary bank account not found'
    });

  } catch (error) {
    console.error('Error getting primary bank account:', error);
    
    return NextResponse.json({
      error: 'Failed to get primary bank account'
    }, { status: 500 });
  }
}
