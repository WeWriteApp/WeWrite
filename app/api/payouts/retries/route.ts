import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { payoutRetryService } from '../../../services/payoutRetryService';
import { PayoutSchedulerService } from '../../../services/payoutSchedulerService';
import { FinancialUtils } from '../../../types/financial';

/**
 * GET /api/payouts/retries
 * Get retry statistics and pending retries
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (you may want to implement proper admin check)
    // For now, we'll allow any authenticated user to view retry stats
    
    const correlationId = FinancialUtils.generateCorrelationId();
    
    // Get retry statistics
    const statsResult = await payoutRetryService.getRetryStatistics();
    if (!statsResult.success) {
      return NextResponse.json({
        error: 'Failed to get retry statistics',
        details: statsResult.error
      }, { status: 500 });
    }

    // Get retry configuration
    const retryConfig = payoutRetryService.getRetryConfig();

    return NextResponse.json({
      success: true,
      data: {
        statistics: statsResult.data,
        configuration: retryConfig,
        correlationId
      }
    });

  } catch (error) {
    console.error('Error getting retry information:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/payouts/retries
 * Manually trigger retry processing or schedule a specific payout for retry
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (implement proper admin check)
    // For now, we'll allow any authenticated user to trigger retries
    
    const body = await request.json();
    const { action, payoutId, failureReason } = body;

    const correlationId = FinancialUtils.generateCorrelationId();

    if (action === 'process_all') {
      // Process all pending retries
      const scheduler = PayoutSchedulerService.getInstance();
      const result = await scheduler.processRetries(correlationId);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Retry processing completed',
          data: result.data,
          correlationId
        });
      } else {
        return NextResponse.json({
          error: 'Retry processing failed',
          details: result.error?.message,
          correlationId
        }, { status: 500 });
      }

    } else if (action === 'schedule_retry' && payoutId) {
      // Schedule a specific payout for retry
      if (!failureReason) {
        return NextResponse.json({
          error: 'Failure reason is required for scheduling retry'
        }, { status: 400 });
      }

      const result = await payoutRetryService.scheduleRetry(payoutId, failureReason);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Payout scheduled for retry',
          data: {
            payoutId,
            nextRetryAt: result.nextRetryAt
          },
          correlationId
        });
      } else {
        return NextResponse.json({
          error: 'Failed to schedule retry',
          details: result.error,
          correlationId
        }, { status: 400 });
      }

    } else {
      return NextResponse.json({
        error: 'Invalid action. Use "process_all" or "schedule_retry"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error processing retry request:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * PUT /api/payouts/retries
 * Update retry configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (implement proper admin check)
    // For now, we'll allow any authenticated user to update config
    
    const body = await request.json();
    const { maxRetries, baseDelayMs, maxDelayMs, backoffMultiplier, retryableFailureCodes } = body;

    // Validate configuration
    if (maxRetries !== undefined && (maxRetries < 0 || maxRetries > 10)) {
      return NextResponse.json({
        error: 'maxRetries must be between 0 and 10'
      }, { status: 400 });
    }

    if (baseDelayMs !== undefined && (baseDelayMs < 60000 || baseDelayMs > 3600000)) {
      return NextResponse.json({
        error: 'baseDelayMs must be between 1 minute and 1 hour'
      }, { status: 400 });
    }

    if (backoffMultiplier !== undefined && (backoffMultiplier < 1 || backoffMultiplier > 5)) {
      return NextResponse.json({
        error: 'backoffMultiplier must be between 1 and 5'
      }, { status: 400 });
    }

    // Update configuration
    const updateConfig: any = {};
    if (maxRetries !== undefined) updateConfig.maxRetries = maxRetries;
    if (baseDelayMs !== undefined) updateConfig.baseDelayMs = baseDelayMs;
    if (maxDelayMs !== undefined) updateConfig.maxDelayMs = maxDelayMs;
    if (backoffMultiplier !== undefined) updateConfig.backoffMultiplier = backoffMultiplier;
    if (retryableFailureCodes !== undefined) updateConfig.retryableFailureCodes = retryableFailureCodes;

    payoutRetryService.updateRetryConfig(updateConfig);

    return NextResponse.json({
      success: true,
      message: 'Retry configuration updated',
      data: payoutRetryService.getRetryConfig()
    });

  } catch (error) {
    console.error('Error updating retry configuration:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
