import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName, COLLECTIONS } from '../../../../utils/environmentConfig';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Force recompilation

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: requestUserId } = await request.json();

    // Verify the user is requesting for themselves
    if (userId !== requestUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('🗑️ [DELETE BANK] Starting bank account deletion for user:', userId);

    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Get user data to find their account IDs
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    const stripeConnectedAccountId = userData?.stripeConnectedAccountId;
    const stripeCustomerId = userData?.stripeCustomerId;

    console.log('👤 [DELETE BANK] Found customer:', stripeCustomerId);
    console.log('👤 [DELETE BANK] Found connected account:', stripeConnectedAccountId);

    let bankAccounts: any[] = [];
    let deletionPromises: Promise<any>[] = [];

    // Check for bank accounts in Stripe Connect account (for payouts)
    if (stripeConnectedAccountId) {
      try {
        const account = await stripe.accounts.retrieve(stripeConnectedAccountId);

        if (account.external_accounts?.data) {
          const connectBankAccounts = account.external_accounts.data.filter(
            (account: any) => account.object === 'bank_account'
          );

          if (connectBankAccounts.length > 0) {
            console.log(`🔍 [DELETE BANK] Found ${connectBankAccounts.length} bank account(s) in connected account`);

            // For Express accounts, we can't directly delete external accounts
            // Instead, we need to delete the entire connected account
            console.log('⚠️ [DELETE BANK] Cannot delete external accounts from Express accounts directly');
            console.log('🔄 [DELETE BANK] Will delete the entire connected account instead');

            // Delete the connected account entirely
            deletionPromises.push(
              stripe.accounts.del(stripeConnectedAccountId).then(async () => {
                console.log('🗑️ [DELETE BANK] Deleted entire connected account:', stripeConnectedAccountId);
                // Also remove the account ID from user data
                await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).update({
                  stripeConnectedAccountId: admin.firestore.FieldValue.delete()
                });
                console.log('🗑️ [DELETE BANK] Removed connected account ID from user data');
              })
            );

            bankAccounts.push(...connectBankAccounts);
          }
        }
      } catch (error) {
        console.log('⚠️ [DELETE BANK] Error checking connected account:', error);
      }
    }

    // Check for payment methods in customer account (for subscriptions)
    if (stripeCustomerId) {
      try {
        const paymentMethods = await stripe.paymentMethods.list({
          customer: stripeCustomerId,
          type: 'us_bank_account'
        });

        if (paymentMethods.data.length > 0) {
          console.log(`🔍 [DELETE BANK] Found ${paymentMethods.data.length} bank account payment method(s)`);

          deletionPromises.push(...paymentMethods.data.map(async (paymentMethod: any) => {
            console.log('🗑️ [DELETE BANK] Detaching bank account payment method:', paymentMethod.id);
            return stripe.paymentMethods.detach(paymentMethod.id);
          }));

          bankAccounts.push(...paymentMethods.data);
        }
      } catch (error) {
        console.log('⚠️ [DELETE BANK] Error checking customer payment methods:', error);
      }
    }

    if (bankAccounts.length === 0) {
      console.log('🔍 [DELETE BANK] Found 0 bank account(s)');
      return NextResponse.json({ error: 'No bank account found to delete' }, { status: 404 });
    }

    console.log(`🔍 [DELETE BANK] Found ${bankAccounts.length} total bank account(s) to delete`);

    // Execute all deletions
    await Promise.all(deletionPromises);

    console.log('✅ [DELETE BANK] Successfully deleted all bank accounts for user:', userId);

    return NextResponse.json({
      success: true,
      message: 'Bank account deleted successfully',
      deletedCount: bankAccounts.length
    });

  } catch (error) {
    console.error('❌ [DELETE BANK] Error deleting bank account:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
