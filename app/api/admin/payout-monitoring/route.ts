/**
 * Payout Monitoring Dashboard API
 * 
 * Provides monitoring data and controls for the automated payout system
 */

import { NextRequest, NextResponse } from 'next/server';
import { PayoutMonitoringService } from '../../../services/payoutMonitoringService';
import { PayoutSchedulerService } from '../../../services/payoutSchedulerService';
import { AutomatedPayoutService } from '../../../services/automatedPayoutService';
import { FinancialUtils } from '../../../types/financial';
import { checkAdminPermissions } from '../../admin-auth-helper';

// GET endpoint for monitoring dashboard data
export async function GET(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify admin access
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({
        error: adminCheck.error || 'Admin access required',
        correlationId
      }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const includeAlerts = searchParams.get('includeAlerts') === 'true';
    const includeMetrics = searchParams.get('includeMetrics') === 'true';
    
    // Get monitoring service instance
    const monitoringService = PayoutMonitoringService.getInstance();
    await monitoringService.initialize();
    
    // Get scheduler service instance
    const schedulerService = PayoutSchedulerService.getInstance();
    await schedulerService.initialize();
    
    // Get automated payout service instance
    const payoutService = AutomatedPayoutService.getInstance();
    
    const response: any = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        scheduler: schedulerService.getSchedulerStatus(),
        processing: payoutService.getProcessingStatus()
      },
      correlationId
    };
    
    // Add health status and metrics if requested
    if (includeMetrics) {
      const healthResult = await monitoringService.getHealthStatus(correlationId);
      if (healthResult.success && healthResult.data) {
        response.data.health = healthResult.data;
      }
    }
    
    // Add alert information if requested
    if (includeAlerts) {
      response.data.alerts = {
        active: monitoringService.getActiveAlerts(),
        config: monitoringService.getAlertConfig()
      };
    }
    
    // Add recent runs history if requested
    if (includeHistory) {
      const historyLimit = parseInt(searchParams.get('historyLimit') || '20');
      response.data.recentRuns = await schedulerService.getRecentRuns(historyLimit);
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[ADMIN] Error getting payout monitoring data:', error);
    
    return NextResponse.json({
      error: 'Failed to get monitoring data',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// POST endpoint for monitoring actions
export async function POST(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify admin access
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({
        error: adminCheck.error || 'Admin access required',
        correlationId
      }, { status: 403 });
    }
    
    const body = await request.json();
    const { action, ...params } = body;
    
    console.log(`[ADMIN] Payout monitoring action: ${action} [${correlationId}]`, params);
    
    switch (action) {
      case 'triggerPayouts':
        return await handleTriggerPayouts(params, correlationId);
        
      case 'updateSchedule':
        return await handleUpdateSchedule(params, correlationId);
        
      case 'updateAlertConfig':
        return await handleUpdateAlertConfig(params, correlationId);
        
      case 'acknowledgeAlert':
        return await handleAcknowledgeAlert(params, correlationId);
        
      case 'resolveAlert':
        return await handleResolveAlert(params, correlationId);
        
      case 'getMetrics':
        return await handleGetMetrics(params, correlationId);
        
      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`,
          correlationId
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('[ADMIN] Error handling payout monitoring action:', error);
    
    return NextResponse.json({
      error: 'Failed to handle monitoring action',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// Action handlers
async function handleTriggerPayouts(params: any, correlationId: string) {
  const { forceRun = false, dryRun = false } = params;
  
  const schedulerService = PayoutSchedulerService.getInstance();
  await schedulerService.initialize();
  
  if (dryRun) {
    const payoutService = AutomatedPayoutService.getInstance();
    const status = payoutService.getProcessingStatus();
    
    return NextResponse.json({
      success: true,
      message: 'Dry run completed - no actual payouts processed',
      data: {
        wouldProcess: true,
        currentStatus: status
      },
      correlationId,
      dryRun: true
    });
  }
  
  if (!forceRun && !schedulerService.shouldRunScheduledPayouts()) {
    return NextResponse.json({
      success: false,
      error: 'Not scheduled to run payouts at this time. Use forceRun=true to override.',
      data: {
        nextScheduledTime: schedulerService.getSchedulerStatus().nextScheduledTime
      },
      correlationId
    }, { status: 400 });
  }
  
  const result = await schedulerService.runScheduledPayouts(correlationId);
  
  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to trigger payouts',
      correlationId
    }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    message: 'Payout processing triggered successfully',
    data: result.data,
    correlationId
  });
}

async function handleUpdateSchedule(params: any, correlationId: string) {
  const { config } = params;
  
  if (!config) {
    return NextResponse.json({
      error: 'Schedule configuration is required',
      correlationId
    }, { status: 400 });
  }
  
  const schedulerService = PayoutSchedulerService.getInstance();
  const result = await schedulerService.updateScheduleConfig(config, correlationId);
  
  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to update schedule',
      correlationId
    }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    message: 'Schedule configuration updated successfully',
    data: schedulerService.getSchedulerStatus(),
    correlationId
  });
}

async function handleUpdateAlertConfig(params: any, correlationId: string) {
  const { config } = params;
  
  if (!config) {
    return NextResponse.json({
      error: 'Alert configuration is required',
      correlationId
    }, { status: 400 });
  }
  
  const monitoringService = PayoutMonitoringService.getInstance();
  const result = await monitoringService.updateAlertConfig(config, correlationId);
  
  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to update alert configuration',
      correlationId
    }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    message: 'Alert configuration updated successfully',
    data: monitoringService.getAlertConfig(),
    correlationId
  });
}

async function handleAcknowledgeAlert(params: any, correlationId: string) {
  const { alertId } = params;
  
  if (!alertId) {
    return NextResponse.json({
      error: 'Alert ID is required',
      correlationId
    }, { status: 400 });
  }
  
  const monitoringService = PayoutMonitoringService.getInstance();
  const result = await monitoringService.acknowledgeAlert(alertId, correlationId);
  
  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to acknowledge alert',
      correlationId
    }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    message: 'Alert acknowledged successfully',
    correlationId
  });
}

async function handleResolveAlert(params: any, correlationId: string) {
  const { alertId } = params;
  
  if (!alertId) {
    return NextResponse.json({
      error: 'Alert ID is required',
      correlationId
    }, { status: 400 });
  }
  
  const monitoringService = PayoutMonitoringService.getInstance();
  const result = await monitoringService.resolveAlert(alertId, correlationId);
  
  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to resolve alert',
      correlationId
    }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    message: 'Alert resolved successfully',
    correlationId
  });
}

async function handleGetMetrics(params: any, correlationId: string) {
  const monitoringService = PayoutMonitoringService.getInstance();
  const result = await monitoringService.calculateMetrics(correlationId);
  
  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to calculate metrics',
      correlationId
    }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    data: result.data,
    correlationId
  });
}