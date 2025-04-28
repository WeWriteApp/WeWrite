import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUserSubscription, updateSubscription } from '../../firebase/subscription';

export async function POST(request) {
  try {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Get request body
    const body = await request.json();
    const { userId, subscriptionData } = body;
    
    // Basic validation - ensure userId exists
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Get the user's subscription from Firestore
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 400 }
      );
    }
    
    let result;
    let customerId = subscription.stripeCustomerId;
    
    // Get user email from subscription data or use a placeholder
    const userEmail = subscriptionData.email || 'customer@example.com';
    const username = subscriptionData.username || 'Customer';
    
    // Always use a single product in Stripe (if needed)
    // Pricing is handled dynamically by our UI/backend, not Stripe prices
    // No need to reference or create Stripe prices here
    // Only use the customer and charge the dynamic amount

    // Create a test transaction in Stripe
    try {
      // If it's a demo subscription, create a real test customer in Stripe
      if (subscription.stripeSubscriptionId?.startsWith('demo_')) {
        // Check if we already have a real Stripe customer ID stored
        if (!customerId || customerId.startsWith('demo_')) {
          // Create a test customer in Stripe
          const customer = await stripe.customers.create({
            email: userEmail,
            name: username,
            metadata: {
              userId: userId
            }
          });
          
          customerId = customer.id;
          
          // Update the subscription with the real Stripe customer ID
          await updateSubscription(userId, {
            ...subscription,
            stripeCustomerId: customerId
          });
        }
        
        // Create a PaymentIntent to simulate a charge
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(subscription.amount * 100), // Stripe uses cents
          currency: 'usd',
          customer: customerId,
          payment_method: 'pm_card_visa', // Test payment method
          confirm: true,
          description: `Subscription renewal for ${userEmail}`,
          metadata: {
            userId: userId,
            subscriptionId: subscription.stripeSubscriptionId,
            simulatedRenewal: 'true',
            product: 'Subscription' // Always reference the single product
          },
          off_session: true,
          // Automatically confirm the payment as succeeded in test mode
          payment_method_options: {
            card: {
              capture_method: 'automatic',
            }
          }
        });
        
        result = paymentIntent;
      } else {
        // For real Stripe subscriptions, use the Stripe billing API
        // Always use the single product, but add invoice items dynamically
        const invoice = await stripe.invoices.create({
          customer: customerId,
          auto_advance: true, // auto-finalize the invoice
          collection_method: 'charge_automatically',
          description: `Manual test renewal for ${userEmail}`
        });
        
        // Add an invoice item for the dynamic amount
        await stripe.invoiceItems.create({
          customer: customerId,
          invoice: invoice.id,
          amount: Math.round(subscription.amount * 100),
          currency: 'usd',
          description: `Subscription renewal test (${new Date().toISOString()})`,
          metadata: {
            product: 'Subscription'
          }
        });
        
        // Finalize and pay the invoice
        const finalInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
        result = await stripe.invoices.pay(finalInvoice.id);
      }
      
      // Update the subscription renewal dates in Firestore
      const updatedSubscription = {
        ...subscriptionData,
        lastPaymentIntentId: result.id,
        lastPaymentAmount: subscription.amount,
        lastPaymentDate: new Date().toISOString()
      };
      
      await updateSubscription(userId, updatedSubscription);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Test transaction created successfully', 
        transaction: {
          id: result.id,
          amount: subscription.amount,
          status: result.status,
          date: new Date().toISOString()
        }
      });
    } catch (stripeError) {
      console.error('Stripe error:', stripeError);
      return NextResponse.json(
        { error: `Stripe error: ${stripeError.message}`, success: false },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error creating test transaction:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}