#!/usr/bin/env node
/**
 * Verify Earnings vs Stripe Balance Script
 * 
 * This script compares:
 * 1. Total `availableUsdCents` in writerUsdBalances (what writers can withdraw)
 * 2. Stripe Storage Balance (what's actually escrowed for writers)
 * 
 * They should match. If they don't, there's a discrepancy.
 * 
 * Usage:
 *   node scripts/verify-earnings-vs-stripe.js
 * 
 * Requirements:
 *   - STRIPE_SECRET_KEY environment variable
 *   - Firebase Admin SDK credentials
 */

const admin = require('firebase-admin');
const Stripe = require('stripe');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20'
});

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (e) {
  console.error('❌ Could not load service account file:', serviceAccountPath);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Environment-aware collection names
const ENV_PREFIX = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production' ? '' : 'dev_';
const COLLECTIONS = {
  WRITER_USD_BALANCES: `${ENV_PREFIX}writerUsdBalances`,
  WRITER_USD_EARNINGS: `${ENV_PREFIX}writerUsdEarnings`,
  USD_ALLOCATIONS: `${ENV_PREFIX}usdAllocations`
};

async function getStripeStorageBalance() {
  try {
    const balance = await stripe.balance.retrieve();
    
    // Storage balance is in the "pending" array with "source_types" 
    // or may be separate. Let's check all balance types.
    console.log('\n📊 Stripe Balance Details:');
    console.log('═══════════════════════════════════════');
    
    // Available balances
    console.log('\n💵 Available:');
    for (const bal of balance.available) {
      console.log(`   ${bal.currency.toUpperCase()}: $${(bal.amount / 100).toFixed(2)}`);
    }
    
    // Pending balances
    if (balance.pending && balance.pending.length > 0) {
      console.log('\n⏳ Pending:');
      for (const bal of balance.pending) {
        console.log(`   ${bal.currency.toUpperCase()}: $${(bal.amount / 100).toFixed(2)}`);
      }
    }
    
    // Connect reserved (if any)
    if (balance.connect_reserved && balance.connect_reserved.length > 0) {
      console.log('\n🔒 Connect Reserved:');
      for (const bal of balance.connect_reserved) {
        console.log(`   ${bal.currency.toUpperCase()}: $${(bal.amount / 100).toFixed(2)}`);
      }
    }
    
    // Instant available (if any)
    if (balance.instant_available && balance.instant_available.length > 0) {
      console.log('\n⚡ Instant Available:');
      for (const bal of balance.instant_available) {
        console.log(`   ${bal.currency.toUpperCase()}: $${(bal.amount / 100).toFixed(2)}`);
      }
    }

    // Calculate total available in USD
    const usdAvailable = balance.available.find(b => b.currency === 'usd');
    return {
      availableUsdCents: usdAvailable?.amount || 0,
      fullBalance: balance
    };
  } catch (error) {
    console.error('❌ Error getting Stripe balance:', error.message);
    return null;
  }
}

async function getFirestoreWriterBalances() {
  try {
    const snapshot = await db.collection(COLLECTIONS.WRITER_USD_BALANCES).get();
    
    let totalAvailableCents = 0;
    let totalPendingCents = 0;
    let totalPaidOutCents = 0;
    let totalEarnedCents = 0;
    
    const writerDetails = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const available = data.availableUsdCents || 0;
      const pending = data.pendingUsdCents || 0;
      const paidOut = data.paidOutUsdCents || 0;
      const earned = data.totalUsdCentsEarned || 0;
      
      totalAvailableCents += available;
      totalPendingCents += pending;
      totalPaidOutCents += paidOut;
      totalEarnedCents += earned;
      
      if (available > 0 || pending > 0) {
        writerDetails.push({
          id: doc.id.substring(0, 8) + '...',
          available: (available / 100).toFixed(2),
          pending: (pending / 100).toFixed(2),
          paidOut: (paidOut / 100).toFixed(2),
          earned: (earned / 100).toFixed(2)
        });
      }
    });
    
    console.log(`\n📝 Firestore Writer Balances (${COLLECTIONS.WRITER_USD_BALANCES}):`);
    console.log('═══════════════════════════════════════');
    console.log(`   Total Writers: ${snapshot.size}`);
    console.log(`   Total Earned: $${(totalEarnedCents / 100).toFixed(2)}`);
    console.log(`   Total Available (ready for payout): $${(totalAvailableCents / 100).toFixed(2)}`);
    console.log(`   Total Pending (current month): $${(totalPendingCents / 100).toFixed(2)}`);
    console.log(`   Total Paid Out: $${(totalPaidOutCents / 100).toFixed(2)}`);
    
    if (writerDetails.length > 0) {
      console.log('\n   Writers with balances:');
      writerDetails.slice(0, 10).forEach(w => {
        console.log(`     ${w.id}: Available=$${w.available}, Pending=$${w.pending}`);
      });
      if (writerDetails.length > 10) {
        console.log(`     ... and ${writerDetails.length - 10} more`);
      }
    }
    
    return {
      totalAvailableCents,
      totalPendingCents,
      totalPaidOutCents,
      totalEarnedCents,
      writerCount: snapshot.size
    };
  } catch (error) {
    console.error('❌ Error getting Firestore balances:', error.message);
    return null;
  }
}

