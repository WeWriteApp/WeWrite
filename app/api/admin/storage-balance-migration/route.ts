/**
 * Storage Balance Migration API
 * 
 * Admin API endpoint to migrate from current fund holding model
 * to Stripe's Storage Balance system for better auditability.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { storageBalanceMigrationService } from '../../../services/storageBalanceMigrationService';
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
    const { action } = body;

    console.log(`🔧 [ADMIN] Storage Balance migration request: ${action}`);

    switch (action) {
      case 'start_migration':
        return await handleStartStorageBalanceMigration();
      
      case 'get_status':
        return await handleGetStorageBalanceMigrationStatus();
      
      case 'get_balance_breakdown':
        return await handleGetBalanceBreakdown();
      
      case 'get_post_migration_summary':
        return await handleGetPostMigrationSummary();
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: start_migration, get_status, get_balance_breakdown, get_post_migration_summary'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error in Storage Balance migration:', error);
    return NextResponse.json({
      error: 'Storage Balance migration request failed',
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

    console.log(`📊 [ADMIN] Getting Storage Balance migration status and balance breakdown`);
    
    const status = await storageBalanceMigrationService.getStorageBalanceMigrationStatus();
    const balanceBreakdown = await stripeStorageBalanceService.getBalanceBreakdown();
    const postMigrationSummary = await storageBalanceMigrationService.getPostMigrationSummary();
    
    return NextResponse.json({
      success: true,
      migrationStatus: status || {
        phase: 'not_started',
        currentStep: 'Storage Balance migration not started',
        totalSteps: 5,
        completedSteps: 0,
        errors: [],
        summary: {
          totalOutstandingObligations: 0,
          fundsMovedToStorage: 0,
          platformRevenueIdentified: 0
        }
      },
      balanceBreakdown,
      postMigrationSummary
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error getting Storage Balance migration info:', error);
    return NextResponse.json({
      error: 'Failed to get Storage Balance migration info',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleStartStorageBalanceMigration() {
  console.log(`🚀 [ADMIN] Starting Storage Balance migration`);
  
  const result = await storageBalanceMigrationService.executeStorageBalanceMigration();
  
  if (result.success) {
    return NextResponse.json({
      success: true,
      message: 'Storage Balance migration completed successfully',
      status: result.status,
      benefits: [
        'Creator obligations now clearly separated in Stripe Storage Balance',
        'Platform revenue remains in Payments Balance',
        'Better auditability and compliance',
        'Clearer fund separation in Stripe dashboard',
        'Maintains "use it or lose it" functionality'
      ]
    });
  } else {
    return NextResponse.json({
      success: false,
      error: result.error,
      status: result.status
    }, { status: 500 });
  }
}

async function handleGetStorageBalanceMigrationStatus() {
  console.log(`📊 [ADMIN] Getting Storage Balance migration status`);
  
  const status = await storageBalanceMigrationService.getStorageBalanceMigrationStatus();
  
  return NextResponse.json({
    success: true,
    status: status || {
      phase: 'not_started',
      currentStep: 'Storage Balance migration not started',
      totalSteps: 5,
      completedSteps: 0,
      errors: [],
      summary: {
        totalOutstandingObligations: 0,
        fundsMovedToStorage: 0,
        platformRevenueIdentified: 0
      }
    }
  });
}

async function handleGetBalanceBreakdown() {
  console.log(`💰 [ADMIN] Getting Stripe balance breakdown`);
  
  const balanceBreakdown = await stripeStorageBalanceService.getBalanceBreakdown();
  
  if (!balanceBreakdown) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get balance breakdown from Stripe'
    }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    balanceBreakdown,
    explanation: {
      paymentsBalance: 'Platform revenue - funds you can keep',
      storageBalance: 'Creator obligations - funds held in escrow for creators',
      totalBalance: 'Total funds in your Stripe account',
      clarity: 'Funds are now clearly separated for better auditability'
    }
  });
}

async function handleGetPostMigrationSummary() {
  console.log(`📊 [ADMIN] Getting post-migration summary`);
  
  const summary = await storageBalanceMigrationService.getPostMigrationSummary();
  
  if (!summary) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get post-migration summary'
    }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    summary,
    benefits: [
      'Clear separation of platform revenue vs creator obligations',
      'Better auditability with Stripe\'s built-in escrow system',
      'Regulatory compliance through proper fund segregation',
      'Simplified accounting and reconciliation',
      'Maintained "use it or lose it" functionality'
    ],
    stripeView: {
      paymentsBalance: `$${summary.stripeBalances.paymentsBalance.toFixed(2)} - Your platform revenue`,
      storageBalance: `$${summary.stripeBalances.storageBalance.toFixed(2)} - Creator obligations (escrowed)`,
      totalBalance: `$${summary.stripeBalances.totalBalance.toFixed(2)} - Total account balance`
    }
  });
}
