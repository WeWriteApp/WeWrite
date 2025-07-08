import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';

/**
 * Debug API endpoint to test Stripe connection and configuration
 * This helps troubleshoot Stripe issues on Vercel preview deployments
 */
export async function POST(request: NextRequest) {
  try {
    const secretKey = getStripeSecretKey();
    
    if (!secretKey) {
      return NextResponse.json({
        success: false,
        error: 'Stripe secret key not found',
        details: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL_ENV: process.env.VERCEL_ENV,
          hasTestKey: !!process.env.STRIPE_TEST_SECRET_KEY,
          hasProdKey: !!process.env.STRIPE_PROD_SECRET_KEY,
          hasGenericKey: !!process.env.STRIPE_SECRET_KEY
        }
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });

    // Test the connection by retrieving account info
    const account = await stripe.accounts.retrieve();
    
    // Test creating a customer (this is safe in test mode)
    const testCustomer = await stripe.customers.create({
      email: 'test@example.com',
      metadata: {
        debug_test: 'true',
        created_at: new Date().toISOString()
      }
    });

    // Clean up - delete the test customer
    await stripe.customers.del(testCustomer.id);

    return NextResponse.json({
      success: true,
      details: {
        accountId: account.id,
        accountType: account.type,
        country: account.country,
        currency: account.default_currency,
        livemode: account.livemode,
        testCustomerCreated: testCustomer.id,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL_ENV: process.env.VERCEL_ENV,
          keyType: secretKey.startsWith('sk_test_') ? 'test' : 'live'
        }
      }
    });

  } catch (error) {
    console.error('Stripe test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        hasSecretKey: !!getStripeSecretKey()
      }
    });
  }
}
