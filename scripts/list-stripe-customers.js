#!/usr/bin/env node

const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function listCustomers() {
  console.log('🔍 Listing Stripe customers...');
  console.log('Environment:', process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST' : 'LIVE');
  
  try {
    const customers = await stripe.customers.list({ limit: 10 });
    
    console.log(`\nFound ${customers.data.length} customers:`);
    
    customers.data.forEach(customer => {
      console.log(`\n👤 Customer: ${customer.id}`);
      console.log(`   Email: ${customer.email || 'N/A'}`);
      console.log(`   Name: ${customer.name || 'N/A'}`);
      console.log(`   Created: ${new Date(customer.created * 1000).toISOString()}`);
    });
    
    // Also check for subscriptions
    console.log('\n🔍 Checking for subscriptions...');
    const subscriptions = await stripe.subscriptions.list({ limit: 10 });
    
    console.log(`\nFound ${subscriptions.data.length} subscriptions:`);
    
    subscriptions.data.forEach(sub => {
      console.log(`\n📋 Subscription: ${sub.id}`);
      console.log(`   Customer: ${sub.customer}`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   Amount: $${sub.items.data[0]?.price?.unit_amount / 100 || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listCustomers().catch(console.error);
