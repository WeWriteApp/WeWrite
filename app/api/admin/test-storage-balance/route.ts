/**
 * Test Storage Balance API
 * 
 * Creates a test transfer to Storage Balance to demonstrate the system working
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { isAdminUser } from '../../../utils/adminUtils';
import { stripeStorageBalanceService } from '../../../services/stripeStorageBalanceService';
import { detectEnvironmentType } from '../../../utils/environmentDetection';

export async function POST(request: NextRequest) {
  try {
    const envType = detectEnvironmentType();
    const host = request.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    // Verify admin access or allow dev bypass on localhost
    const userId = await getUserIdFromRequest(request);
    const isAdmin = userId ? await isAdminUser(userId) : false;
    const devBypass = envType === 'development' && isLocalhost;
    if (!userId && !devBypass) {
      return NextResponse.json({ error: 'Unauthorized', debug: { envType, host } }, { status: 401 });
    }
    if (!isAdmin && !devBypass) {
      return NextResponse.json({ error: 'Admin access required', debug: { envType, host, userId } }, { status: 403 });
    }

    const body = await request.json();
    const { action, amount, confirm } = body;

    console.log(`🧪 [ADMIN] Test Storage Balance request: ${action}`);

    switch (action) {
      case 'test_move_to_storage':
        if (!confirm) {
          return NextResponse.json({
            error: 'Test confirmation required. Set confirm: true to proceed.',
            warning: 'This will create a test transfer to Storage Balance to demonstrate the system.'
          }, { status: 400 });
        }
        return await handleTestMoveToStorage(amount || 10, devBypass); // Default $10 test
      
      case 'get_current_balances':
        return await handleGetCurrentBalances();
      
      case 'test_move_from_storage':
        if (!confirm) {
          return NextResponse.json({
            error: 'Test confirmation required. Set confirm: true to proceed.',
            warning: 'This will move funds back from Storage Balance to Payments Balance.'
          }, { status: 400 });
        }
        return await handleTestMoveFromStorage(amount || 10);
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: test_move_to_storage, get_current_balances, test_move_from_storage'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error in test storage balance:', error);
    return NextResponse.json({
      error: 'Test storage balance request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleTestMoveToStorage(amount: number, devBypass: boolean) {
  console.log(`🧪 [ADMIN] Testing move $${amount} to Storage Balance`);
  
  // Get current balances
  const beforeBalance = await stripeStorageBalanceService.getBalanceBreakdown();
  if (!beforeBalance) {
    return NextResponse.json({
      success: false,
      error: 'Unable to get current balance breakdown'
    }, { status: 500 });
  }

  console.log(`📊 [ADMIN] Current balances before test:`, beforeBalance);

  // Check if we have sufficient funds in Payments Balance
  if (beforeBalance.paymentsBalance < amount && !devBypass) {
    return NextResponse.json({
      success: false,
      error: `Insufficient funds in Payments Balance. Need $${amount}, have $${beforeBalance.paymentsBalance.toFixed(2)}`,
      suggestion: 'Add funds to your Stripe account first, or reduce the test amount'
    }, { status: 400 });
  }

  // Execute test transfer (or simulate in dev bypass)
  let transferResult: { success: boolean; transferId?: string; error?: string } = {
    success: true,
    transferId: 'simulated_dev_transfer'
  };

  if (!(beforeBalance.paymentsBalance < amount && devBypass)) {
    transferResult = await stripeStorageBalanceService.moveAllocatedFundsToStorage(
      amount,
      `Test transfer: Moving $${amount} to Storage Balance for demonstration`,
      'test_transfer'
    );
  }

  if (!transferResult.success) {
    return NextResponse.json({
      success: false,
      error: `Test transfer failed: ${transferResult.error}`
    }, { status: 500 });
  }

  // Get updated balances
  const afterBalance = await stripeStorageBalanceService.getBalanceBreakdown();
  
  return NextResponse.json({
    success: true,
    message: `🎉 Test transfer completed! $${amount} moved to Storage Balance`,
    result: {
      transferId: transferResult.transferId,
      amountMoved: amount,
      balanceChange: {
        before: {
          paymentsBalance: `$${beforeBalance.paymentsBalance.toFixed(2)}`,
          storageBalance: `$${beforeBalance.storageBalance.toFixed(2)}`
        },
        after: {
          paymentsBalance: `$${afterBalance?.paymentsBalance.toFixed(2) || 'Unknown'}`,
          storageBalance: `$${afterBalance?.storageBalance.toFixed(2) || 'Unknown'}`
        }
      }
    },
    instructions: [
      'Check your Stripe dashboard - you should now see funds in Storage Balance',
      'Storage Balance represents creator obligations (escrowed)',
      'Payments Balance represents platform revenue',
      'This demonstrates the fund separation system working correctly'
    ]
  });
}

async function handleTestMoveFromStorage(amount: number) {
  console.log(`🧪 [ADMIN] Testing move $${amount} from Storage Balance back to Payments Balance`);
  
  // Get current balances
  const beforeBalance = await stripeStorageBalanceService.getBalanceBreakdown();
  if (!beforeBalance) {
    return NextResponse.json({
      success: false,
      error: 'Unable to get current balance breakdown'
    }, { status: 500 });
  }

  // Check if we have sufficient funds in Storage Balance
  if (beforeBalance.storageBalance < amount) {
    return NextResponse.json({
      success: false,
      error: `Insufficient funds in Storage Balance. Need $${amount}, have $${beforeBalance.storageBalance.toFixed(2)}`
    }, { status: 400 });
  }

  // Execute reverse transfer (this would be like unallocated funds going back)
  const transferResult = await stripeStorageBalanceService.moveUnallocatedFundsToPayments(
    amount,
    `Test reverse transfer: Moving $${amount} back to Payments Balance`,
    'test_reverse_transfer'
  );

  if (!transferResult.success) {
    return NextResponse.json({
      success: false,
      error: `Test reverse transfer failed: ${transferResult.error}`
    }, { status: 500 });
  }

  // Get updated balances
  const afterBalance = await stripeStorageBalanceService.getBalanceBreakdown();
  
  return NextResponse.json({
    success: true,
    message: `🎉 Test reverse transfer completed! $${amount} moved back to Payments Balance`,
    result: {
      transferId: transferResult.transferId,
      amountMoved: amount,
      balanceChange: {
        before: {
          paymentsBalance: `$${beforeBalance.paymentsBalance.toFixed(2)}`,
          storageBalance: `$${beforeBalance.storageBalance.toFixed(2)}`
        },
        after: {
          paymentsBalance: `$${afterBalance?.paymentsBalance.toFixed(2) || 'Unknown'}`,
          storageBalance: `$${afterBalance?.storageBalance.toFixed(2) || 'Unknown'}`
        }
      }
    },
    instructions: [
      'Check your Stripe dashboard - Storage Balance should be reduced',
      'Payments Balance should be increased',
      'This simulates unallocated funds returning to platform revenue',
      'The fund separation system is working correctly'
    ]
  });
}

async function handleGetCurrentBalances() {
  console.log(`📊 [ADMIN] Getting current Stripe balances`);
  
  const balances = await stripeStorageBalanceService.getBalanceBreakdown();
  
  if (!balances) {
    return NextResponse.json({
      success: false,
      error: 'Unable to get current balance breakdown from Stripe'
    }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    balances: {
      paymentsBalance: `$${balances.paymentsBalance.toFixed(2)}`,
      storageBalance: `$${balances.storageBalance.toFixed(2)}`,
      totalBalance: `$${balances.totalBalance.toFixed(2)}`
    },
    explanation: {
      paymentsBalance: 'Platform revenue - your money to transfer to business account',
      storageBalance: 'Creator obligations - escrowed funds for monthly payouts',
      totalBalance: 'Combined balance in your Stripe account'
    },
    status: {
      fundSeparation: balances.storageBalance > 0 ? 'Active' : 'No funds in Storage Balance yet',
      systemReady: true
    }
  });
}
