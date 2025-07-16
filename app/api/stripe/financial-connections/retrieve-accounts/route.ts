import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName, COLLECTIONS } from '../../../../utils/environmentConfig';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const admin = getFirebaseAdmin();

// Helper function to set up a Financial Connections account for payouts
async function setupAccountForPayouts(userId: string, financialAccount: any) {
  console.log('🔧 [SETUP PAYOUTS] Starting setup for user:', userId, 'account:', financialAccount.id);

  const db = admin.firestore();

  // Get user data
  console.log('📊 [SETUP PAYOUTS] Getting user data from Firestore...');
  const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
  const userData = userDoc.data();
  console.log('📊 [SETUP PAYOUTS] User data retrieved:', {
    exists: userDoc.exists,
    email: userData?.email,
    stripeConnectedAccountId: userData?.stripeConnectedAccountId
  });

  let stripeConnectedAccountId = userData?.stripeConnectedAccountId;

  // Create Stripe Connect account if it doesn't exist
  if (!stripeConnectedAccountId) {
    console.log('🏗️ [SETUP PAYOUTS] No Stripe Connect account found, creating new one...');

    const userEmail = userData?.email;
    if (!userEmail) {
      console.error('❌ [SETUP PAYOUTS] User email not found in Firestore');
      throw new Error('User email not found');
    }
    console.log('✅ [SETUP PAYOUTS] User email found:', userEmail);

    console.log('📡 [SETUP PAYOUTS] Creating Stripe Connect account...');
    const account = await stripe.accounts.create({
      type: 'express',
      email: userEmail,
      metadata: {
        firebaseUID: userId,
        username: userData?.username || 'Unknown User'
      }
    });

    stripeConnectedAccountId = account.id;
    console.log('✅ [SETUP PAYOUTS] Stripe Connect account created:', stripeConnectedAccountId);

    // Save account ID to Firestore
    console.log('💾 [SETUP PAYOUTS] Saving account ID to Firestore...');
    await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
      stripeConnectedAccountId: stripeConnectedAccountId
    }, { merge: true });
    console.log('✅ [SETUP PAYOUTS] Account ID saved to Firestore');
  } else {
    console.log('✅ [SETUP PAYOUTS] Using existing Stripe Connect account:', stripeConnectedAccountId);
  }

  // Check if this Financial Connections account is already added
  const externalAccounts = await stripe.accounts.listExternalAccounts(
    stripeConnectedAccountId,
    { object: 'bank_account', limit: 15 }
  );

  // Check if account already exists by matching routing number and last 4
  const existingAccount = externalAccounts.data.find((account: any) =>
    account.routing_number === financialAccount.routing_number &&
    account.last4 === financialAccount.last4
  );

  if (existingAccount) {
    // Account already exists, return it
    return {
      id: existingAccount.id,
      bankName: existingAccount.bank_name || financialAccount.institution_name,
      last4: existingAccount.last4,
      accountType: existingAccount.account_type || 'checking',
      isPrimary: existingAccount.id === userData?.primaryBankAccountId,
      isVerified: existingAccount.status === 'verified',
      routingNumber: existingAccount.routing_number,
      country: existingAccount.country,
      currency: existingAccount.currency,
      status: existingAccount.status
    };
  }

  // For Financial Connections accounts, we'll store them as connected accounts
  // and handle payouts through the Financial Connections system
  console.log('💾 [SETUP PAYOUTS] Storing Financial Connections account for payouts:', financialAccount.id);

  // Create a bank account object that represents the Financial Connections account
  const bankAccount = {
    id: financialAccount.id,
    object: 'bank_account',
    account_holder_type: 'individual',
    bank_name: financialAccount.institution_name || 'Unknown Bank',
    country: 'US',
    currency: 'usd',
    fingerprint: financialAccount.id, // Use FC account ID as fingerprint
    last4: financialAccount.last4 || 'N/A',
    routing_number: financialAccount.routing_number || 'N/A',
    status: 'verified',
    // Store Financial Connections specific data
    financial_connections_account: financialAccount.id,
    subcategory: financialAccount.subcategory || 'checking',
    account_holder_name: userData?.username || userData?.email || 'Account Holder'
  };

  console.log('✅ [SETUP PAYOUTS] Financial Connections account stored:', {
    id: bankAccount.id,
    bank_name: bankAccount.bank_name,
    last4: bankAccount.last4,
    status: bankAccount.status
  });

  // If this is the first bank account, make it primary
  if (externalAccounts.data.length === 0) {
    await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).set({
      primaryBankAccountId: bankAccount.id
    }, { merge: true });
  }

  return {
    id: bankAccount.id,
    bankName: (bankAccount as any).bank_name || financialAccount.institution_name,
    last4: (bankAccount as any).last4,
    accountType: (bankAccount as any).account_type,
    isPrimary: externalAccounts.data.length === 0,
    isVerified: (bankAccount as any).status === 'verified',
    routingNumber: (bankAccount as any).routing_number,
    country: (bankAccount as any).country,
    currency: (bankAccount as any).currency,
    status: (bankAccount as any).status
  };
}

