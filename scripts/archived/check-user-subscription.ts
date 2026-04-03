/**
 * User Subscription Diagnostic Script
 *
 * Checks a user's subscription status across Firestore and Stripe to diagnose
 * subscription issues.
 *
 * Usage:
 *   npx tsx scripts/check-user-subscription.ts <username>
 *   npx tsx scripts/check-user-subscription.ts --user-id=<userId>
 *   npx tsx scripts/check-user-subscription.ts <username> --fix
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import Stripe from 'stripe';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Parse arguments
const args = process.argv.slice(2);
const usernameArg = args.find((a) => !a.startsWith('--'));
const userIdArg = args.find((a) => a.startsWith('--user-id='))?.split('=')[1];
const shouldFix = args.includes('--fix');
const forceProduction = args.includes('--env=prod');

if (!usernameArg && !userIdArg) {
  console.log('Usage: npx tsx scripts/check-user-subscription.ts <username>');
  console.log('       npx tsx scripts/check-user-subscription.ts --user-id=<userId>');
  console.log('');
  console.log('Options:');
  console.log('  --fix        Attempt to fix subscription sync issues');
  console.log('  --env=prod   Force production environment');
  process.exit(1);
}

// Initialize Firebase Admin
function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const keyJson = process.env.GOOGLE_CLOUD_KEY_JSON;
  if (keyJson) {
    let credentials;
    try {
      credentials = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf8'));
    } catch {
      credentials = JSON.parse(keyJson);
    }
    return admin.initializeApp({
      credential: admin.credential.cert(credentials),
      projectId: credentials.project_id,
    });
  }

  throw new Error('No Firebase credentials found. Set GOOGLE_CLOUD_KEY_JSON');
}

// Initialize Stripe
function initStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY not found');
  }
  return new Stripe(secretKey, {
    apiVersion: '2024-12-18.acacia' as any,
  });
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('     USER SUBSCRIPTION DIAGNOSTIC');
  console.log('════════════════════════════════════════════════════════════\n');

  const app = initFirebase();
  const db = app.firestore();
  const stripe = initStripe();

  const isProduction = forceProduction || process.env.NODE_ENV === 'production' || !process.env.VERCEL_ENV;
  const collectionPrefix = isProduction ? '' : 'DEV_';

  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Collection prefix: "${collectionPrefix}"`);

  // Step 1: Find user
  let userId: string | null = null;
  let userData: any = null;

  if (userIdArg) {
    userId = userIdArg;
    const userDoc = await db.collection(`${collectionPrefix}users`).doc(userId).get();
    if (userDoc.exists) {
      userData = userDoc.data();
    }
  } else if (usernameArg) {
    console.log(`\nSearching for username: "${usernameArg}"...`);

    // Try exact match first
    const exactQuery = await db
      .collection(`${collectionPrefix}users`)
      .where('username', '==', usernameArg)
      .limit(1)
      .get();

    if (!exactQuery.empty) {
      userId = exactQuery.docs[0].id;
      userData = exactQuery.docs[0].data();
    } else {
      // Try case-insensitive search
      const lowerQuery = await db
        .collection(`${collectionPrefix}users`)
        .where('usernameLower', '==', usernameArg.toLowerCase())
        .limit(1)
        .get();

      if (!lowerQuery.empty) {
        userId = lowerQuery.docs[0].id;
        userData = lowerQuery.docs[0].data();
      }
    }
  }

  if (!userId || !userData) {
    console.error(`\n❌ User not found: ${usernameArg || userIdArg}`);
    process.exit(1);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                    USER DATA');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`User ID:        ${userId}`);
  console.log(`Username:       ${userData.username || 'N/A'}`);
  console.log(`Email:          ${userData.email || 'N/A'}`);
  console.log(`Stripe Customer: ${userData.stripeCustomerId || 'NOT SET'}`);

  // Step 2: Check subscription document
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                SUBSCRIPTION DOCUMENT');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Path: ${collectionPrefix}users/${userId}/subscriptions/current`);

  const subDoc = await db
    .collection(`${collectionPrefix}users`)
    .doc(userId)
    .collection('subscriptions')
    .doc('current')
    .get();

  let subData: any = null;
  if (subDoc.exists) {
    subData = subDoc.data();
    console.log('\n  Subscription Data:');
    console.log(`    Status:              ${subData?.status || 'N/A'}`);
    console.log(`    Amount:              $${subData?.amount || 0}`);
    console.log(`    Tier:                ${subData?.tier || 'N/A'}`);
    console.log(`    Stripe Sub ID:       ${subData?.stripeSubscriptionId || 'N/A'}`);
    console.log(`    Current Period Start: ${subData?.currentPeriodStart?.toDate?.() || subData?.currentPeriodStart || 'N/A'}`);
    console.log(`    Current Period End:   ${subData?.currentPeriodEnd?.toDate?.() || subData?.currentPeriodEnd || 'N/A'}`);
    console.log(`    Cancel At Period End: ${subData?.cancelAtPeriodEnd || false}`);
    console.log(`    Failure Count:       ${subData?.failureCount || 0}`);
    console.log(`    Last Failed At:      ${subData?.lastFailedPaymentAt?.toDate?.() || subData?.lastFailedPaymentAt || 'N/A'}`);
  } else {
    console.log('\n  ❌ NO SUBSCRIPTION DOCUMENT FOUND');
  }

  // Step 3: Check USD balance
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                   USD BALANCE');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Path: ${collectionPrefix}usd_balances/${userId}`);

  const usdDoc = await db.collection(`${collectionPrefix}usd_balances`).doc(userId).get();

  let usdData: any = null;
  if (usdDoc.exists) {
    usdData = usdDoc.data();
    console.log('\n  USD Balance Data:');
    console.log(`    Total USD Cents:       ${usdData?.totalUsdCents || 0} ($${((usdData?.totalUsdCents || 0) / 100).toFixed(2)})`);
    console.log(`    Monthly Allocation:    ${usdData?.monthlyAllocationCents || 0} ($${((usdData?.monthlyAllocationCents || 0) / 100).toFixed(2)})`);
    console.log(`    Last Allocation Date:  ${usdData?.lastAllocationDate || 'N/A'}`);
  } else {
    console.log('\n  ❌ NO USD BALANCE DOCUMENT FOUND');
  }

  // Step 4: Check Stripe data
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                   STRIPE DATA');
  console.log('════════════════════════════════════════════════════════════');

  let stripeCustomer: Stripe.Customer | null = null;
  let stripeSubscriptions: Stripe.Subscription[] = [];

  if (userData.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(userData.stripeCustomerId);
      if (customer && !('deleted' in customer && customer.deleted)) {
        stripeCustomer = customer as Stripe.Customer;
        console.log(`\n  Customer ID:   ${stripeCustomer.id}`);
        console.log(`  Email:         ${stripeCustomer.email || 'N/A'}`);
        console.log(`  Created:       ${new Date(stripeCustomer.created * 1000).toISOString()}`);
        console.log(`  Metadata UID:  ${stripeCustomer.metadata?.firebaseUID || 'NOT SET'}`);

        // Get subscriptions
        const subs = await stripe.subscriptions.list({
          customer: stripeCustomer.id,
          limit: 10,
        });

        stripeSubscriptions = subs.data;

        if (stripeSubscriptions.length > 0) {
          console.log(`\n  Subscriptions (${stripeSubscriptions.length}):`);
          for (const sub of stripeSubscriptions) {
            const amount = sub.items.data[0]?.price?.unit_amount || 0;
            console.log(`\n    [${sub.id}]`);
            console.log(`      Status:         ${sub.status}`);
            console.log(`      Amount:         $${(amount / 100).toFixed(2)}/month`);
            console.log(`      Created:        ${new Date(sub.created * 1000).toISOString()}`);
            console.log(`      Current Period: ${new Date(sub.current_period_start * 1000).toISOString()} - ${new Date(sub.current_period_end * 1000).toISOString()}`);
            console.log(`      Cancel At End:  ${sub.cancel_at_period_end}`);
            console.log(`      Metadata UID:   ${sub.metadata?.firebaseUID || 'NOT SET'}`);
          }
        } else {
          console.log('\n  ❌ NO SUBSCRIPTIONS FOUND IN STRIPE');
        }
      } else {
        console.log('\n  ❌ Stripe customer was DELETED');
      }
    } catch (error: any) {
      console.log(`\n  ❌ Error fetching Stripe data: ${error.message}`);
    }
  } else {
    console.log('\n  ⚠️  No Stripe customer ID in user document');
  }

  // Step 5: Diagnosis
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                    DIAGNOSIS');
  console.log('════════════════════════════════════════════════════════════\n');

  const issues: string[] = [];
  const fixes: Array<{ description: string; action: () => Promise<void> }> = [];

  // Check for common issues
  if (!subData) {
    issues.push('❌ No subscription document in Firestore');
    if (stripeSubscriptions.length > 0) {
      const activeSub = stripeSubscriptions.find((s) => s.status === 'active' || s.status === 'trialing');
      if (activeSub) {
        issues.push(`   But Stripe shows ACTIVE subscription: ${activeSub.id}`);
        fixes.push({
          description: 'Create subscription document from Stripe data',
          action: async () => {
            const amount = (activeSub.items.data[0]?.price?.unit_amount || 0) / 100;
            await db
              .collection(`${collectionPrefix}users`)
              .doc(userId!)
              .collection('subscriptions')
              .doc('current')
              .set({
                stripeSubscriptionId: activeSub.id,
                status: activeSub.status,
                amount,
                tier: determineTier(amount),
                currentPeriodStart: new Date(activeSub.current_period_start * 1000),
                currentPeriodEnd: new Date(activeSub.current_period_end * 1000),
                cancelAtPeriodEnd: activeSub.cancel_at_period_end,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            console.log('   ✅ Created subscription document');
          },
        });
      }
    }
  } else if (subData.status !== 'active') {
    issues.push(`❌ Subscription status is "${subData.status}" (not active)`);
    const activeSub = stripeSubscriptions.find((s) => s.status === 'active');
    if (activeSub) {
      issues.push(`   But Stripe shows ACTIVE subscription: ${activeSub.id}`);
      fixes.push({
        description: 'Update subscription status to active from Stripe',
        action: async () => {
          await db
            .collection(`${collectionPrefix}users`)
            .doc(userId!)
            .collection('subscriptions')
            .doc('current')
            .update({
              status: 'active',
              updatedAt: new Date(),
            });
          console.log('   ✅ Updated subscription status to active');
        },
      });
    }
  }

  // Check USD balance
  if (!usdData || usdData.totalUsdCents === 0) {
    const expectedAmount = subData?.amount || 0;
    if (expectedAmount > 0) {
      issues.push(`❌ USD balance is 0 but subscription amount is $${expectedAmount}`);
      fixes.push({
        description: 'Allocate USD balance based on subscription amount',
        action: async () => {
          const cents = expectedAmount * 100;
          await db.collection(`${collectionPrefix}usd_balances`).doc(userId!).set(
            {
              totalUsdCents: cents,
              monthlyAllocationCents: cents,
              lastAllocationDate: new Date().toISOString().slice(0, 7), // YYYY-MM
              updatedAt: new Date(),
            },
            { merge: true }
          );
          console.log(`   ✅ Set USD balance to ${cents} cents ($${expectedAmount})`);
        },
      });
    }
  }

  // Check Stripe metadata
  if (stripeCustomer && !stripeCustomer.metadata?.firebaseUID) {
    issues.push('⚠️  Stripe customer missing firebaseUID in metadata');
    fixes.push({
      description: 'Add firebaseUID to Stripe customer metadata',
      action: async () => {
        await stripe.customers.update(stripeCustomer!.id, {
          metadata: { firebaseUID: userId! },
        });
        console.log('   ✅ Updated Stripe customer metadata');
      },
    });
  }

  for (const sub of stripeSubscriptions) {
    if (!sub.metadata?.firebaseUID) {
      issues.push(`⚠️  Stripe subscription ${sub.id} missing firebaseUID in metadata`);
      fixes.push({
        description: `Add firebaseUID to subscription ${sub.id} metadata`,
        action: async () => {
          await stripe.subscriptions.update(sub.id, {
            metadata: { firebaseUID: userId! },
          });
          console.log(`   ✅ Updated subscription ${sub.id} metadata`);
        },
      });
    }
  }

  // Print issues
  if (issues.length === 0) {
    console.log('✅ No issues found - subscription data is consistent');
  } else {
    console.log('Issues found:\n');
    issues.forEach((issue) => console.log(`  ${issue}`));
  }

  // Apply fixes if requested
  if (shouldFix && fixes.length > 0) {
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('                  APPLYING FIXES');
    console.log('════════════════════════════════════════════════════════════\n');

    for (const fix of fixes) {
      console.log(`  → ${fix.description}`);
      try {
        await fix.action();
      } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`);
      }
    }
  } else if (fixes.length > 0) {
    console.log('\n💡 Run with --fix to apply automatic fixes');
  }

  console.log('\n════════════════════════════════════════════════════════════\n');
  process.exit(issues.length > 0 ? 1 : 0);
}

function determineTier(amount: number): string {
  if (amount >= 50) return 'tier3';
  if (amount >= 25) return 'tier2';
  if (amount >= 10) return 'tier1';
  return 'custom';
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
