#!/usr/bin/env node

/**
 * Emergency script to check and fix duplicate subscriptions
 */

const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

// Force production key since preview uses production data
const stripeKey = process.env.STRIPE_PROD_SECRET_KEY;
const stripe = new Stripe(stripeKey);

async function checkSubscriptions() {
  console.log('🚨 EMERGENCY: Checking for duplicate subscriptions...');
  console.log('Using Stripe key:', stripeKey?.startsWith('sk_live_') ? 'PRODUCTION' : 'TEST');
  
  try {
    // Look for customer by email
    const customers = await stripe.customers.list({
      email: 'jamiegray2234@gmail.com',
      limit: 10
    });
    
    if (customers.data.length === 0) {
      console.log('❌ No customers found with that email');
      return;
    }
    
    console.log(`\n👤 Found ${customers.data.length} customer(s):`);
    
    for (const customer of customers.data) {
      console.log(`\n📋 Customer: ${customer.id} (${customer.email})`);
      
      // Get all subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 10
      });
      
      console.log(`   📊 Total subscriptions: ${subscriptions.data.length}`);
      
      const activeSubscriptions = subscriptions.data.filter(sub => sub.status === 'active');
      console.log(`   ✅ Active subscriptions: ${activeSubscriptions.length}`);

      if (activeSubscriptions.length > 1) {
        console.log('\n🚨 DUPLICATE SUBSCRIPTIONS DETECTED!');
      }
      
      subscriptions.data.forEach((sub, index) => {
        const amount = sub.items.data[0]?.price?.unit_amount / 100 || 0;
        const created = new Date(sub.created * 1000).toISOString();
        
        console.log(`\n   ${index + 1}. Subscription: ${sub.id}`);
        console.log(`      Status: ${sub.status}`);
        console.log(`      Amount: $${amount}/mo`);
        console.log(`      Created: ${created}`);
        console.log(`      Current Period: ${new Date(sub.current_period_start * 1000).toISOString()} - ${new Date(sub.current_period_end * 1000).toISOString()}`);
        
        if (sub.status === 'active' && activeSubscriptions.length > 1) {
          console.log(`      🚨 This is a duplicate! Consider canceling.`);
        }
      });
    }
    
    if (activeSubscriptions.length > 1) {
      console.log('\n💡 RECOMMENDED ACTION:');
      console.log('   1. Keep the most recent $20 subscription');
      console.log('   2. Cancel the older $10 subscription');
      console.log('   3. Run the fix script to cancel duplicates');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSubscriptions().catch(console.error);
