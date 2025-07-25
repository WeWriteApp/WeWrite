import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

// GET /api/payouts/history - Get payout history for user
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log(`Loading payout history for user: ${userId}`);

    // Get user data to find their connected account ID
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    const stripeConnectedAccountId = userData?.stripeConnectedAccountId;

    // Get payouts from our database
    console.log(`Fetching payouts from Firestore for user: ${userId}`);

    let payouts = [];

    try {
      // Query payouts collection for this user
      let query = db.collection(getCollectionName(COLLECTIONS.PAYOUTS))
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      // Apply status filter if provided
      if (status && status !== 'all') {
        query = query.where('status', '==', status);
      }

      const payoutsSnapshot = await query.get();

      payouts = payoutsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          amount: data.amount || 0,
          currency: data.currency || 'usd',
          status: data.status || 'pending',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
          scheduledAt: data.scheduledAt?.toDate?.()?.toISOString() || data.scheduledAt,
          completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
          processedAt: data.processedAt?.toDate?.()?.toISOString() || data.processedAt,
          description: data.description || `Payout for ${data.period || 'earnings'}`,
          period: data.period || new Date().toISOString().slice(0, 7), // YYYY-MM format
          bankAccount: data.bankAccount || 'Bank Account ****',
          arrivalDate: data.arrivalDate || data.completedAt?.toDate?.()?.toISOString() || null,
          failureReason: data.failureReason,
          stripeTransferId: data.stripeTransferId,
          metadata: data.metadata
        };
      });

      console.log(`Found ${payouts.length} payouts for user ${userId}`);

    } catch (error) {
      console.error('Error querying payouts from Firestore:', error);

      // If there's a Firestore error (like missing index), fall back to empty array
      // but log the error for debugging
      console.log('Falling back to empty payouts array due to Firestore error');
      payouts = [];
    }

    // Return empty array if no real payouts found - no fake data in production
    console.log(`Found ${payouts.length} real payouts for user ${userId}`);
    // Only show real payouts - no fake data in production

    // Get summary statistics
    const totalPayouts = payouts.length;
    const totalAmount = payouts.reduce((sum, payout) => sum + payout.amount, 0);
    const completedPayouts = payouts.filter(p => p.status === 'paid' || p.status === 'completed').length;
    const pendingPayouts = payouts.filter(p => p.status === 'pending' || p.status === 'in_transit').length;
    const failedPayouts = payouts.filter(p => p.status === 'failed' || p.status === 'canceled').length;

    return NextResponse.json({
      success: true,
      payouts,
      summary: {
        totalPayouts,
        totalAmount,
        completedPayouts,
        pendingPayouts,
        failedPayouts,
        currency: 'usd'
      },
      pagination: {
        limit,
        hasMore: payouts.length === limit
      }
    });

  } catch (error) {
    console.error('Error fetching payout history:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({
        error: `Stripe error: ${error.message}`,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to fetch payout history'
    }, { status: 500 });
  }
}

// POST /api/payouts/history - Create a new payout (for testing or manual payouts)
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, description, period } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ 
        error: 'Valid amount is required' 
      }, { status: 400 });
    }

    // Get user data
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    const stripeConnectedAccountId = userData?.stripeConnectedAccountId;
    const primaryBankAccountId = userData?.primaryBankAccountId;

    if (!stripeConnectedAccountId) {
      return NextResponse.json({
        error: 'No Stripe connected account found. Please set up your bank account first.'
      }, { status: 400 });
    }

    if (!primaryBankAccountId) {
      return NextResponse.json({
        error: 'No primary bank account found. Please set up a bank account first.'
      }, { status: 400 });
    }

    // Create payout record in our database
    const payoutId = `payout_${Date.now()}_${userId.substring(0, 8)}`;
    const payoutData = {
      id: payoutId,
      userId,
      amount,
      currency: 'usd',
      status: 'pending',
      description: description || `Payout for ${period || 'earnings'}`,
      period: period || null,
      bankAccountId: primaryBankAccountId,
      stripeConnectedAccountId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection(getCollectionName(COLLECTIONS.PAYOUTS)).doc(payoutId).set(payoutData);

    // TODO: Integrate with actual Stripe payout creation
    // For now, we'll just create the record and mark it as pending
    // In production, this would trigger the actual Stripe payout

    return NextResponse.json({
      success: true,
      payout: {
        id: payoutId,
        amount,
        currency: 'usd',
        status: 'pending',
        createdAt: new Date().toISOString(),
        description: payoutData.description
      },
      message: 'Payout request created successfully'
    });

  } catch (error) {
    console.error('Error creating payout:', error);
    
    return NextResponse.json({
      error: 'Failed to create payout'
    }, { status: 500 });
  }
}
