/**
 * System Testing API
 * 
 * Admin API endpoint to test all components of the new fund holding model.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { isAdminUser } from '../../../utils/adminUtils';
import { fundTrackingService } from '../../../services/fundTrackingService';
import { earningsCalculationEngine } from '../../../services/earningsCalculationEngine';
import { monthlyAllocationLockService } from '../../../services/monthlyAllocationLockService';
import { useItOrLoseItService } from '../../../services/useItOrLoseItService';
import { platformRevenueService } from '../../../services/platformRevenueService';
import { balanceMonitoringService } from '../../../services/balanceMonitoringService';

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    console.log(`🧪 [ADMIN] System test request: ${action}`);

    switch (action) {
      case 'test_fund_tracking':
        return await testFundTracking();
      
      case 'test_earnings_calculation':
        return await testEarningsCalculation();
      
      case 'test_allocation_locking':
        return await testAllocationLocking();
      
      case 'test_use_it_or_lose_it':
        return await testUseItOrLoseIt();
      
      case 'test_platform_revenue':
        return await testPlatformRevenue();
      
      case 'test_balance_monitoring':
        return await testBalanceMonitoring();
      
      case 'test_all_systems':
        return await testAllSystems();
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: test_fund_tracking, test_earnings_calculation, test_allocation_locking, test_use_it_or_lose_it, test_platform_revenue, test_balance_monitoring, test_all_systems'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error in system testing:', error);
    return NextResponse.json({
      error: 'System test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function testFundTracking() {
  try {
    console.log(`🧪 [TEST] Testing fund tracking service`);
    
    const testUserId = 'test-user-' + Date.now();
    const testMonth = new Date().toISOString().slice(0, 7);
    
    // Test recording subscription payment
    const paymentResult = await fundTrackingService.recordSubscriptionPayment(
      testUserId,
      10.00, // $10 subscription
      'test-subscription-id',
      testMonth,
      'test'
    );
    
    // Test recording allocation
    const allocationResult = await fundTrackingService.recordAllocation(
      testUserId,
      5.00, // $5 allocation
      'test-page-id',
      undefined,
      testMonth
    );
    
    // Test getting fund tracking
    const fundTracking = await fundTrackingService.getUserFundTracking(testUserId, testMonth);
    
    return NextResponse.json({
      success: true,
      test: 'fund_tracking',
      results: {
        paymentRecorded: paymentResult.success,
        allocationRecorded: allocationResult.success,
        fundTrackingRetrieved: !!fundTracking,
        fundTrackingData: fundTracking
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'fund_tracking',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function testEarningsCalculation() {
  try {
    console.log(`🧪 [TEST] Testing earnings calculation engine`);
    
    const testMonth = new Date().toISOString().slice(0, 7);
    
    // Test calculating monthly earnings
    const earningsResult = await earningsCalculationEngine.calculateMonthlyEarnings(testMonth);
    
    return NextResponse.json({
      success: earningsResult.success,
      test: 'earnings_calculation',
      results: {
        calculationSuccessful: earningsResult.success,
        report: earningsResult.report,
        error: earningsResult.error
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'earnings_calculation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function testAllocationLocking() {
  try {
    console.log(`🧪 [TEST] Testing allocation locking service`);
    
    const testMonth = new Date().toISOString().slice(0, 7);
    
    // Test locking allocations
    const lockResult = await monthlyAllocationLockService.lockMonthlyAllocations(testMonth, 'manual');
    
    // Test getting lock status
    const lockStatus = await monthlyAllocationLockService.getAllocationLockStatus(testMonth);
    
    return NextResponse.json({
      success: lockResult.success,
      test: 'allocation_locking',
      results: {
        lockingSuccessful: lockResult.success,
        lockStatus: lockResult.lockStatus,
        statusRetrieved: !!lockStatus,
        error: lockResult.error
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'allocation_locking',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function testUseItOrLoseIt() {
  try {
    console.log(`🧪 [TEST] Testing use it or lose it service`);
    
    const testMonth = new Date().toISOString().slice(0, 7);
    
    // Test processing unallocated funds
    const unallocatedResult = await useItOrLoseItService.processUnallocatedFunds(testMonth);
    
    return NextResponse.json({
      success: unallocatedResult.success,
      test: 'use_it_or_lose_it',
      results: {
        processingSuccessful: unallocatedResult.success,
        report: unallocatedResult.report,
        error: unallocatedResult.error
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'use_it_or_lose_it',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function testPlatformRevenue() {
  try {
    console.log(`🧪 [TEST] Testing platform revenue service`);
    
    const testMonth = new Date().toISOString().slice(0, 7);
    
    // Test calculating platform revenue
    const revenueResult = await platformRevenueService.calculatePlatformRevenue(testMonth);
    
    return NextResponse.json({
      success: revenueResult.success,
      test: 'platform_revenue',
      results: {
        calculationSuccessful: revenueResult.success,
        report: revenueResult.report,
        error: revenueResult.error
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'platform_revenue',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function testBalanceMonitoring() {
  try {
    console.log(`🧪 [TEST] Testing balance monitoring service`);
    
    // Test generating balance report
    const balanceReport = await balanceMonitoringService.generateBalanceReport();
    
    // Test checking balance urgency
    const urgencyCheck = await balanceMonitoringService.checkBalanceUrgency();
    
    return NextResponse.json({
      success: true,
      test: 'balance_monitoring',
      results: {
        reportGenerated: !!balanceReport,
        balanceReport: balanceReport,
        urgencyCheck: urgencyCheck
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'balance_monitoring',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function testAllSystems() {
  try {
    console.log(`🧪 [TEST] Testing all systems`);
    
    const results = {
      fundTracking: await testFundTracking().then(r => r.json()),
      earningsCalculation: await testEarningsCalculation().then(r => r.json()),
      allocationLocking: await testAllocationLocking().then(r => r.json()),
      useItOrLoseIt: await testUseItOrLoseIt().then(r => r.json()),
      platformRevenue: await testPlatformRevenue().then(r => r.json()),
      balanceMonitoring: await testBalanceMonitoring().then(r => r.json())
    };
    
    const allSuccessful = Object.values(results).every((result: any) => result.success);
    
    return NextResponse.json({
      success: allSuccessful,
      test: 'all_systems',
      results: results,
      summary: {
        totalTests: Object.keys(results).length,
        passedTests: Object.values(results).filter((result: any) => result.success).length,
        failedTests: Object.values(results).filter((result: any) => !result.success).length
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'all_systems',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
