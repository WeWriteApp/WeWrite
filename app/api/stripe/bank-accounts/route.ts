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
    console.log('Firebase Admin initialized successfully in stripe/bank-accounts');
  } catch (error) {
    console.error('Error initializing Firebase Admin in stripe/bank-accounts:', error);
    return { admin: null };
  }

  return { admin };
}

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

// GET /api/stripe/bank-accounts - List all bank accounts for user
export async function GET(request: NextRequest) {
  console.log('🔍 [BANK ACCOUNTS API] Starting to retrieve bank accounts...');

  try {
    const { admin } = initializeFirebase();
    if (!admin) {
      console.warn('Firebase Admin not available for stripe/bank-accounts');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.error('❌ [BANK ACCOUNTS API] No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ [BANK ACCOUNTS API] Authenticated user:', userId);

    // Get bank accounts from Firestore
    const db = admin.firestore();
    console.log('📡 [BANK ACCOUNTS API] Querying Firestore for bank accounts...');

    const bankAccountsSnapshot = await db
      .collection(getCollectionName(COLLECTIONS.BANK_ACCOUNTS))
      .where('userId', '==', userId)
      .get();

    console.log('📊 [BANK ACCOUNTS API] Found bank accounts in Firestore:', bankAccountsSnapshot.size);

    if (bankAccountsSnapshot.empty) {
      console.log('📭 [BANK ACCOUNTS API] No bank accounts found in Firestore');
      return NextResponse.json({
        bankAccounts: [],
        message: 'No bank accounts found'
      });
    }

    // Get user data for primary bank account ID
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();
    const primaryBankAccountId = userData?.primaryBankAccountId;

    console.log('📊 [BANK ACCOUNTS API] Primary bank account ID:', primaryBankAccountId);

    // Transform Firestore documents to our format
    const bankAccounts = bankAccountsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id,
        bankName: data.bankName || 'Unknown Bank',
        last4: data.last4,
        accountType: data.accountType || 'checking',
        isPrimary: data.isPrimary || data.id === primaryBankAccountId,
        isVerified: data.isVerified || data.status === 'verified',
        routingNumber: data.routingNumber,
        country: data.country,
        currency: data.currency,
        status: data.status,
        financialConnectionsAccountId: data.financialConnectionsAccountId
      };
    });

    console.log('✅ [BANK ACCOUNTS API] Returning bank accounts:', bankAccounts.length);
    console.log('📊 [BANK ACCOUNTS API] Bank accounts data:', bankAccounts);

    return NextResponse.json({
      success: true,
      bankAccounts,
      canAddMore: bankAccounts.length < 10,
      message: `Found ${bankAccounts.length} bank account${bankAccounts.length !== 1 ? 's' : ''}`
    });

  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({
        error: `Stripe error: ${error.message}`,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to fetch bank accounts'
    }, { status: 500 });
  }
}

