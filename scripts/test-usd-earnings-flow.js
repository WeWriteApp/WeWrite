#!/usr/bin/env node

/**
 * Test script to validate USD earnings flow
 * 
 * This script tests:
 * 1. USD allocation to a page
 * 2. Earnings processing for the page owner
 * 3. Earnings display in the writer dashboard
 */

const { getFirebaseAdmin } = require('../app/firebase/admin');
const { getCollectionName } = require('../app/utils/collectionNames');
const { getCurrentMonth } = require('../app/utils/dateUtils');
const { ServerUsdService } = require('../app/services/usdService.server');
const { ServerUsdEarningsService } = require('../app/services/usdEarningsService.server');

async function testUsdEarningsFlow() {
  try {
    console.log('🧪 Testing USD Earnings Flow...\n');

    // Test user IDs (use dev environment test users)
    const donorUserId = 'dev-user-1';
    const writerUserId = 'dev-user-2';
    const testPageId = 'test-page-earnings';
    const testAmount = 500; // $5.00 in cents

    console.log('📋 Test Configuration:');
    console.log(`  Donor: ${donorUserId}`);
    console.log(`  Writer: ${writerUserId}`);
    console.log(`  Page: ${testPageId}`);
    console.log(`  Amount: $${testAmount / 100}\n`);

    // Step 1: Initialize USD balance for donor
    console.log('1️⃣ Initializing USD balance for donor...');
    await ServerUsdService.updateMonthlyUsdAllocation(donorUserId, 25); // $25 subscription
    console.log('✅ USD balance initialized\n');

    // Step 2: Create test page owned by writer
    console.log('2️⃣ Creating test page...');
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    await db.collection(getCollectionName('pages')).doc(testPageId).set({
      userId: writerUserId,
      title: 'Test Page for Earnings',
      content: 'This is a test page for earnings flow validation',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Test page created\n');

    // Step 3: Get initial writer earnings
    console.log('3️⃣ Checking initial writer earnings...');
    const initialBalance = await ServerUsdEarningsService.getWriterUsdBalance(writerUserId);
    console.log('Initial writer balance:', initialBalance || 'No balance found');
    console.log('');

    // Step 4: Allocate USD to the page
    console.log('4️⃣ Allocating USD to page...');
    await ServerUsdService.allocateUsdToPage(donorUserId, testPageId, testAmount);
    console.log('✅ USD allocated to page\n');

    // Step 5: Check writer earnings after allocation
    console.log('5️⃣ Checking writer earnings after allocation...');
    const updatedBalance = await ServerUsdEarningsService.getWriterUsdBalance(writerUserId);
    console.log('Updated writer balance:', updatedBalance);

    // Check earnings for current month
    const currentMonth = getCurrentMonth();
    const earningsRef = db.collection(getCollectionName('writerUsdEarnings')).doc(`${writerUserId}_${currentMonth}`);
    const earningsDoc = await earningsRef.get();
    
    if (earningsDoc.exists) {
      console.log('Current month earnings:', earningsDoc.data());
    } else {
      console.log('❌ No earnings record found for current month');
    }
    console.log('');

    // Step 6: Test monthly processing
    console.log('6️⃣ Testing monthly earnings processing...');
    const processingResult = await ServerUsdEarningsService.processMonthlyDistribution(currentMonth);
    console.log('Processing result:', processingResult);
    console.log('');

    // Step 7: Check final writer balance
    console.log('7️⃣ Checking final writer balance...');
    const finalBalance = await ServerUsdEarningsService.getWriterUsdBalance(writerUserId);
    console.log('Final writer balance:', finalBalance);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await db.collection(getCollectionName('pages')).doc(testPageId).delete();
    console.log('✅ Test page deleted');

    console.log('\n🎉 USD Earnings Flow Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testUsdEarningsFlow()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testUsdEarningsFlow };
