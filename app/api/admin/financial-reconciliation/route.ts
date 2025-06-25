/**
 * Financial Reconciliation API
 * 
 * Admin endpoint for running financial reconciliation and detecting discrepancies
 * between subscription revenue, token allocations, and payout records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FinancialReconciliationService } from '../../../services/financialReconciliationService';
import { FinancialUtils } from '../../../types/financial';

/**
 * POST /api/admin/financial-reconciliation
 * Run financial reconciliation for a specific period
 */
export async function POST(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({
        error: 'Unauthorized - Admin access required',
        correlationId
      }, { status: 401 });
    }
    
    const body = await request.json();
    const { startDate, endDate, dryRun = false } = body;
    
    // Validate input
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
    
    if (start >= end) {
      return NextResponse.json({
        error: 'Start date must be before end date',
        correlationId
      }, { status: 400 });
    }
    
    // Check if period is too large (max 31 days)
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 31) {
      return NextResponse.json({
        error: 'Maximum reconciliation period is 31 days',
        correlationId
      }, { status: 400 });
    }
    
    console.log(`[RECONCILIATION] Starting reconciliation for period ${startDate} to ${endDate} (dry run: ${dryRun}) [${correlationId}]`);
    
    // Run reconciliation
    const result = await FinancialReconciliationService.runReconciliation(
      start,
      end,
      correlationId
    );
    
    if (!result.success) {
      return NextResponse.json({
        error: result.error?.message || 'Reconciliation failed',
        code: result.error?.code,
        correlationId: result.correlationId,
        retryable: result.error?.retryable
      }, { status: 500 });
    }
    
    const report = result.data!;
    
    // Log summary
    console.log(`[RECONCILIATION] Completed reconciliation [${correlationId}]`, {
      period: report.period,
      totalDiscrepancies: report.totalDiscrepancies,
      criticalDiscrepancies: report.discrepanciesBySeverity.critical || 0,
      totalAmountDiscrepancy: report.totalAmountDiscrepancy
    });
    
    return NextResponse.json({
      success: true,
      data: {
        report,
        summary: {
          period: report.period,
          totalDiscrepancies: report.totalDiscrepancies,
          discrepanciesBySeverity: report.discrepanciesBySeverity,
          discrepanciesByType: report.discrepanciesByType,
          totalAmountDiscrepancy: report.totalAmountDiscrepancy,
          resolvedDiscrepancies: report.resolvedDiscrepancies,
          pendingDiscrepancies: report.pendingDiscrepancies
        },
        dryRun
      },
      correlationId
    });
    
  } catch (error: any) {
    console.error('Financial reconciliation endpoint error:', error);
    
    return NextResponse.json({
      error: 'Failed to run financial reconciliation',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/financial-reconciliation
 * Get reconciliation status and recent reports
 */
export async function GET(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({
        error: 'Unauthorized - Admin access required',
        correlationId
      }, { status: 401 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const includeResolved = searchParams.get('includeResolved') === 'true';
    
    // This would typically query a reconciliation reports collection
    // For now, return a placeholder response
    const status = {
      lastReconciliation: null,
      nextScheduledReconciliation: null,
      systemStatus: 'healthy',
      recentReports: [],
      pendingDiscrepancies: 0,
      criticalDiscrepancies: 0,
      totalAmountAtRisk: 0
    };
    
    return NextResponse.json({
      success: true,
      data: status,
      correlationId
    });
    
  } catch (error: any) {
    console.error('Financial reconciliation status endpoint error:', error);
    
    return NextResponse.json({
      error: 'Failed to get reconciliation status',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/financial-reconciliation
 * Resolve or update discrepancies
 */
export async function PATCH(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({
        error: 'Unauthorized - Admin access required',
        correlationId
      }, { status: 401 });
    }
    
    const body = await request.json();
    const { discrepancyId, action, resolution } = body;
    
    if (!discrepancyId || !action) {
      return NextResponse.json({
        error: 'Discrepancy ID and action are required',
        correlationId
      }, { status: 400 });
    }
    
    // This would implement discrepancy resolution
    // For now, return a placeholder response
    
    console.log(`[RECONCILIATION] ${action} discrepancy ${discrepancyId} [${correlationId}]`);
    
    return NextResponse.json({
      success: true,
      data: {
        discrepancyId,
        action,
        resolution,
        resolvedAt: new Date().toISOString()
      },
      correlationId
    });
    
  } catch (error: any) {
    console.error('Financial reconciliation update endpoint error:', error);
    
    return NextResponse.json({
      error: 'Failed to update discrepancy',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}
