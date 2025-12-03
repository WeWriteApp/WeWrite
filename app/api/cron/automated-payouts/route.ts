/**
 * Automated Payout Processing Cron Endpoint
 * 
 * Handles scheduled automated processing of writer payouts
 * with comprehensive monitoring and error handling.
 * 
 * GET - Vercel cron trigger (processes payouts)
 * POST - Manual/admin trigger with options
 */

import { NextRequest, NextResponse } from 'next/server';
import { PayoutSchedulerService } from '../../../services/payoutSchedulerService';
import { AutomatedPayoutService } from '../../../services/automatedPayoutService';
import { FinancialUtils } from '../../../types/financial';

/**
 * GET handler for Vercel cron jobs
 * This is the primary entry point - Vercel cron sends GET requests
 */
export async function GET(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify cron access - Vercel adds CRON_SECRET for cron requests
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const cronApiKey = process.env.CRON_API_KEY;
    
    // Accept either CRON_SECRET (Vercel's built-in) or CRON_API_KEY (custom)
    const isAuthorized = 
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (cronApiKey && authHeader === `Bearer ${cronApiKey}`);

    if (!isAuthorized) {
      console.warn(`[CRON] Unauthorized access attempt to automated-payouts [${correlationId}]`);
      return NextResponse.json({
        error: 'Unauthorized - Cron access required',
        correlationId
      }, { status: 401 });
    }
    
    console.log(`[CRON] Starting automated payout processing via GET [${correlationId}]`);
    
    // Get scheduler instance
    const scheduler = PayoutSchedulerService.getInstance();
    
    // Initialize scheduler
    const initResult = await scheduler.initialize();
    if (!initResult.success) {
      console.error(`[CRON] Scheduler initialization failed [${correlationId}]`, initResult.error);
      return NextResponse.json({
        error: initResult.error?.message || 'Scheduler initialization failed',
        correlationId
      }, { status: 500 });
    }
    
    // Force run the scheduled payouts (since this is triggered by cron)
    const result = await scheduler.runScheduledPayouts(correlationId);
    
    if (!result.success) {
      console.error(`[CRON] Scheduled payout processing failed [${correlationId}]`, result.error);
      return NextResponse.json({
        error: result.error?.message || 'Scheduled payout processing failed',
        correlationId
      }, { status: 500 });
    }
    
    const runData = result.data!;
    console.log(`[CRON] Automated payout processing completed [${correlationId}]`, {
      totalPayouts: runData.totalPayouts,
      successful: runData.successfulPayouts,
      failed: runData.failedPayouts
    });
    
    return NextResponse.json({
      success: true,
      data: {
        runId: runData.id,
        totalPayouts: runData.totalPayouts,
        successfulPayouts: runData.successfulPayouts,
        failedPayouts: runData.failedPayouts,
        totalAmount: runData.totalAmount,
        errors: runData.errors.slice(0, 5)
      },
      correlationId
    });
    
  } catch (error: any) {
    console.error('[CRON] Automated payout processing error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

/**
 * POST handler for manual/admin triggers with options
 */
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