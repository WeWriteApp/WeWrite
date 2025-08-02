import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUserIdFromRequest } from '../../../auth-helper';
import { StripeUrls } from '../../../../utils/urlConfig';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

console.log('Financial Connections API loaded');

export async function POST(request: NextRequest) {
  try {
    // CRITICAL FIX: Check if Financial Connections is enabled
    if (!process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED) {
      console.log('📭 [FINANCIAL CONNECTIONS] Feature disabled - registration required');
      return NextResponse.json({
        error: 'Financial Connections not available',
        message: 'Bank account linking is temporarily unavailable. Please use manual payout setup.',
        code: 'FEATURE_DISABLED'
      }, { status: 503 });
    }

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

    // Get or create Stripe customer
    let customerId: string;

    // First, try to find existing customer by metadata
    const existingCustomers = await stripe.customers.list({
      limit: 100, // Search through recent customers
    });

    // Find customer with matching userId in metadata
    const existingCustomer = existingCustomers.data.find(
      customer => customer.metadata?.userId === userId
    );

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        metadata: { userId },
      });
      customerId = customer.id;
    }

    // Create Financial Connections session
    console.log('📡 [CREATE SESSION] Creating Financial Connections session for customer:', customerId);

    const session = await stripe.financialConnections.sessions.create({
      account_holder: {
        type: 'customer',
        customer: customerId,
      },
      permissions: ['payment_method', 'balances'],
      filters: {
        countries: ['US'],
      },
      return_url: StripeUrls.financialConnectionsSuccess(),
    });

    console.log('✅ [CREATE SESSION] Financial Connections session created:', {
      sessionId: session.id,
      clientSecret: session.client_secret ? 'present' : 'missing',
      accountHolder: session.account_holder,
      permissions: session.permissions
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('Error creating Financial Connections session:', error);
    
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
