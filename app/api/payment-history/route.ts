import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../utils/stripeConfig';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getUserIdFromRequest } from '../auth-helper';
import { getCollectionName } from '../../utils/environmentConfig';

interface Payment {
  id: string;
  amount: number;
  status: string;
  date: string;
  currency: string;
  description: string;
}

const stripeSecretKey = getStripeSecretKey();
const stripe = new Stripe(stripeSecretKey);

async function fetchPaymentHistoryForUser(userId: string): Promise<Payment[]> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new Error('Database not available');
  }

  const db = admin.firestore();
  const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();

  if (!userDoc.exists) {
    throw new Error('User not found');
  }

  const userData = userDoc.data();
  const stripeCustomerId = userData?.stripeCustomerId;

  if (!stripeCustomerId) {
    return [];
  }

  try {
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 10,
      status: 'paid'
    });

    const payments: Payment[] = invoices.data.map(invoice => ({
      id: invoice.id,
      amount: invoice.amount_paid / 100,
      status: invoice.status === 'paid' ? 'succeeded' : (invoice.status || 'unknown'),
      date: new Date(invoice.created * 1000).toISOString(),
      currency: invoice.currency,
      description: invoice.description || 'Subscription payment'
    }));

    if (payments.length === 0) {
      const paymentIntents = await stripe.paymentIntents.list({
        customer: stripeCustomerId,
        limit: 10
      });

      return paymentIntents.data.map(payment => ({
        id: payment.id,
        amount: payment.amount / 100,
        status: payment.status,
        date: new Date(payment.created * 1000).toISOString(),
        currency: payment.currency,
        description: 'Payment'
      }));
    }

    return payments;
  } catch (stripeError) {
    const err = stripeError as Error;
    console.error('Error fetching from Stripe:', err);
    throw new Error(err.message || 'Failed to fetch payment history');
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get('userId');

    if (!userId) {
      userId = await getUserIdFromRequest(request);
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const payments = await fetchPaymentHistoryForUser(userId);
    return NextResponse.json({ payments });

  } catch (error) {
    const err = error as Error;
    console.error('Error fetching payment history:', err);
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const payments = await fetchPaymentHistoryForUser(userId);
    return NextResponse.json({ payments });

  } catch (error) {
    const err = error as Error;
    console.error('Error fetching payment history:', err);
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
