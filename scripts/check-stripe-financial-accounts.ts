/**
 * Check Stripe Financial Accounts
 *
 * Run with: npx tsx scripts/check-stripe-financial-accounts.ts
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-12-18.acacia'
});

async function checkFinancialAccounts() {
  console.log('🔍 Checking Stripe account for Financial Accounts...\n');

  try {
    // Check regular balance first
    console.log('📊 Current Balance:');
    const balance = await stripe.balance.retrieve();

    console.log('  Available:');
    balance.available.forEach(b => {
      console.log(`    ${b.currency.toUpperCase()}: $${(b.amount / 100).toFixed(2)}`);
      // Check for source_types which might indicate storage
      const sourceTypes = (b as any).source_types;
      if (sourceTypes) {
        console.log(`    Source types:`, sourceTypes);
      }
    });

    console.log('  Pending:');
    balance.pending.forEach(b => {
      console.log(`    ${b.currency.toUpperCase()}: $${(b.amount / 100).toFixed(2)}`);
    });

    // Try to list financial accounts using v2 API
    console.log('\n📁 Checking for Financial Accounts (v2 API)...');

    // The v2 API requires a different approach - let's try the raw request
    const response = await fetch('https://api.stripe.com/v2/core/vault/gb_bank_accounts', {
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Stripe-Version': '2024-12-18.acacia'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('  Financial Accounts found:', JSON.stringify(data, null, 2));
    } else {
      console.log('  v2 API response:', response.status, response.statusText);
    }

    // Check if there's a payout destination that might be a financial account
    console.log('\n🏦 Checking External Accounts & Payout Methods...');
    const account = await stripe.accounts.retrieve();

    if (account.external_accounts) {
      console.log('  External accounts:', account.external_accounts.data.length);
      account.external_accounts.data.forEach((ext: any) => {
        console.log(`    - ${ext.object}: ${ext.bank_name || ext.brand || 'Unknown'} (${ext.id})`);
      });
    }

    // Check payouts to see if any went to financial accounts
    console.log('\n📤 Recent Payouts (checking for FA destinations):');
    const payouts = await stripe.payouts.list({ limit: 5 });

    if (payouts.data.length === 0) {
      console.log('  No payouts found');
    } else {
      payouts.data.forEach(p => {
        console.log(`    - ${p.id}: $${(p.amount / 100).toFixed(2)} → ${p.destination || 'default'} (${p.status})`);
      });
    }

    console.log('\n✅ Check complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Go to Stripe Dashboard → Balances → Storage Balance');
    console.log('   2. If you see a storage balance, you have a Financial Account');
    console.log('   3. Look for the Financial Account ID (starts with "fa_")');
    console.log('   4. Or create one via Dashboard if not present');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkFinancialAccounts();
