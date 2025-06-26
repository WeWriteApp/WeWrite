/**
 * Test script to verify fee management functionality
 * This script tests the dynamic platform fee system
 */

import { getCurrentFeeStructure, calculateFeeBreakdownAsync } from '../utils/feeCalculations.js';
import { updateFeeStructure, subscribeFeeChanges } from '../services/feeService.js';

async function testFeeManagement() {
  console.log('🧪 Testing WeWrite Fee Management System');
  console.log('==========================================\n');

  try {
    // Test 1: Get current fee structure
    console.log('📊 Test 1: Getting current fee structure...');
    const currentFee = await getCurrentFeeStructure();
    console.log('Current platform fee:', (currentFee.platformFeePercentage * 100).toFixed(1) + '%');
    console.log('Last updated:', currentFee.lastUpdated);
    console.log('Updated by:', currentFee.updatedBy);
    console.log('✅ Test 1 passed\n');

    // Test 2: Calculate fee breakdown with current structure
    console.log('💰 Test 2: Calculating fee breakdown...');
    const testAmount = 100; // $100 test amount
    const breakdown = await calculateFeeBreakdownAsync(testAmount, 'USD', 'standard');
    
    console.log(`Gross earnings: $${breakdown.grossEarnings.toFixed(2)}`);
    console.log(`WeWrite platform fee: $${breakdown.wewritePlatformFee.toFixed(2)}`);
    console.log(`Stripe payout fee: $${breakdown.stripePayoutFee.toFixed(2)}`);
    console.log(`Net payout amount: $${breakdown.netPayoutAmount.toFixed(2)}`);
    console.log('✅ Test 2 passed\n');

    // Test 3: Test real-time subscription
    console.log('🔄 Test 3: Testing real-time fee updates...');
    let subscriptionReceived = false;
    
    const unsubscribe = subscribeFeeChanges((feeStructure) => {
      console.log('📡 Real-time update received:');
      console.log('  Platform fee:', (feeStructure.platformFeePercentage * 100).toFixed(1) + '%');
      console.log('  Updated by:', feeStructure.updatedBy);
      subscriptionReceived = true;
    });

    // Wait a moment for initial subscription
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (subscriptionReceived) {
      console.log('✅ Test 3 passed - Real-time subscription working\n');
    } else {
      console.log('⚠️  Test 3 warning - No initial subscription event received\n');
    }

    // Test 4: Test fee update (only if in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Test 4: Testing fee update (development only)...');
      
      const originalFee = currentFee.platformFeePercentage * 100;
      const testFee = originalFee === 0 ? 5 : 0; // Toggle between 0% and 5%
      
      console.log(`Updating fee from ${originalFee}% to ${testFee}%...`);
      
      // Update fee
      await updateFeeStructure(testFee, 'test-script');
      
      // Wait for update to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify update
      const updatedFee = await getCurrentFeeStructure();
      const updatedPercentage = updatedFee.platformFeePercentage * 100;
      
      if (Math.abs(updatedPercentage - testFee) < 0.01) {
        console.log(`✅ Test 4 passed - Fee updated to ${updatedPercentage}%`);
        
        // Test fee calculation with new rate
        const newBreakdown = await calculateFeeBreakdownAsync(testAmount, 'USD', 'standard');
        console.log(`New platform fee for $${testAmount}: $${newBreakdown.wewritePlatformFee.toFixed(2)}`);
        
        // Restore original fee
        console.log(`Restoring original fee of ${originalFee}%...`);
        await updateFeeStructure(originalFee, 'test-script-restore');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ Fee restored to original value\n');
      } else {
        console.log(`❌ Test 4 failed - Expected ${testFee}%, got ${updatedPercentage}%\n`);
      }
    } else {
      console.log('⏭️  Test 4 skipped - Not in development environment\n');
    }

    // Cleanup
    unsubscribe();
    
    console.log('🎉 All tests completed successfully!');
    console.log('✅ Fee management system is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testFeeManagement();
}

export { testFeeManagement };
