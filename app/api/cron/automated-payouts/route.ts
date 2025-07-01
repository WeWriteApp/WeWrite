/**
 * Automated Payout Processing Cron Endpoint
 * 
 * Handles scheduled automated processing of writer payouts
 * with comprehensive monitoring and error handling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PayoutSchedulerService } from '../../../services/payoutSchedulerService';
import { AutomatedPayoutService } from '../../../services/automatedPayoutService';
import { FinancialUtils } from '../../../types/financial';

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
      forceRun = false,
      dryRun = false,
      batchSize,
      maxRetries
    } = body;
    
    console.log(`[CRON] Starting automated payout processing (force: ${forceRun}, dry run: ${dryRun}) [${correlationId}]`);
    
    // Get scheduler instance
    const scheduler = PayoutSchedulerService.getInstance();
    
    // Initialize scheduler if needed
    const initResult = await scheduler.initialize();
    if (!initResult.success) {
      console.error(`[CRON] Scheduler initialization failed [${correlationId}]`, initResult.error);
      
      return NextResponse.json({
        error: initResult.error?.message || 'Scheduler initialization failed',
        code: initResult.error?.code,
        correlationId,
        retryable: initResult.error?.retryable
      }, { status: 500 });
    }
    
    // Check if scheduled run should execute
    const shouldRun = forceRun || scheduler.shouldRunScheduledPayouts();
    
    if (!shouldRun) {
      const status = scheduler.getSchedulerStatus();
      
      return NextResponse.json({
        success: true,
        message: 'No scheduled payout processing needed at this time',
        data: {
          nextScheduledTime: status.nextScheduledTime,
          isRunning: status.isRunning,
          config: status.config
        },
        correlationId,
        dryRun
      });
    }
    
    if (dryRun) {
      // Simulate the run without actually processing payouts
      const payoutService = AutomatedPayoutService.getInstance({
        batchSize: batchSize || undefined,
        maxRetries: maxRetries || undefined
      });
      
      const status = payoutService.getProcessingStatus();
      const schedulerStatus = scheduler.getSchedulerStatus();
      
      return NextResponse.json({
        success: true,
        message: 'Dry run completed - no actual payouts processed',
        data: {
          wouldProcess: true,
          schedulerStatus,
          processingStatus: status,
          nextScheduledTime: schedulerStatus.nextScheduledTime
        },
        correlationId,
        dryRun: true
      });
    }
    
    // Run scheduled payout processing
    const result = await scheduler.runScheduledPayouts(correlationId);
    
    if (!result.success) {
      console.error(`[CRON] Scheduled payout processing failed [${correlationId}]`, result.error);
      
      return NextResponse.json({
        error: result.error?.message || 'Scheduled payout processing failed',
        code: result.error?.code,
        correlationId: result.correlationId,
        retryable: result.error?.retryable
      }, { status: 500 });
    }
    
    const runData = result.data!;
    const hasErrors = runData.errors.length > 0;
    const hasFailures = runData.failedPayouts > 0;
    
    // Determine response status
    const responseStatus = hasErrors || hasFailures ? 'warning' : 'success';
    const httpStatus = hasErrors && runData.successfulPayouts === 0 ? 500 : 200;
    
    console.log(`[CRON] Automated payout processing completed [${correlationId}]`, {
      status: responseStatus,
      totalPayouts: runData.totalPayouts,
      successful: runData.successfulPayouts,
      failed: runData.failedPayouts,
      errors: runData.errors.length
    });
    
    return NextResponse.json({
      success: true,
      status: responseStatus,
      message: `Automated payout processing completed`,
      data: {
        runId: runData.id,
        totalPayouts: runData.totalPayouts,
        successfulPayouts: runData.successfulPayouts,
        failedPayouts: runData.failedPayouts,
        totalAmount: runData.totalAmount,
        startedAt: runData.startedAt,
        completedAt: runData.completedAt,
        duration: runData.completedAt && runData.startedAt ? 
          runData.completedAt.getTime() - runData.startedAt.getTime() : null,
        errors: runData.errors.slice(0, 10), // Limit error details in response
        hasMoreErrors: runData.errors.length > 10,
        nextScheduledTime: scheduler.getSchedulerStatus().nextScheduledTime
      },
      correlationId,
      dryRun
    }, { status: httpStatus });
    
  } catch (error: any) {
    console.error('[CRON] Automated payout processing endpoint error:', error);
    
    return NextResponse.json({
      error: 'Internal server error during automated payout processing',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// GET endpoint for checking automated payout status
export async function GET(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const historyLimit = parseInt(searchParams.get('historyLimit') || '10');
    
    // Get scheduler instance
    const scheduler = PayoutSchedulerService.getInstance();
    
    // Initialize scheduler if needed
    await scheduler.initialize();
    
    const status = scheduler.getSchedulerStatus();
    const payoutService = AutomatedPayoutService.getInstance();
    const processingStatus = payoutService.getProcessingStatus();
    
    const response: any = {
      success: true,
      data: {
        scheduler: {
          isRunning: status.isRunning,
          currentRun: status.currentRun,
          config: status.config,
          nextScheduledTime: status.nextScheduledTime
        },
        processing: processingStatus,
        timestamp: new Date().toISOString()
      },
      correlationId
    };
    
    if (includeHistory) {
      const recentRuns = await scheduler.getRecentRuns(historyLimit);
      response.data.recentRuns = recentRuns;
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[CRON] Error getting automated payout status:', error);
    
    return NextResponse.json({
      error: 'Failed to get automated payout status',
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
      'X-Service': 'automated-payouts-cron',
      'X-Timestamp': new Date().toISOString()
    }
  });
}