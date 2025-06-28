/**
 * Scheduled Financial Reconciliation Cron API
 * 
 * Endpoint for automated financial reconciliation runs.
 * Should be called by external cron services or scheduled functions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ScheduledReconciliationService, DEFAULT_RECONCILIATION_SCHEDULE } from '../../../services/scheduledReconciliationService';
import { FinancialUtils } from '../../../types/financial';

/**
 * POST /api/cron/financial-reconciliation
 * Run scheduled financial reconciliation
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
      lookbackDays = DEFAULT_RECONCILIATION_SCHEDULE.lookbackDays,
      alertThresholds = DEFAULT_RECONCILIATION_SCHEDULE.alertThresholds,
      dryRun = false 
    } = body;
    
    console.log(`[CRON] Starting scheduled financial reconciliation (dry run: ${dryRun}) [${correlationId}]`);
    
    // Create schedule configuration
    const schedule = {
      ...DEFAULT_RECONCILIATION_SCHEDULE,
      lookbackDays,
      alertThresholds
    };
    
    // Run scheduled reconciliation
    const result = await ScheduledReconciliationService.runScheduledReconciliation(
      schedule,
      correlationId
    );
    
    if (!result.success) {
      console.error(`[CRON] Scheduled reconciliation failed [${correlationId}]`, result.error);
      
      return NextResponse.json({
        error: result.error?.message || 'Scheduled reconciliation failed',
        code: result.error?.code,
        correlationId: result.correlationId,
        retryable: result.error?.retryable
      }, { status: 500 });
    }
    
    const { report, alerts } = result.data!;
    
    // Log results
    console.log(`[CRON] Scheduled reconciliation completed [${correlationId}]`, {
      period: report.period,
      totalDiscrepancies: report.totalDiscrepancies,
      alertsGenerated: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length
    });
    
    // If there are critical alerts, log them separately
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      console.error(`[CRON] CRITICAL FINANCIAL ALERTS [${correlationId}]`, {
        count: criticalAlerts.length,
        alerts: criticalAlerts.map(a => ({
          type: a.type,
          title: a.title,
          description: a.description
        }))
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        report: {
          id: report.id,
          period: report.period,
          totalDiscrepancies: report.totalDiscrepancies,
          discrepanciesBySeverity: report.discrepanciesBySeverity,
          discrepanciesByType: report.discrepanciesByType,
          totalAmountDiscrepancy: report.totalAmountDiscrepancy,
          resolvedDiscrepancies: report.resolvedDiscrepancies,
          pendingDiscrepancies: report.pendingDiscrepancies
        },
        alerts: alerts.map(a => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          title: a.title,
          description: a.description
        })),
        summary: {
          reconciliationStatus: alerts.some(a => a.severity === 'critical') ? 'critical' : 
                               alerts.some(a => a.severity === 'error') ? 'warning' : 'healthy',
          criticalAlerts: criticalAlerts.length,
          totalAlerts: alerts.length,
          totalAmountAtRisk: report.totalAmountDiscrepancy
        }
      },
      correlationId,
      dryRun
    });
    
  } catch (error: any) {
    console.error('[CRON] Scheduled reconciliation endpoint error:', error);
    
    return NextResponse.json({
      error: 'Failed to run scheduled reconciliation',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

/**
 * GET /api/cron/financial-reconciliation
 * Get reconciliation health status
 */
export async function GET(request: NextRequest) {
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
    
    // Get reconciliation health
    const healthResult = await ScheduledReconciliationService.getReconciliationHealth(correlationId);
    
    if (!healthResult.success) {
      return NextResponse.json({
        error: healthResult.error?.message || 'Failed to get reconciliation health',
        correlationId
      }, { status: 500 });
    }
    
    const health = healthResult.data!;
    
    return NextResponse.json({
      success: true,
      data: health,
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[CRON] Reconciliation health endpoint error:', error);
    
    return NextResponse.json({
      error: 'Failed to get reconciliation health',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

/**
 * Health check endpoint for monitoring
 */
export async function HEAD() {
  return new Response(null, { 
    status: 200,
    headers: {
      'X-Service': 'financial-reconciliation',
      'X-Status': 'operational'
    }
  });
}
