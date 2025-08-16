import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Account Status API] Checking bank account status for user:', userId);

    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not available');
    }

    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    const stripeConnectedAccountId = userData?.stripeConnectedAccountId;

    if (!stripeConnectedAccountId) {
      console.log('[Account Status API] No Stripe Connect account found');
      return NextResponse.json({
        error: 'No bank account found. Please set up your bank account first.',
        needsSetup: true
      }, { status: 400 });
    }

    console.log('[Account Status API] Checking Stripe Connect account:', stripeConnectedAccountId);

    // Get the Stripe Connect account details
    const account = await stripe.accounts.retrieve(stripeConnectedAccountId);
    console.log('[Account Status API] Account details:', {
      id: account.id,
      payouts_enabled: account.payouts_enabled,
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
      requirements: account.requirements
    });

    // Get external accounts (bank accounts)
    const externalAccounts = await stripe.accounts.listExternalAccounts(
      stripeConnectedAccountId,
      { object: 'bank_account', limit: 10 }
    );

    console.log('[Account Status API] External accounts found:', externalAccounts.data.length);

    let bankStatus;
    if (externalAccounts.data.length === 0) {
      console.log('[Account Status API] No bank accounts found on Stripe Connect account');
      bankStatus = {
        isConnected: false,
        isVerified: false
      };
    } else {
      // Get the first (primary) bank account
      const bankAccount = externalAccounts.data[0] as Stripe.BankAccount;
      console.log('[Account Status API] Bank account details:', {
        id: bankAccount.id,
        bank_name: bankAccount.bank_name,
        last4: bankAccount.last4,
        status: bankAccount.status
      });

      bankStatus = {
        isConnected: true,
        isVerified: account.payouts_enabled && bankAccount.status === 'verified',
        bankName: bankAccount.bank_name,
        last4: bankAccount.last4,
        accountType: bankAccount.account_type,
        stripeAccountId: stripeConnectedAccountId,
        account: account
      };
    }

    if (!bankStatus.isConnected) {
      console.log('[Account Status API] No bank account found, needs setup');
      return NextResponse.json({
        error: 'No bank account found. Please set up your bank account first.',
        needsSetup: true
      }, { status: 400 });
    }

    console.log('[Account Status API] Bank account found:', {
      isConnected: bankStatus.isConnected,
      isVerified: bankStatus.isVerified,
      bankName: bankStatus.bankName,
      last4: bankStatus.last4
    });

    return NextResponse.json({
      success: true,
      data: {
        id: bankStatus.stripeAccountId,
        payouts_enabled: bankStatus.account.payouts_enabled,
        charges_enabled: bankStatus.account.charges_enabled,
        details_submitted: bankStatus.account.details_submitted,
        requirements: bankStatus.account.requirements,
        bankAccount: {
          bankName: bankStatus.bankName,
          last4: bankStatus.last4,
          accountType: bankStatus.accountType
        }
      }
    });

  } catch (error) {
    console.error('[Account Status API] Error checking account status:', error);

    // If bank account service indicates setup needed, return appropriate response
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({
        error: 'No bank account found. Please set up your bank account first.',
        needsSetup: true
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to check account status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}