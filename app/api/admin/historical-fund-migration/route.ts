/**
 * Historical Fund Migration API
 * 
 * One-time API to migrate existing funds from Payments Balance to Storage Balance
 * based on actual current earnings obligations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { historicalFundMigrationService } from '../../../services/historicalFundMigrationService';
import { stripeStorageBalanceService } from '../../../services/stripeStorageBalanceService';
import { isAdminUser } from '../../../utils/adminUtils';
import { formatUsdCents } from '../../../utils/formatCurrency';

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
    const { action, confirm } = body;

    console.log(`🔄 [ADMIN] Historical fund migration request: ${action}`);

    switch (action) {
      case 'execute_historical_migration':
        if (!confirm) {
          return NextResponse.json({
            error: 'Historical migration confirmation required. Set confirm: true to proceed.',
            warning: 'This is a one-time operation that will move funds from Payments Balance to Storage Balance based on actual earnings obligations.'
          }, { status: 400 });
        }
        return await handleExecuteHistoricalMigration();
      
      case 'get_migration_status':
        return await handleGetMigrationStatus();
      
      case 'preview_migration':
        return await handlePreviewMigration();
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: execute_historical_migration, get_migration_status, preview_migration'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error in historical fund migration:', error);
    return NextResponse.json({
      error: 'Historical fund migration request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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

    console.log(`📊 [ADMIN] Getting historical migration status`);
    
    const migrationStatus = await historicalFundMigrationService.getHistoricalMigrationStatus();
    const currentBalance = await stripeStorageBalanceService.getBalanceBreakdown();
    
    return NextResponse.json({
      success: true,
      migrationStatus,
      currentBalance,
      explanation: {
        purpose: 'One-time migration to move existing creator obligations from Payments Balance to Storage Balance',
        timing: 'Should be done once after Storage Balance system activation',
        future: 'After this migration, all funds will automatically flow to correct balances'
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error getting historical migration status:', error);
    return NextResponse.json({
      error: 'Failed to get historical migration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleExecuteHistoricalMigration() {
  console.log(`🚀 [ADMIN] EXECUTING HISTORICAL FUND MIGRATION`);
  
  const result = await historicalFundMigrationService.executeHistoricalMigration();
  
  if (result.success) {
    return NextResponse.json({
      success: true,
      message: '🎉 HISTORICAL MIGRATION COMPLETED SUCCESSFULLY! 🎉',
      result,
      summary: {
        title: 'Historical Fund Migration Complete',
        fundsMovedToStorage: formatUsdCents(result.migration.fundsMovedToStorage * 100),
        totalOutstandingEarnings: formatUsdCents(result.migration.totalOutstandingEarnings * 100),
        remainingInPayments: formatUsdCents(result.migration.remainingInPayments * 100)
      },
      balanceBreakdown: {
        before: {
          paymentsBalance: formatUsdCents(result.balanceBreakdown.before.paymentsBalance * 100),
          storageBalance: formatUsdCents(result.balanceBreakdown.before.storageBalance * 100)
        },
        after: {
          paymentsBalance: formatUsdCents(result.balanceBreakdown.after.paymentsBalance * 100),
          storageBalance: formatUsdCents(result.balanceBreakdown.after.storageBalance * 100)
        }
      },
      validation: result.validation,
      nextSteps: [
        'Monitor Stripe dashboard - Storage Balance now properly reflects creator obligations',
        'Monitor Stripe dashboard - Payments Balance now contains only platform revenue',
        'Future allocations will automatically go to Storage Balance',
        'Month-end processing will move unallocated funds back to Payments Balance',
        'No further manual migration needed - system is now fully automated'
      ]
    });
  } else {
    return NextResponse.json({
      success: false,
      message: 'Historical migration encountered issues',
      result,
      troubleshooting: {
        title: 'Migration Issues',
        error: result.error,
        possibleCauses: [
          'Insufficient funds in Payments Balance',
          'Stripe API connectivity issues',
          'Outstanding earnings calculation error'
        ],
        nextSteps: [
          'Check Stripe dashboard for current balance',
          'Verify outstanding earnings calculation',
          'Retry migration after resolving issues'
        ]
      }
    }, { status: 500 });
  }
}

async function handleGetMigrationStatus() {
  console.log(`📊 [ADMIN] Getting detailed migration status`);
  
  const migrationStatus = await historicalFundMigrationService.getHistoricalMigrationStatus();
  const currentBalance = await stripeStorageBalanceService.getBalanceBreakdown();
  
  if (!currentBalance) {
    return NextResponse.json({
      success: false,
      error: 'Unable to get current balance breakdown from Stripe'
    }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    migrationStatus,
    currentBalance: {
      paymentsBalance: formatUsdCents(currentBalance.paymentsBalance * 100),
      storageBalance: formatUsdCents(currentBalance.storageBalance * 100),
      totalBalance: formatUsdCents(currentBalance.totalBalance * 100)
    },
    analysis: {
      migrationNeeded: migrationStatus.migrationNeeded,
      reason: migrationStatus.reason,
      fundsToMove: formatUsdCents(migrationStatus.fundsToMove * 100),
      currentOutstandingEarnings: formatUsdCents(migrationStatus.currentOutstandingEarnings * 100)
    },
    recommendation: migrationStatus.migrationNeeded 
      ? 'Execute historical migration to properly separate funds'
      : 'No migration needed - funds are already properly separated'
  });
}

async function handlePreviewMigration() {
  console.log(`👁️ [ADMIN] Previewing historical migration`);
  
  const migrationStatus = await historicalFundMigrationService.getHistoricalMigrationStatus();
  const currentBalance = await stripeStorageBalanceService.getBalanceBreakdown();
  
  if (!currentBalance) {
    return NextResponse.json({
      success: false,
      error: 'Unable to get current balance for preview'
    }, { status: 500 });
  }
  
  const previewResult = {
    currentState: {
      paymentsBalance: formatUsdCents(currentBalance.paymentsBalance * 100),
      storageBalance: formatUsdCents(currentBalance.storageBalance * 100),
      fundSeparation: 'Mixed funds in Payments Balance'
    },
    proposedMigration: {
      fundsToMove: formatUsdCents(migrationStatus.fundsToMove * 100),
      reason: migrationStatus.reason,
      migrationNeeded: migrationStatus.migrationNeeded
    },
    postMigrationState: {
      paymentsBalance: formatUsdCents((currentBalance.paymentsBalance - migrationStatus.fundsToMove) * 100),
      storageBalance: formatUsdCents((currentBalance.storageBalance + migrationStatus.fundsToMove) * 100),
      fundSeparation: 'Perfect separation - Storage Balance = creator obligations, Payments Balance = platform revenue'
    },
    benefits: [
      'Perfect fund separation in Stripe dashboard',
      'Storage Balance will properly reflect creator obligations',
      'Payments Balance will contain only platform revenue',
      'Enhanced auditability and regulatory compliance',
      'Future allocations will automatically maintain separation'
    ]
  };
  
  return NextResponse.json({
    success: true,
    preview: previewResult,
    readyToExecute: migrationStatus.migrationNeeded,
    warning: migrationStatus.migrationNeeded 
      ? 'This will move funds from Payments Balance to Storage Balance. This is a one-time operation.'
      : 'No migration needed - funds are already properly separated.'
  });
}
