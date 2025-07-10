#!/usr/bin/env node

/**
 * Test script to verify Stripe production connection and find user's subscription
 */

const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

// Use production key if available, fallback to regular key
const stripeKey = process.env.STRIPE_PROD_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeKey);

async function testStripeProduction() {
  console.log('🔍 Testing Stripe Production Connection...');
  console.log('Key type:', stripeKey?.startsWith('sk_live_') ? 'PRODUCTION' : 'TEST');
  console.log('Key prefix:', stripeKey?.substring(0, 12) + '...');
  
  try {
    // Look for customer by email
    console.log('\n📧 Searching for jamiegray2234@gmail.com...');
    const customers = await stripe.customers.list({
      email: 'jamiegray2234@gmail.com',
      limit: 5
    });
    
    if (customers.data.length === 0) {
      console.log('❌ No customers found with that email');
      
      // Try searching by the customer ID from Firebase
      console.log('\n🔍 Trying customer ID from Firebase: cus_ScveEgoRvQ8QI7');
      try {
        const customer = await stripe.customers.retrieve('cus_ScveEgoRvQ8QI7');
        console.log('✅ Found customer by ID:', customer.id);
        console.log('   Email:', customer.email);
        console.log('   Name:', customer.name);
        
        // Get subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          limit: 10
        });
        
        console.log(`\n📋 Found ${subscriptions.data.length} subscription(s):`);
        subscriptions.data.forEach(sub => {
          console.log(`   ${sub.id}: ${sub.status} - $${sub.items.data[0]?.price?.unit_amount / 100}/mo`);
        });
        
      } catch (customerError) {
        console.log('❌ Customer ID not found in production:', customerError.message);
      }
      
    } else {
      console.log(`✅ Found ${customers.data.length} customer(s):`);
      
      for (const customer of customers.data) {
        console.log(`\n👤 Customer: ${customer.id}`);
        console.log(`   Email: ${customer.email}`);
        console.log(`   Name: ${customer.name || 'N/A'}`);
        
        // Get subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          limit: 10
        });
        
        console.log(`   📋 Subscriptions: ${subscriptions.data.length}`);
        subscriptions.data.forEach(sub => {
          console.log(`     ${sub.id}: ${sub.status} - $${sub.items.data[0]?.price?.unit_amount / 100}/mo`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Stripe API Error:', error.message);
    console.error('   Type:', error.type);
    console.error('   Code:', error.code);
  }
}

testStripeProduction().catch(console.error);