async function getEarningsStatus() {
  try {
    const snapshot = await db.collection(COLLECTIONS.WRITER_USD_EARNINGS).get();
    
    let pendingCount = 0;
    let availableCount = 0;
    let paidOutCount = 0;
    let pendingCents = 0;
    let availableCents = 0;
    let paidOutCents = 0;
    
    const monthlyBreakdown = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const month = data.month || 'unknown';
      const status = data.status || 'unknown';
      const cents = data.totalUsdCentsReceived || 0;
      
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = { pending: 0, available: 0, paid_out: 0 };
      }
      
      switch (status) {
        case 'pending':
          pendingCount++;
          pendingCents += cents;
          monthlyBreakdown[month].pending += cents;
          break;
        case 'available':
          availableCount++;
          availableCents += cents;
          monthlyBreakdown[month].available += cents;
          break;
        case 'paid_out':
          paidOutCount++;
          paidOutCents += cents;
          monthlyBreakdown[month].paid_out += cents;
          break;
      }
    });
    
    console.log(`\n📈 Writer USD Earnings Status (${COLLECTIONS.WRITER_USD_EARNINGS}):`);
    console.log('═══════════════════════════════════════');
    console.log(`   Total Records: ${snapshot.size}`);
    console.log(`   Pending: ${pendingCount} records = $${(pendingCents / 100).toFixed(2)}`);
    console.log(`   Available: ${availableCount} records = $${(availableCents / 100).toFixed(2)}`);
    console.log(`   Paid Out: ${paidOutCount} records = $${(paidOutCents / 100).toFixed(2)}`);
    
    console.log('\n   Monthly Breakdown:');
    Object.keys(monthlyBreakdown).sort().forEach(month => {
      const m = monthlyBreakdown[month];
      console.log(`     ${month}: Pending=$${(m.pending / 100).toFixed(2)}, Available=$${(m.available / 100).toFixed(2)}, PaidOut=$${(m.paid_out / 100).toFixed(2)}`);
    });
    
    return {
      pendingCents,
      availableCents,
      paidOutCents,
      monthlyBreakdown
    };
  } catch (error) {
    console.error('❌ Error getting earnings status:', error.message);
    return null;
  }
}

async function main() {
  console.log('\n🔍 WeWrite Earnings vs Stripe Verification');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Environment: ${process.env.NEXT_PUBLIC_ENVIRONMENT || 'development'}`);
  console.log(`Collections prefix: ${ENV_PREFIX || '(none - production)'}`);
  
  const stripeBalance = await getStripeStorageBalance();
  const firestoreBalances = await getFirestoreWriterBalances();
  const earningsStatus = await getEarningsStatus();
  
  // Summary comparison
  console.log('\n\n📋 VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (stripeBalance && firestoreBalances) {
    const stripeAvailable = stripeBalance.availableUsdCents;
    const firestoreAvailable = firestoreBalances.totalAvailableCents;
    const firestorePending = firestoreBalances.totalPendingCents;
    const totalOwed = firestoreAvailable + firestorePending;
    
    console.log('\n💰 Stripe Platform Balance:');
    console.log(`   Available: $${(stripeAvailable / 100).toFixed(2)}`);
    
    console.log('\n📝 Firestore Writer Obligations:');
    console.log(`   Available for payout: $${(firestoreAvailable / 100).toFixed(2)}`);
    console.log(`   Pending (current month): $${(firestorePending / 100).toFixed(2)}`);
    console.log(`   Total owed to writers: $${(totalOwed / 100).toFixed(2)}`);
    
    // Check if Stripe has enough to cover writer payouts
    console.log('\n⚖️ Coverage Analysis:');
    if (stripeAvailable >= firestoreAvailable) {
      console.log(`   ✅ Stripe has enough to cover available payouts`);
      console.log(`   Surplus: $${((stripeAvailable - firestoreAvailable) / 100).toFixed(2)}`);
    } else {
      console.log(`   ❌ SHORTFALL! Stripe doesn't have enough for available payouts`);
      console.log(`   Shortfall: $${((firestoreAvailable - stripeAvailable) / 100).toFixed(2)}`);
    }
    
    if (stripeAvailable >= totalOwed) {
      console.log(`   ✅ Stripe has enough to cover ALL owed (available + pending)`);
    } else {
      console.log(`   ⚠️ Stripe balance doesn't cover pending earnings yet (normal mid-month)`);
    }
  }
  
  // Recommendations
  console.log('\n\n📌 RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (earningsStatus && earningsStatus.pendingCents > 0) {
    console.log(`⚠️ There are $${(earningsStatus.pendingCents / 100).toFixed(2)} in PENDING earnings.`);
    console.log('   These will become available after monthly processing (1st of month).');
    console.log('   If this is unexpected, run the fix-stuck-pending-earnings.js script.');
  }
  
  console.log('\n✅ Verification complete!\n');
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
