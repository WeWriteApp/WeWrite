import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getUserIdFromRequest } from '../../auth-helper';
import { getCollectionName, COLLECTIONS, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { getStripe } from '../../../lib/stripe';

function getAdmin() { return getFirebaseAdmin(); }
function getStripeClient() { return getStripe(); }

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


    const db = getAdmin().firestore();

    let payouts: any[] = [];

    try {
      // Query usdPayouts collection (matches where PayoutService writes)
      let query = db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
        .where('userId', '==', userId)
        .orderBy('requestedAt', 'desc')
        .limit(limit);

      // Apply status filter if provided
      if (status && status !== 'all') {
        query = query.where('status', '==', status);
      }

      const payoutsSnapshot = await query.get();

      payouts = payoutsSnapshot.docs.map(doc => {
        const data = doc.data();
        const amountCents = data.amountCents || 0;
        return {
          id: doc.id,
          amount: amountCents / 100,
          amountCents,
          currency: 'usd',
          status: data.status || 'pending',
          createdAt: data.requestedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
          description: `Payout ${doc.id}`,
          failureReason: data.failureReason || null,
          stripeTransferId: data.stripePayoutId || null,
        };
      });


    } catch (error) {
      console.error('Error querying payouts from Firestore:', error);
      payouts = [];
    }

    // Get summary statistics
    const totalPayouts = payouts.length;
    const totalAmount = payouts.reduce((sum, payout) => sum + payout.amount, 0);
    const completedPayouts = payouts.filter(p => p.status === 'paid' || p.status === 'completed').length;
    const pendingPayouts = payouts.filter(p => p.status === 'pending' || p.status === 'pending_approval').length;
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
    const db = getAdmin().firestore();
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

    // Create payout record in usdPayouts collection (matches PayoutService schema)
    const payoutId = `payout_${Date.now()}_${userId.substring(0, 8)}`;
    const amountCents = Math.round(amount * 100);
    const payoutData = {
      id: payoutId,
      userId,
      amountCents,
      status: 'pending',
      requestedAt: getAdmin().firestore.FieldValue.serverTimestamp(),
    };

    await db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).doc(payoutId).set(payoutData);

    // Payout record created — Stripe payout transfer integration pending

    return NextResponse.json({
      success: true,
      payout: {
        id: payoutId,
        amount,
        amountCents,
        currency: 'usd',
        status: 'pending',
        createdAt: new Date().toISOString(),
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
