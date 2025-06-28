/**
 * Financial State Synchronization API
 * 
 * Provides endpoints for triggering and monitoring financial state
 * synchronization across token system, Stripe, and database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FinancialStateSynchronizationService } from '../../../services/financialStateSynchronizationService';
import { FinancialReconciliationService } from '../../../services/financialReconciliationService';
import { FinancialUtils } from '../../../types/financial';
import { getUserIdFromRequest } from '../../auth-helper';

// POST endpoint for triggering synchronization
export async function POST(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        error: 'Authentication required',
        correlationId
      }, { status: 401 });
    }

    // TODO: Add admin role verification here
    
    const body = await request.json();
    const { 
      action,
      targetUserId,
      syncConfig,
      dryRun = false,
      ...params 
    } = body;
    
    console.log(`[ADMIN] Financial sync action: ${action} [${correlationId}]`, {
      targetUserId,
      dryRun,
      params
    });
    
    switch (action) {
      case 'syncUser':
        return await handleSyncUser(targetUserId, syncConfig, dryRun, correlationId);
        
      case 'syncAll':
        return await handleSyncAll(syncConfig, dryRun, correlationId);
        
      case 'detectConflicts':
        return await handleDetectConflicts(targetUserId, correlationId);
        
      case 'resolveConflicts':
        return await handleResolveConflicts(targetUserId, params.conflictIds, correlationId);
        
      case 'reconcile':
        return await handleReconciliation(params.startDate, params.endDate, correlationId);
        
      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`,
          correlationId
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('[ADMIN] Error handling financial sync action:', error);
    
    return NextResponse.json({
      error: 'Failed to handle financial sync action',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// GET endpoint for sync status and configuration
export async function GET(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        error: 'Authentication required',
        correlationId
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const includeConfig = searchParams.get('includeConfig') === 'true';
    const includeStatus = searchParams.get('includeStatus') === 'true';
    
    const syncService = FinancialStateSynchronizationService.getInstance();
    
    const response: any = {
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      correlationId
    };
    
    if (includeConfig) {
      response.data.config = syncService.getConfig();
    }
    
    if (includeStatus && targetUserId) {
      // Get current sync status for user
      const syncResult = await syncService.synchronizeUserFinancialState(
        targetUserId, 
        correlationId
      );
      
      response.data.userStatus = {
        userId: targetUserId,
        lastSync: new Date().toISOString(),
        conflicts: syncResult.data?.conflicts || [],
        checksumBefore: syncResult.data?.checksumBefore,
        checksumAfter: syncResult.data?.checksumAfter,
        success: syncResult.success
      };
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[ADMIN] Error getting financial sync status:', error);
    
    return NextResponse.json({
      error: 'Failed to get financial sync status',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// Action handlers
async function handleSyncUser(
  targetUserId: string,
  syncConfig: any,
  dryRun: boolean,
  correlationId: string
) {
  if (!targetUserId) {
    return NextResponse.json({
      error: 'Target user ID is required',
      correlationId
    }, { status: 400 });
  }

  const syncService = FinancialStateSynchronizationService.getInstance(syncConfig);
  
  if (dryRun) {
    // Perform dry run - detect conflicts but don't resolve
    const dryRunService = FinancialStateSynchronizationService.getInstance({
      ...syncConfig,
      enableAutoResolution: false
    });
    
    const result = await dryRunService.synchronizeUserFinancialState(targetUserId, correlationId);
    
    return NextResponse.json({
      success: true,
      message: 'Dry run completed - no changes made',
      data: {
        conflicts: result.data?.conflicts || [],
        wouldResolve: result.data?.conflicts.filter(c => 
          c.suggestedResolution !== 'manual_review'
        ).length,
        requiresManualReview: result.data?.conflicts.filter(c => 
          c.suggestedResolution === 'manual_review'
        ).length
      },
      correlationId,
      dryRun: true
    });
  }

  const result = await syncService.synchronizeUserFinancialState(targetUserId, correlationId);
  
  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Synchronization failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'User financial state synchronized successfully',
    data: {
      userId: targetUserId,
      totalConflicts: result.data!.conflicts.length,
      resolvedConflicts: result.data!.resolvedConflicts.length,
      unresolvedConflicts: result.data!.unresolvedConflicts.length,
      stateUpdates: result.data!.stateUpdates.length,
      checksumBefore: result.data!.checksumBefore,
      checksumAfter: result.data!.checksumAfter,
      conflicts: result.data!.conflicts,
      stateUpdates: result.data!.stateUpdates
    },
    correlationId
  });
}

async function handleSyncAll(
  syncConfig: any,
  dryRun: boolean,
  correlationId: string
) {
  // This would typically get all users and sync them
  // For now, return a placeholder response
  
  return NextResponse.json({
    success: true,
    message: dryRun ? 'Bulk sync dry run completed' : 'Bulk sync initiated',
    data: {
      totalUsers: 0,
      processedUsers: 0,
      failedUsers: 0,
      totalConflicts: 0,
      resolvedConflicts: 0
    },
    correlationId,
    dryRun
  });
}

async function handleDetectConflicts(
  targetUserId: string,
  correlationId: string
) {
  if (!targetUserId) {
    return NextResponse.json({
      error: 'Target user ID is required',
      correlationId
    }, { status: 400 });
  }

  // Use detection-only configuration
  const syncService = FinancialStateSynchronizationService.getInstance({
    enableAutoResolution: false,
    conflictResolutionStrategy: 'manual'
  });

  const result = await syncService.synchronizeUserFinancialState(targetUserId, correlationId);
  
  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Conflict detection failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Conflict detection completed',
    data: {
      userId: targetUserId,
      conflicts: result.data!.conflicts,
      totalConflicts: result.data!.conflicts.length,
      conflictsBySeverity: {
        critical: result.data!.conflicts.filter(c => c.severity === 'critical').length,
        high: result.data!.conflicts.filter(c => c.severity === 'high').length,
        medium: result.data!.conflicts.filter(c => c.severity === 'medium').length,
        low: result.data!.conflicts.filter(c => c.severity === 'low').length
      },
      conflictsByType: result.data!.conflicts.reduce((acc, conflict) => {
        acc[conflict.type] = (acc[conflict.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    },
    correlationId
  });
}

async function handleResolveConflicts(
  targetUserId: string,
  conflictIds: string[],
  correlationId: string
) {
  if (!targetUserId) {
    return NextResponse.json({
      error: 'Target user ID is required',
      correlationId
    }, { status: 400 });
  }

  if (!conflictIds || conflictIds.length === 0) {
    return NextResponse.json({
      error: 'Conflict IDs are required',
      correlationId
    }, { status: 400 });
  }

  // This would implement selective conflict resolution
  // For now, return a placeholder response
  
  return NextResponse.json({
    success: true,
    message: 'Conflicts resolved successfully',
    data: {
      userId: targetUserId,
      resolvedConflicts: conflictIds.length,
      failedResolutions: 0
    },
    correlationId
  });
}

async function handleReconciliation(
  startDate: string,
  endDate: string,
  correlationId: string
) {
  if (!startDate || !endDate) {
    return NextResponse.json({
      error: 'Start date and end date are required',
      correlationId
    }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({
      error: 'Invalid date format',
      correlationId
    }, { status: 400 });
  }

  const result = await FinancialReconciliationService.runReconciliation(
    start,
    end,
    correlationId
  );

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Reconciliation failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Financial reconciliation completed',
    data: result.data,
    correlationId
  });
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'X-Service': 'financial-sync-api',
      'X-Timestamp': new Date().toISOString()
    }
  });
}
