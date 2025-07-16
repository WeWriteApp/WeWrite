/**
 * Automated Financial State Synchronization Cron Endpoint
 * 
 * Handles scheduled synchronization of financial states across
 * token system, Stripe, and database with comprehensive monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FinancialStateSynchronizationService } from '../../../services/financialStateSynchronizationService';
import { FinancialReconciliationService } from '../../../services/financialReconciliationService';
import { FinancialUtils } from '../../../types/financial';
import { db } from '../../../firebase/config';
import { collection, query, limit, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getCollectionName } from "../../../utils/environmentConfig";

export async function POST(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify cron access
    const authHeader = request.headers.get('authorization');
    const cronKey = process.env.CRON_API_KEY;
    
    if (!cronKey || authHeader !== `Bearer ${cronKey}`) {
      return NextResponse.json({
        error: 'Unauthorized - Cron access required',
        correlationId
      }, { status: 401 });
    }
    
    const body = await request.json().catch(() => ({}));
    const { 
      syncType = 'incremental',
      batchSize = 50,
      dryRun = false,
      conflictResolutionStrategy = 'conservative',
      enableAutoResolution = true,
      maxRetries = 3
    } = body;
    
    console.log(`[CRON] Starting financial state synchronization (type: ${syncType}, dry run: ${dryRun}) [${correlationId}]`);
    
    // Create sync run record
    const runId = `sync_run_${Date.now()}`;
    const syncRun = {
      id: runId,
      type: syncType,
      startedAt: new Date(),
      status: 'running',
      correlationId,
      config: {
        batchSize,
        conflictResolutionStrategy,
        enableAutoResolution,
        maxRetries
      },
      dryRun,
      results: {
        totalUsers: 0,
        processedUsers: 0,
        failedUsers: 0,
        totalConflicts: 0,
        resolvedConflicts: 0,
        unresolvedConflicts: 0,
        errors: []
      }
    };

    if (!dryRun) {
      await setDoc(doc(db, 'financialSyncRuns', runId), {
        ...syncRun,
        startedAt: serverTimestamp()
      });
    }

    // Initialize synchronization service
    const syncService = FinancialStateSynchronizationService.getInstance({
      conflictResolutionStrategy: conflictResolutionStrategy as any,
      enableAutoResolution,
      maxRetries
    });

    let processedUsers = 0;
    let failedUsers = 0;
    let totalConflicts = 0;
    let resolvedConflicts = 0;
    let unresolvedConflicts = 0;
    const errors: string[] = [];

    if (syncType === 'full') {
      // Full synchronization - process all users
      const result = await processFullSynchronization(
        syncService,
        batchSize,
        dryRun,
        correlationId
      );
      
      processedUsers = result.processedUsers;
      failedUsers = result.failedUsers;
      totalConflicts = result.totalConflicts;
      resolvedConflicts = result.resolvedConflicts;
      unresolvedConflicts = result.unresolvedConflicts;
      errors.push(...result.errors);

    } else if (syncType === 'incremental') {
      // Incremental synchronization - process users with recent activity
      const result = await processIncrementalSynchronization(
        syncService,
        batchSize,
        dryRun,
        correlationId
      );
      
      processedUsers = result.processedUsers;
      failedUsers = result.failedUsers;
      totalConflicts = result.totalConflicts;
      resolvedConflicts = result.resolvedConflicts;
      unresolvedConflicts = result.unresolvedConflicts;
      errors.push(...result.errors);

    } else if (syncType === 'reconciliation') {
      // Run financial reconciliation
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const reconciliationResult = await FinancialReconciliationService.runReconciliation(
        weekAgo,
        yesterday,
        correlationId
      );

      if (reconciliationResult.success && reconciliationResult.data) {
        totalConflicts = reconciliationResult.data.totalDiscrepancies;
        // Reconciliation doesn't auto-resolve, so all conflicts are unresolved
        unresolvedConflicts = totalConflicts;
      } else {
        errors.push(reconciliationResult.error?.message || 'Reconciliation failed');
        failedUsers = 1;
      }
    }

    // Update sync run results
    syncRun.status = errors.length === 0 ? 'completed' : 'completed_with_errors';
    syncRun.results = {
      totalUsers: processedUsers + failedUsers,
      processedUsers,
      failedUsers,
      totalConflicts,
      resolvedConflicts,
      unresolvedConflicts,
      errors: errors.slice(0, 10) // Limit error details
    };

    if (!dryRun) {
      await setDoc(doc(db, 'financialSyncRuns', runId), {
        ...syncRun,
        completedAt: serverTimestamp()
      });
    }

    const hasErrors = errors.length > 0;
    const hasCriticalIssues = unresolvedConflicts > 10 || failedUsers > (processedUsers * 0.1);
    
    const responseStatus = hasCriticalIssues ? 'critical' : hasErrors ? 'warning' : 'success';
    const httpStatus = hasCriticalIssues ? 500 : 200;

    console.log(`[CRON] Financial state synchronization completed [${correlationId}]`, {
      status: responseStatus,
      processedUsers,
      failedUsers,
      totalConflicts,
      resolvedConflicts,
      unresolvedConflicts,
      errors: errors.length
    });

    return NextResponse.json({
      success: true,
      status: responseStatus,
      message: `Financial state synchronization completed`,
      data: {
        runId,
        type: syncType,
        totalUsers: processedUsers + failedUsers,
        processedUsers,
        failedUsers,
        totalConflicts,
        resolvedConflicts,
        unresolvedConflicts,
        successRate: processedUsers > 0 ? (processedUsers / (processedUsers + failedUsers)) * 100 : 0,
        conflictResolutionRate: totalConflicts > 0 ? (resolvedConflicts / totalConflicts) * 100 : 0,
        errors: errors.slice(0, 5), // Limit error details in response
        hasMoreErrors: errors.length > 5,
        duration: Date.now() - new Date(syncRun.startedAt).getTime()
      },
      correlationId,
      dryRun
    }, { status: httpStatus });
    
  } catch (error: any) {
    console.error('[CRON] Financial state synchronization endpoint error:', error);
    
    return NextResponse.json({
      error: 'Internal server error during financial state synchronization',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// Process full synchronization for all users
async function processFullSynchronization(
  syncService: FinancialStateSynchronizationService,
  batchSize: number,
  dryRun: boolean,
  correlationId: string
) {
  let processedUsers = 0;
  let failedUsers = 0;
  let totalConflicts = 0;
  let resolvedConflicts = 0;
  let unresolvedConflicts = 0;
  const errors: string[] = [];

  try {
    // Get all users with token balances (indicating financial activity)
const balancesQuery = db.collection(getCollectionName('writerTokenBalances')).limit(batchSize);
    
    const balancesSnapshot = await getDocs(balancesQuery);
    
    for (const balanceDoc of balancesSnapshot.docs) {
      const userId = balanceDoc.id;
      
      try {
        if (!dryRun) {
          const result = await syncService.synchronizeUserFinancialState(userId, correlationId);
          
          if (result.success && result.data) {
            processedUsers++;
            totalConflicts += result.data.conflicts.length;
            resolvedConflicts += result.data.resolvedConflicts.length;
            unresolvedConflicts += result.data.unresolvedConflicts.length;
          } else {
            failedUsers++;
            errors.push(`User ${userId}: ${result.error?.message || 'Unknown error'}`);
          }
        } else {
          // Dry run - just count
          processedUsers++;
        }
        
      } catch (userError: any) {
        failedUsers++;
        errors.push(`User ${userId}: ${userError.message}`);
      }
    }
    
  } catch (error: any) {
    errors.push(`Full sync error: ${error.message}`);
  }

  return {
    processedUsers,
    failedUsers,
    totalConflicts,
    resolvedConflicts,
    unresolvedConflicts,
    errors
  };
}

// Process incremental synchronization for recently active users
async function processIncrementalSynchronization(
  syncService: FinancialStateSynchronizationService,
  batchSize: number,
  dryRun: boolean,
  correlationId: string
) {
  let processedUsers = 0;
  let failedUsers = 0;
  let totalConflicts = 0;
  let resolvedConflicts = 0;
  let unresolvedConflicts = 0;
  const errors: string[] = [];

  try {
    // Get users with recent financial activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Query recent token allocations to find active users
    const allocationsQuery = db.collection(getCollectionName('tokenAllocations')).limit(batchSize);
    
    const allocationsSnapshot = await getDocs(allocationsQuery);
    const activeUserIds = new Set<string>();
    
    allocationsSnapshot.docs.forEach(doc => {
      const allocation = doc.data();
      if (allocation.recipientUserId) {
        activeUserIds.add(allocation.recipientUserId);
      }
    });

    for (const userId of activeUserIds) {
      try {
        if (!dryRun) {
          const result = await syncService.synchronizeUserFinancialState(userId, correlationId);
          
          if (result.success && result.data) {
            processedUsers++;
            totalConflicts += result.data.conflicts.length;
            resolvedConflicts += result.data.resolvedConflicts.length;
            unresolvedConflicts += result.data.unresolvedConflicts.length;
          } else {
            failedUsers++;
            errors.push(`User ${userId}: ${result.error?.message || 'Unknown error'}`);
          }
        } else {
          // Dry run - just count
          processedUsers++;
        }
        
      } catch (userError: any) {
        failedUsers++;
        errors.push(`User ${userId}: ${userError.message}`);
      }
    }
    
  } catch (error: any) {
    errors.push(`Incremental sync error: ${error.message}`);
  }

  return {
    processedUsers,
    failedUsers,
    totalConflicts,
    resolvedConflicts,
    unresolvedConflicts,
    errors
  };
}

// GET endpoint for checking sync status
export async function GET(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const historyLimit = parseInt(searchParams.get('historyLimit') || '10');
    
    const response: any = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        service: 'financial-state-synchronization',
        status: 'operational'
      },
      correlationId
    };
    
    if (includeHistory) {
      // Get recent sync runs
      const runsQuery = query(
        collection(db, 'financialSyncRuns'),
        limit(historyLimit)
      );
      
      const runsSnapshot = await getDocs(runsQuery);
      response.data.recentRuns = runsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[CRON] Error getting financial sync status:', error);
    
    return NextResponse.json({
      error: 'Failed to get financial sync status',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'X-Service': 'financial-sync-cron',
      'X-Timestamp': new Date().toISOString()
    }
  });
}