// POST /api/stripe/bank-accounts - Add new bank account
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      accountNumber, 
      routingNumber, 
      accountHolderName, 
      accountType = 'checking' 
    } = await request.json();

    if (!accountNumber || !routingNumber || !accountHolderName) {
      return NextResponse.json({ 
        error: 'Account number, routing number, and account holder name are required' 
      }, { status: 400 });
    }

    // Get user data
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    let stripeConnectedAccountId = userData?.stripeConnectedAccountId;

    // Create Stripe Connect account if it doesn't exist
    if (!stripeConnectedAccountId) {
      const userEmail = userData?.email;
      if (!userEmail) {
        return NextResponse.json({
          error: 'User email not found'
        }, { status: 400 });
      }

      const account = await stripe.accounts.create({
        type: 'express',
        email: userEmail,
        controller: {
          stripe_dashboard: {
            type: 'none'
          }
        },
        metadata: {
          firebaseUID: userId,
          username: userData?.username || 'Unknown User'
        }
      });

      stripeConnectedAccountId = account.id;

      // Save account ID to Firestore
      await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
        stripeConnectedAccountId: stripeConnectedAccountId
      }, { merge: true });
    }

    // Check current bank account count
    const externalAccounts = await stripe.accounts.listExternalAccounts(
      stripeConnectedAccountId,
      { object: 'bank_account', limit: 15 }
    );

    if (externalAccounts.data.length >= 10) {
      return NextResponse.json({
        error: 'Maximum of 10 bank accounts allowed'
      }, { status: 400 });
    }

    // Add bank account to Stripe Connect account
    const bankAccount = await stripe.accounts.createExternalAccount(
      stripeConnectedAccountId,
      {
        external_account: {
          object: 'bank_account',
          country: 'US', // TODO: Make this configurable
          currency: 'usd',
          account_number: accountNumber,
          routing_number: routingNumber,
          account_holder_name: accountHolderName,
          account_holder_type: 'individual', // TODO: Make this configurable
          account_type: accountType
        }
      }
    );

    // If this is the first bank account, make it primary
    if (externalAccounts.data.length === 0) {
      await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
        primaryBankAccountId: bankAccount.id
      }, { merge: true });
    }

    return NextResponse.json({
      success: true,
      bankAccount: {
        id: bankAccount.id,
        bankName: (bankAccount as any).bank_name || 'Unknown Bank',
        last4: (bankAccount as any).last4,
        accountType: (bankAccount as any).account_type,
        isPrimary: externalAccounts.data.length === 0,
        isVerified: (bankAccount as any).status === 'verified',
        country: (bankAccount as any).country,
        currency: (bankAccount as any).currency
      }
    });

  } catch (error) {
    console.error('Error adding bank account:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({
        error: `Stripe error: ${error.message}`,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to add bank account'
    }, { status: 500 });
  }
}

// DELETE /api/stripe/bank-accounts - Delete bank account
export async function DELETE(request: NextRequest) {
  console.log('🗑️ [DELETE BANK ACCOUNT] Starting bank account deletion...');

  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.error('❌ [DELETE BANK ACCOUNT] No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ [DELETE BANK ACCOUNT] Authenticated user:', userId);

    const { bankAccountId } = await request.json();

    if (!bankAccountId) {
      console.error('❌ [DELETE BANK ACCOUNT] No bank account ID provided');
      return NextResponse.json({
        error: 'Bank account ID is required'
      }, { status: 400 });
    }

    console.log('🎯 [DELETE BANK ACCOUNT] Deleting bank account:', bankAccountId);

    const db = admin.firestore();

    // Check if the bank account exists in Firestore
    const bankAccountDoc = await db.collection(getCollectionName(COLLECTIONS.BANK_ACCOUNTS)).doc(bankAccountId).get();

    if (!bankAccountDoc.exists) {
      console.error('❌ [DELETE BANK ACCOUNT] Bank account not found in Firestore');
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const bankAccountData = bankAccountDoc.data();

    // Verify the bank account belongs to the user
    if (bankAccountData?.userId !== userId) {
      console.error('❌ [DELETE BANK ACCOUNT] Bank account does not belong to user');
      return NextResponse.json({ error: 'Unauthorized to delete this bank account' }, { status: 403 });
    }

    // Check if this is the primary bank account
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();
    const isPrimary = userData?.primaryBankAccountId === bankAccountId;

    console.log('📊 [DELETE BANK ACCOUNT] Is primary account:', isPrimary);

    // Get all bank accounts for this user to check count
    const allBankAccountsSnapshot = await db
      .collection(getCollectionName(COLLECTIONS.BANK_ACCOUNTS))
      .where('userId', '==', userId)
      .get();

    const totalBankAccounts = allBankAccountsSnapshot.size;
    console.log('📊 [DELETE BANK ACCOUNT] Total bank accounts:', totalBankAccounts);

    // If this is the primary and there are other accounts, prevent deletion
    if (isPrimary && totalBankAccounts > 1) {
      console.error('❌ [DELETE BANK ACCOUNT] Cannot delete primary account with other accounts present');
      return NextResponse.json({
        error: 'Cannot delete primary bank account. Set another account as primary first.'
      }, { status: 400 });
    }

    // Delete bank account from Firestore
    await db.collection(getCollectionName(COLLECTIONS.BANK_ACCOUNTS)).doc(bankAccountId).delete();
    console.log('✅ [DELETE BANK ACCOUNT] Deleted from Firestore');

    // If this was the primary account, clear the primary setting
    if (isPrimary) {
      await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
        primaryBankAccountId: null
      }, { merge: true });
      console.log('✅ [DELETE BANK ACCOUNT] Cleared primary bank account setting');
    }

    console.log('🎉 [DELETE BANK ACCOUNT] Bank account deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Bank account deleted successfully'
    });

  } catch (error) {
    console.error('❌ [DELETE BANK ACCOUNT] Error deleting bank account:', error);

    if (error instanceof Error && 'code' in error) {
      return NextResponse.json({
        error: `Database error: ${error.message}`,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to delete bank account'
    }, { status: 500 });
  }
}