export async function POST(request: NextRequest) {
  console.log('🔥 [RETRIEVE API] Starting retrieve-accounts endpoint');

  try {
    // Authenticate user
    console.log('🔐 [RETRIEVE API] Getting authenticated user...');
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.error('❌ [RETRIEVE API] No authenticated user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ [RETRIEVE API] Authenticated user:', userId);

    const requestBody = await request.json();
    console.log('📥 [RETRIEVE API] Request body:', requestBody);

    const { sessionId } = requestBody;

    if (!sessionId) {
      console.error('❌ [RETRIEVE API] No session ID provided');
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    console.log('✅ [RETRIEVE API] Session ID received:', sessionId);

    // Retrieve the Financial Connections session
    console.log('📡 [RETRIEVE API] Retrieving Financial Connections session...');
    const session = await stripe.financialConnections.sessions.retrieve(sessionId);
    console.log('✅ [RETRIEVE API] Session retrieved:', {
      id: session.id,
      status: session.status,
      accountsCount: session.accounts?.data?.length || 0
    });

    // Verify the session belongs to the authenticated user
    console.log('🔐 [RETRIEVE API] Verifying session ownership...');
    const customer = await stripe.customers.retrieve(session.account_holder.customer as string);
    if (typeof customer === 'string' || customer.metadata?.userId !== userId) {
      console.error('❌ [RETRIEVE API] Session does not belong to user');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.log('✅ [RETRIEVE API] Session ownership verified');

    // Get the connected accounts
    console.log('📡 [RETRIEVE API] Listing Financial Connections accounts...');
    const accounts = await stripe.financialConnections.accounts.list({
      session: sessionId,
    });

    console.log('✅ [RETRIEVE API] Financial Connections accounts retrieved:', accounts.data.length);
    console.log('📊 [RETRIEVE API] Account details:', accounts.data.map(acc => ({
      id: acc.id,
      institution: acc.institution_name,
      last4: acc.last4,
      status: acc.status,
      subcategory: acc.subcategory
    })));

    if (accounts.data.length === 0) {
      console.warn('⚠️ [RETRIEVE API] No accounts found in Financial Connections session');
    }

    // For each Financial Connections account, set it up for payouts
    console.log('🔧 [RETRIEVE API] Setting up accounts for payouts...');
    const bankAccounts = [];

    for (const account of accounts.data) {
      try {
        console.log('🔧 [RETRIEVE API] Processing account:', account.id, account.institution_name);
        // Set up the account for payouts by adding it to a Stripe Connect account
        const payoutAccount = await setupAccountForPayouts(userId, account);
        bankAccounts.push(payoutAccount);
        console.log('✅ [RETRIEVE API] Successfully set up account for payouts:', payoutAccount.id);
      } catch (error) {
        console.error('❌ [RETRIEVE API] Error setting up account for payouts:', error);
        console.error('❌ [RETRIEVE API] Error details:', error instanceof Error ? error.message : 'Unknown error');
        // Continue with other accounts even if one fails
      }
    }

    console.log('📊 [RETRIEVE API] Total bank accounts set up:', bankAccounts.length);
    console.log('📊 [RETRIEVE API] Bank accounts data:', bankAccounts);

    // Save bank accounts to Firestore for persistence
    console.log('💾 [RETRIEVE API] Saving bank accounts to Firestore...');
    const db = admin.firestore();

    for (const account of bankAccounts) {
      const bankAccountData = {
        id: account.id,
        userId: userId,
        bankName: `Bank Account ••••${account.last4 || 'N/A'}`,
        last4: account.last4 || 'N/A',
        accountType: account.subcategory || 'checking',
        isPrimary: false, // Will be set separately
        isVerified: true,
        routingNumber: account.routing_number || 'N/A',
        country: account.country || 'US',
        currency: account.currency || 'usd',
        status: account.status || 'verified',
        financialConnectionsAccountId: account.financial_connections_account || account.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection(getCollectionName(COLLECTIONS.BANK_ACCOUNTS)).doc(account.id).set(bankAccountData);
      console.log('💾 [RETRIEVE API] Saved bank account to Firestore:', account.id);
    }

    // Set the first account as primary if no primary account exists
    if (bankAccounts.length > 0) {
      const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
      const userData = userDoc.data();

      // Check if user has any existing bank accounts
      const existingBankAccountsSnapshot = await db
        .collection(getCollectionName(COLLECTIONS.BANK_ACCOUNTS))
        .where('userId', '==', userId)
        .get();

      const hasExistingAccounts = existingBankAccountsSnapshot.size > bankAccounts.length;

      if (!userData?.primaryBankAccountId || !hasExistingAccounts) {
        const firstAccountId = bankAccounts[0].id;
        await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).update({
          primaryBankAccountId: firstAccountId
        });
        await db.collection(getCollectionName(COLLECTIONS.BANK_ACCOUNTS)).doc(firstAccountId).update({
          isPrimary: true
        });
        console.log('💾 [RETRIEVE API] Set primary bank account:', firstAccountId);
      }
    }

    console.log('✅ [RETRIEVE API] All bank accounts saved to Firestore');

    return NextResponse.json({
      accounts: bankAccounts,
      sessionStatus: session.status,
    });

  } catch (error) {
    console.error('Error retrieving Financial Connections accounts:', error);
    
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
