#!/usr/bin/env node

const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function findUserInStripe() {
  console.log('🔍 Looking for jamiegray2234@gmail.com in Stripe...');
  
  try {
    // Search for customer by email
    const customers = await stripe.customers.list({
      email: 'jamiegray2234@gmail.com',
      limit: 10
    });
    
    if (customers.data.length > 0) {
      console.log(`\n✅ Found ${customers.data.length} customer(s) with that email:`);
      
      for (const customer of customers.data) {
        console.log(`\n👤 Customer: ${customer.id}`);
        console.log(`   Email: ${customer.email}`);
        console.log(`   Name: ${customer.name || 'N/A'}`);
        
        // Get subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          limit: 10
        });
        
        console.log(`   Subscriptions: ${subscriptions.data.length}`);
        
        subscriptions.data.forEach(sub => {
          console.log(`     📋 ${sub.id}: ${sub.status} - $${sub.items.data[0]?.price?.unit_amount / 100 || 'N/A'}/mo`);
        });
      }
    } else {
      console.log('\n❌ No customers found with that email');
      console.log('\n🔍 Let me check all customers for similar emails...');
      
      const allCustomers = await stripe.customers.list({ limit: 100 });
      const matchingCustomers = allCustomers.data.filter(c => 
        c.email && (c.email.includes('jamie') || c.email.includes('gray'))
      );
      
      if (matchingCustomers.length > 0) {
        console.log(`\n📧 Found ${matchingCustomers.length} customers with similar emails:`);
        matchingCustomers.forEach(customer => {
          console.log(`   ${customer.id}: ${customer.email}`);
        });
      } else {
        console.log('\n❌ No customers found with similar emails');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findUserInStripe().catch(console.error);
