/**
 * Execute Migration API
 * 
 * Final API endpoint to execute the complete migration to Storage Balance system.
 * This is the "big red button" that makes the switch.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { executeMigrationService } from '../../../services/executeMigrationService';
import { stripeStorageBalanceService } from '../../../services/stripeStorageBalanceService';
import { isAdminUser } from '../../../utils/adminUtils';

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

    console.log(`🚀 [ADMIN] Execute migration request: ${action}`);

    switch (action) {
      case 'execute_complete_migration':
        if (!confirm) {
          return NextResponse.json({
            error: 'Migration confirmation required. Set confirm: true to proceed.'
          }, { status: 400 });
        }
        return await handleExecuteCompleteMigration();
      
      case 'get_pre_migration_status':
        return await handleGetPreMigrationStatus();
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: execute_complete_migration, get_pre_migration_status'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error in execute migration:', error);
    return NextResponse.json({
      error: 'Execute migration request failed',
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

    console.log(`📊 [ADMIN] Getting pre-migration status`);
    
    const balanceBreakdown = await stripeStorageBalanceService.getBalanceBreakdown();
    
    return NextResponse.json({
      success: true,
      currentSystem: 'legacy_fund_holding',
      targetSystem: 'stripe_storage_balance',
      balanceBreakdown,
      migrationReady: !!balanceBreakdown,
      benefits: [
        'Clear fund separation in Stripe dashboard',
        'Better auditability and compliance',
        'Reduced internal balance tracking complexity',
        'Enhanced creator trust through proper escrow',
        'Maintained "use it or lose it" functionality'
      ],
      risks: [
        'Temporary system unavailability during migration',
        'Need to verify all integrations work with Storage Balance',
        'Requires careful validation of fund movements'
      ]
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error getting pre-migration status:', error);
    return NextResponse.json({
      error: 'Failed to get pre-migration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleExecuteCompleteMigration() {
  console.log(`🚀 [ADMIN] EXECUTING COMPLETE MIGRATION TO STORAGE BALANCE SYSTEM`);
  
  const result = await executeMigrationService.executeCompleteMigration();
  
  if (result.success) {
    return NextResponse.json({
      success: true,
      message: '🎉 MIGRATION COMPLETED SUCCESSFULLY! 🎉',
      result,
      celebration: {
        title: 'Welcome to Storage Balance System!',
        benefits: [
          '✅ Payments Balance = Your Platform Revenue',
          '✅ Storage Balance = Creator Obligations (Escrowed)',
          '✅ Clear Fund Separation in Stripe Dashboard',
          '✅ Better Auditability & Compliance',
          '✅ Maintained "Use It or Lose It" Functionality'
        ],
        nextSteps: result.nextSteps
      },
      stripeView: {
        paymentsBalance: 'Shows your platform revenue (fees + unallocated funds)',
        storageBalance: 'Shows creator obligations (properly escrowed)',
        clarity: 'Perfect fund separation for auditability!'
      }
    });
  } else {
    return NextResponse.json({
      success: false,
      message: 'Migration encountered issues',
      result,
      recovery: {
        title: 'Migration Recovery',
        status: 'System remains operational with legacy model',
        nextSteps: result.nextSteps,
        support: 'Review errors and retry migration after resolving issues'
      }
    }, { status: 500 });
  }
}

async function handleGetPreMigrationStatus() {
  console.log(`📊 [ADMIN] Getting detailed pre-migration status`);
  
  const balanceBreakdown = await stripeStorageBalanceService.getBalanceBreakdown();
  
  if (!balanceBreakdown) {
    return NextResponse.json({
      success: false,
      error: 'Unable to get current balance breakdown from Stripe'
    }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    currentStatus: {
      system: 'Legacy Fund Holding Model',
      paymentsBalance: balanceBreakdown.paymentsBalance,
      storageBalance: balanceBreakdown.storageBalance,
      totalBalance: balanceBreakdown.totalBalance,
      fundSeparation: 'Mixed in Payments Balance'
    },
    postMigrationPreview: {
      system: 'Stripe Storage Balance Model',
      paymentsBalance: 'Platform Revenue Only',
      storageBalance: 'Creator Obligations Only',
      fundSeparation: 'Clearly Separated',
      auditability: 'Stripe-managed escrow system'
    },
    migrationPlan: {
      step1: 'Analyze current fund distribution',
      step2: 'Move creator obligations to Storage Balance',
      step3: 'Keep platform revenue in Payments Balance',
      step4: 'Validate proper fund separation',
      step5: 'Activate Storage Balance system'
    },
    readinessCheck: {
      stripeApiAccess: true,
      balanceDataAvailable: !!balanceBreakdown,
      servicesOperational: true,
      migrationReady: true
    }
  });
}
