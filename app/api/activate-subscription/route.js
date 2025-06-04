import { db } from '../../firebase/database';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import Stripe from 'stripe';
import { NextResponse } from 'next/server';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const admin = getFirebaseAdmin();

export async function POST(request) {
  try {
    // Parse request body
    const { tier, customAmount, userId } = await request.json();
    const amount = customAmount;
    // Basic validation
    if (!amount || isNaN(amount) || amount <= 0) {
      return new NextResponse(JSON.stringify({ error: 'Invalid amount provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!userId) {
      return new NextResponse(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // Verify the user exists in Firebase
    try {
      await admin.auth().getUser(userId);
    } catch (error) {
      console.error('Error verifying user:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    
    // Fetch user data from Firestore
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return new NextResponse(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userData = userDoc.data();
    
    let stripeCustomerId = userData.stripeCustomerId;
    
    if (!stripeCustomerId) {
      // If no customer ID, check if one already exists in Stripe
      if (userData.email) {
        // First check if a customer with this email already exists
        const existingCustomers = await stripe.customers.list({ 
          email: userData.email,
          limit: 1
        });
        
        if (existingCustomers.data.length > 0) {
          // Use existing customer
          stripeCustomerId = existingCustomers.data[0].id;
        } else {
          // Create a new customer in Stripe
          const customer = await stripe.customers.create({
            metadata: {
              userId: userId
            },
            email: userData.email
          });
          
          stripeCustomerId = customer.id;
        }
      } else {
        // No email and no existing customer ID, create a new one
        const customer = await stripe.customers.create({
          metadata: {
            userId: userId
          }
        });
        
        stripeCustomerId = customer.id;
      }
      userData["stripeCustomerId"] = stripeCustomerId;
      await updateDoc(userDocRef, userData);
    }
    

    let subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active', // optional: active, canceled, past_due, etc.
      limit: 1,    // optional: max results
    });


    if(subscriptions.data.length > 0) { //subscription already exists
      const sub = subscriptions.data[0];

      let newPrice = tier;
      if (tier == 'custom'){
        newPrice = (await stripe.prices.create({
          unit_amount: customAmount,
          currency: 'usd',
          recurring: { interval: 'month' },
          product_data: {
            name: 'Custom Subscription',
          },
        })).id;
      }

      const item = sub.items.data[0];
      const price = await stripe.prices.retrieve(newPrice);
      const credit = parseInt(sub.metadata?.current_credit | '0', 10);

      if (price.unit_amount > credit) {

        const invoice = await stripe.invoices.create({
          customer: stripeCustomerId,
          collection_method: 'charge_automatically',
          default_payment_method: sub.default_payment_method,
          auto_advance: false,
          metadata: {
            tag: "upgrade",
            subscription_value: price.unit_amount - credit,
            price_id: newPrice,
          },
        });
        
        // Step 2: Create the invoice item attached to the invoice
        await stripe.invoiceItems.create({
          customer: stripeCustomerId,
          amount: price.unit_amount - credit,
          currency: 'usd',
          description: 'Subscription upgrade',
          invoice: invoice.id, // 👈 Important!
        });
        
        const finalized_invoice = await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.pay(finalized_invoice.id);
      }
      else {
        await stripe.subscriptions.update(sub.id, {
          items: [{
            id: item.id, // subscription item ID
            price: newPrice, // new price ID
          }],
          proration_behavior: 'none',

          metadata: {
            ...sub.metadata,
            subscription_value: price.unit_amount.toString()
          }
        });
      }
    }
    else {
      let price_item;
      let price_value;

      if (tier == "custom") {
        price_item = {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Custom Subscription',
            },
            unit_amount: customAmount, // in cents
            recurring: { interval: 'month' }
          },
          quantity: 1,
        };

        price_value = customAmount;
      }
      else {
        price_item = { price: tier, quantity: 1 };
        price_value = (await stripe.prices.retrieve(tier)).unit_amount;
      }
      
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [price_item],
        subscription_data: {
          metadata: { userId, tier, subscription_value: price_value },
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,
      });

      return new NextResponse(JSON.stringify({url: session.url, updated: false}));
    }

    return new NextResponse(JSON.stringify({ updated: true }));
    
  } catch (subscriptionError) {
    console.error('Error creating Stripe subscription:', subscriptionError);
    
    return new NextResponse(JSON.stringify({
      error: subscriptionError.message || 'Failed to create subscription',
      details: subscriptionError.raw || {}
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 