// PATCH /api/stripe/bank-accounts - Set primary bank account
export async function PATCH(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestBody = await request.json();
    const { bankAccountId, action, bankName } = requestBody;

    if (!bankAccountId || !action) {
      return NextResponse.json({
        error: 'Bank account ID and action are required'
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

    if (action === 'updateName') {
      console.log('✏️ [UPDATE NAME] Updating bank name for account:', bankAccountId);

      if (!bankName || !bankName.trim()) {
        console.error('❌ [UPDATE NAME] No bank name provided');
        return NextResponse.json({ error: 'Bank name is required' }, { status: 400 });
      }

      // Verify the bank account exists in Firestore and belongs to the user
      const bankAccountDoc = await db.collection(getCollectionName(COLLECTIONS.BANK_ACCOUNTS)).doc(bankAccountId).get();

      if (!bankAccountDoc.exists) {
        console.error('❌ [UPDATE NAME] Bank account not found in Firestore');
        return NextResponse.json({
          error: 'Bank account not found'
        }, { status: 404 });
      }

      const bankAccountData = bankAccountDoc.data();

      // Verify the bank account belongs to the user
      if (bankAccountData?.userId !== userId) {
        console.error('❌ [UPDATE NAME] Bank account does not belong to user');
        return NextResponse.json({ error: 'Unauthorized to modify this bank account' }, { status: 403 });
      }

      // Update the bank name in Firestore
      await db.collection(getCollectionName(COLLECTIONS.BANK_ACCOUNTS)).doc(bankAccountId).update({
        bankName: bankName.trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ [UPDATE NAME] Bank name updated successfully:', bankName.trim());

      return NextResponse.json({
        success: true,
        message: 'Bank name updated successfully'
      });
    }

    if (action === 'setPrimary') {
      console.log('⭐ [SET PRIMARY] Setting primary bank account:', bankAccountId);

      // Verify the bank account exists in Firestore and belongs to the user
      const bankAccountDoc = await db.collection(getCollectionName(COLLECTIONS.BANK_ACCOUNTS)).doc(bankAccountId).get();

      if (!bankAccountDoc.exists) {
        console.error('❌ [SET PRIMARY] Bank account not found in Firestore');
        return NextResponse.json({
          error: 'Bank account not found'
        }, { status: 404 });
      }

      const bankAccountData = bankAccountDoc.data();

      // Verify the bank account belongs to the user
      if (bankAccountData?.userId !== userId) {
        console.error('❌ [SET PRIMARY] Bank account does not belong to user');
        return NextResponse.json({ error: 'Unauthorized to modify this bank account' }, { status: 403 });
      }

      // Clear the isPrimary flag from all other bank accounts for this user
      const allBankAccountsSnapshot = await db
        .collection(getCollectionName(COLLECTIONS.BANK_ACCOUNTS))
        .where('userId', '==', userId)
        .get();

      const batch = db.batch();

      allBankAccountsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isPrimary: false });
      });

      // Set the new primary account
      batch.update(bankAccountDoc.ref, { isPrimary: true });

      await batch.commit();
      console.log('✅ [SET PRIMARY] Updated isPrimary flags in Firestore');

      // Set as primary in user document
      await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
        primaryBankAccountId: bankAccountId
      }, { merge: true });

      console.log('✅ [SET PRIMARY] Updated primary bank account in user document');

      return NextResponse.json({
        success: true,
        message: 'Primary bank account updated successfully'
      });
    }

    return NextResponse.json({
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Error updating bank account:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({
        error: `Stripe error: ${error.message}`,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to update bank account'
    }, { status: 500 });
  }
}
