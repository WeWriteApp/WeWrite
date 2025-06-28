#!/usr/bin/env node

/**
 * Subscription Cleanup Utility
 * 
 * This script helps clean up multiple subscriptions for customers to ensure
 * a clean experience in the Stripe Customer Portal.
 * 
 * Usage:
 *   node scripts/subscription-cleanup.js --dry-run
 *   node scripts/subscription-cleanup.js --customer cus_123456789
 *   node scripts/subscription-cleanup.js --execute --max-customers 10
 */

const Stripe = require('stripe');
const admin = require('firebase-admin');

// Configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY environment variable is required');
  process.exit(1);
}

// Initialize Stripe
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Use default credentials (for local development)
    admin.initializeApp();
  }
}

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--execute');
const customerId = args.find(arg => arg.startsWith('--customer'))?.split('=')[1];
const maxCustomers = parseInt(args.find(arg => arg.startsWith('--max-customers'))?.split('=')[1] || '50');
const includeStatuses = ['canceled', 'incomplete', 'past_due', 'unpaid'];

async function main() {
  console.log('🧹 WeWrite Subscription Cleanup Utility');
  console.log('==========================================');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚡ EXECUTE (changes will be made)'}`);
  console.log(`Max customers: ${maxCustomers}`);
  console.log(`Include statuses: ${includeStatuses.join(', ')}`);
  
  if (customerId) {
    console.log(`Target customer: ${customerId}`);
  }
  
  console.log('==========================================\n');

  try {
    const summary = {
      totalCustomersProcessed: 0,
      totalSubscriptionsCancelled: 0,
      customersWithMultipleSubscriptions: 0,
      errors: [],
      results: []
    };

    if (customerId) {
      // Clean up specific customer
      console.log(`🔍 Processing customer: ${customerId}`);
      const result = await cleanupCustomerSubscriptions(customerId, includeStatuses, dryRun);
      summary.results.push(result);
      summary.totalCustomersProcessed = 1;
      summary.totalSubscriptionsCancelled = result.cancelledSubscriptions;
      if (result.totalSubscriptions > 1) {
        summary.customersWithMultipleSubscriptions = 1;
      }
    } else {
      // Find and clean up all customers with multiple subscriptions
      console.log('🔍 Finding customers with multiple subscriptions...');
      const customers = await findCustomersWithMultipleSubscriptions(maxCustomers);
      console.log(`📊 Found ${customers.length} customers with multiple subscriptions\n`);

      for (const customer of customers) {
        try {
          console.log(`🔧 Processing customer: ${customer.id}`);
          const result = await cleanupCustomerSubscriptions(customer.id, includeStatuses, dryRun);
          summary.results.push(result);
          summary.totalCustomersProcessed++;
          summary.totalSubscriptionsCancelled += result.cancelledSubscriptions;
          if (result.totalSubscriptions > 1) {
            summary.customersWithMultipleSubscriptions++;
          }
        } catch (error) {
          const errorMsg = `Failed to process customer ${customer.id}: ${error.message}`;
          summary.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }
    }

    // Print summary
    console.log('\n📊 CLEANUP SUMMARY');
    console.log('==================');
    console.log(`Customers processed: ${summary.totalCustomersProcessed}`);
    console.log(`Customers with multiple subscriptions: ${summary.customersWithMultipleSubscriptions}`);
    console.log(`Subscriptions ${dryRun ? 'would be cancelled' : 'cancelled'}: ${summary.totalSubscriptionsCancelled}`);
    
    if (summary.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${summary.errors.length}`);
      summary.errors.forEach(error => console.log(`   - ${error}`));
    }

    if (dryRun && summary.totalSubscriptionsCancelled > 0) {
      console.log('\n💡 To execute the cleanup, run with --execute flag');
    }

    console.log('\n✅ Cleanup completed successfully');

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

async function findCustomersWithMultipleSubscriptions(maxCustomers) {
  const customersWithMultiple = [];
  let hasMore = true;
  let startingAfter;

  while (hasMore && customersWithMultiple.length < maxCustomers) {
    const customers = await stripe.customers.list({
      limit: 100,
      starting_after: startingAfter,
    });

    for (const customer of customers.data) {
      if (customersWithMultiple.length >= maxCustomers) break;

      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 100,
      });

      if (subscriptions.data.length > 1) {
        customersWithMultiple.push(customer);
        console.log(`   📋 Customer ${customer.id}: ${subscriptions.data.length} subscriptions`);
      }
    }

    hasMore = customers.has_more;
    if (customers.data.length > 0) {
      startingAfter = customers.data[customers.data.length - 1].id;
    }
  }

  return customersWithMultiple;
}

async function cleanupCustomerSubscriptions(customerId, includeStatuses, dryRun) {
  const result = {
    customerId,
    totalSubscriptions: 0,
    cancelledSubscriptions: 0,
    activeSubscriptions: 0,
    errors: []
  };

  try {
    // Get Firebase user ID for this customer
    const usersSnapshot = await db.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    
    if (!usersSnapshot.empty) {
      result.userId = usersSnapshot.docs[0].id;
      console.log(`   👤 Firebase User: ${result.userId}`);
    }

    // Get all subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 100,
    });

    result.totalSubscriptions = subscriptions.data.length;
    console.log(`   📊 Total subscriptions: ${result.totalSubscriptions}`);

    if (subscriptions.data.length <= 1) {
      console.log('   ✅ No cleanup needed (≤1 subscription)');
      return result;
    }

    // Sort subscriptions by creation date (newest first)
    const sortedSubscriptions = subscriptions.data.sort((a, b) => b.created - a.created);
    
    // Keep the newest active subscription, cancel others
    let keptActiveSubscription = false;

    for (const subscription of sortedSubscriptions) {
      const createdDate = new Date(subscription.created * 1000).toISOString().split('T')[0];
      
      if (subscription.status === 'active') {
        if (!keptActiveSubscription) {
          // Keep the first (newest) active subscription
          keptActiveSubscription = true;
          result.activeSubscriptions++;
          console.log(`   ✅ Keeping active subscription ${subscription.id} (${createdDate})`);
        } else {
          // Cancel additional active subscriptions
          if (!dryRun) {
            await stripe.subscriptions.cancel(subscription.id);
          }
          result.cancelledSubscriptions++;
          console.log(`   ${dryRun ? '🔍' : '❌'} ${dryRun ? 'Would cancel' : 'Cancelled'} duplicate active subscription ${subscription.id} (${createdDate})`);
        }
      } else if (includeStatuses.includes(subscription.status)) {
        // Cancel subscriptions with specified statuses
        if (!dryRun && subscription.status !== 'canceled') {
          await stripe.subscriptions.cancel(subscription.id);
        }
        result.cancelledSubscriptions++;
        console.log(`   ${dryRun ? '🔍' : '❌'} ${dryRun ? 'Would cancel' : 'Cancelled'} ${subscription.status} subscription ${subscription.id} (${createdDate})`);
      } else {
        console.log(`   ⏭️  Skipping ${subscription.status} subscription ${subscription.id} (${createdDate})`);
      }
    }

  } catch (error) {
    const errorMsg = error.message;
    result.errors.push(errorMsg);
    console.error(`   ❌ Error processing customer ${customerId}:`, error.message);
  }

  return result;
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { main, cleanupCustomerSubscriptions, findCustomersWithMultipleSubscriptions };
