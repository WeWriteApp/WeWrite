/**
 * Stripe webhook handler for payout-related events
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { stripePayoutService } from '../../../services/stripePayoutService';
import { webhookRateLimiter } from '../../../utils/rateLimiter';

const stripe = new Stripe(getStripeSecretKey());
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_PAYOUTS;

export async function POST(request: NextRequest) {
  try {
    // Apply webhook rate limiting (by source IP or Stripe)
    const sourceIdentifier = request.headers.get('x-forwarded-for') || 'stripe';
    const rateLimitResult = await webhookRateLimiter.checkLimit(sourceIdentifier);

    if (!rateLimitResult.allowed) {
      console.warn('Webhook rate limit exceeded:', sourceIdentifier);
      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: 'Too many webhook requests'
      }, { status: 429 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !endpointSecret) {
      console.error('Missing Stripe signature or webhook secret');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`Received Stripe webhook: ${event.type}`);

    // Handle the event
    try {
      await stripePayoutService.handleWebhookEvent(event);
      
      return NextResponse.json({ 
        received: true,
        eventType: event.type 
      });
      
    } catch (error) {
      console.error('Error handling webhook event:', error);
      return NextResponse.json({ 
        error: 'Webhook handler failed' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ 
      error: 'Webhook processing failed' 
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    service: 'stripe-payouts-webhook',
    timestamp: new Date().toISOString()
  });
}