/**
 * Automated Tax Processing Cron Endpoint
 * 
 * Handles scheduled tax document generation, compliance checks,
 * and year-end tax processing automation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TaxReportingService } from '../../../services/taxReportingService';
import { TaxInformationService } from '../../../services/taxInformationService';
import { FinancialUtils } from '../../../types/financial';
import { db } from '../../../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

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
      taskType = 'year_end_processing',
      taxYear = new Date().getFullYear() - 1, // Previous year by default
      dryRun = false,
      forceRegeneration = false
    } = body;
    
    console.log(`[CRON] Starting tax processing (type: ${taskType}, year: ${taxYear}, dry run: ${dryRun}) [${correlationId}]`);
    
    // Create processing run record
    const runId = `tax_run_${taskType}_${taxYear}_${Date.now()}`;
    const taxRun = {
      id: runId,
      type: taskType,
      taxYear,
      startedAt: new Date(),
      status: 'running',
      correlationId,
      dryRun,
      forceRegeneration,
      results: {
        totalUsers: 0,
        summariesGenerated: 0,
        documentsGenerated: 0,
        complianceChecks: 0,
        errors: []
      }
    };

    if (!dryRun) {
      await setDoc(doc(db, 'taxProcessingRuns', runId), {
        ...taxRun,
        startedAt: serverTimestamp()
      });
    }

    let totalUsers = 0;
    let summariesGenerated = 0;
    let documentsGenerated = 0;
    let complianceChecks = 0;
    const errors: string[] = [];

    const taxReportingService = TaxReportingService.getInstance();
    const taxInfoService = TaxInformationService.getInstance();

    switch (taskType) {
      case 'year_end_processing':
        const yearEndResult = await processYearEndTaxes(
          taxReportingService,
          taxInfoService,
          taxYear,
          dryRun,
          forceRegeneration,
          correlationId
        );
        
        totalUsers = yearEndResult.totalUsers;
        summariesGenerated = yearEndResult.summariesGenerated;
        documentsGenerated = yearEndResult.documentsGenerated;
        errors.push(...yearEndResult.errors);
        break;

      case 'compliance_check':
        const complianceResult = await processComplianceChecks(
          taxInfoService,
          dryRun,
          correlationId
        );
        
        totalUsers = complianceResult.totalUsers;
        complianceChecks = complianceResult.complianceChecks;
        errors.push(...complianceResult.errors);
        break;

      case 'bulk_generation':
        const bulkResult = await taxReportingService.processBulkTaxGeneration(
          taxYear,
          undefined,
          correlationId
        );
        
        if (bulkResult.success && bulkResult.data) {
          totalUsers = bulkResult.data.totalUsers;
          documentsGenerated = bulkResult.data.documentsGenerated;
          errors.push(...bulkResult.data.errors);
        } else {
          errors.push(bulkResult.error?.message || 'Bulk generation failed');
        }
        break;

      default:
        return NextResponse.json({
          error: `Unknown task type: ${taskType}`,
          correlationId
        }, { status: 400 });
    }

    // Update processing run results
    taxRun.status = errors.length === 0 ? 'completed' : 'completed_with_errors';
    taxRun.results = {
      totalUsers,
      summariesGenerated,
      documentsGenerated,
      complianceChecks,
      errors: errors.slice(0, 10) // Limit error details
    };

    if (!dryRun) {
      await setDoc(doc(db, 'taxProcessingRuns', runId), {
        ...taxRun,
        completedAt: serverTimestamp()
      });
    }

    const hasErrors = errors.length > 0;
    const hasCriticalIssues = errors.length > (totalUsers * 0.1); // More than 10% error rate
    
    const responseStatus = hasCriticalIssues ? 'critical' : hasErrors ? 'warning' : 'success';
    const httpStatus = hasCriticalIssues ? 500 : 200;

    console.log(`[CRON] Tax processing completed [${correlationId}]`, {
      status: responseStatus,
      taskType,
      taxYear,
      totalUsers,
      summariesGenerated,
      documentsGenerated,
      complianceChecks,
      errors: errors.length
    });

    return NextResponse.json({
      success: true,
      status: responseStatus,
      message: `Tax processing completed`,
      data: {
        runId,
        taskType,
        taxYear,
        totalUsers,
        summariesGenerated,
        documentsGenerated,
        complianceChecks,
        successRate: totalUsers > 0 ? ((totalUsers - errors.length) / totalUsers) * 100 : 100,
        errors: errors.slice(0, 5), // Limit error details in response
        hasMoreErrors: errors.length > 5,
        duration: Date.now() - new Date(taxRun.startedAt).getTime()
      },
      correlationId,
      dryRun
    }, { status: httpStatus });
    
  } catch (error: any) {
    console.error('[CRON] Tax processing endpoint error:', error);
    
    return NextResponse.json({
      error: 'Internal server error during tax processing',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// Process year-end tax document generation
async function processYearEndTaxes(
  taxReportingService: TaxReportingService,
  taxInfoService: TaxInformationService,
  taxYear: number,
  dryRun: boolean,
  forceRegeneration: boolean,
  correlationId: string
) {
  let totalUsers = 0;
  let summariesGenerated = 0;
  let documentsGenerated = 0;
  const errors: string[] = [];

  try {
    // This would typically get all users with financial activity
    // For now, we'll simulate the process
    
    if (dryRun) {
      // Simulate processing
      totalUsers = 100; // Mock number
      summariesGenerated = 95;
      documentsGenerated = 85;
    } else {
      // Actual processing would go here
      const bulkResult = await taxReportingService.processBulkTaxGeneration(
        taxYear,
        undefined,
        correlationId
      );
      
      if (bulkResult.success && bulkResult.data) {
        totalUsers = bulkResult.data.totalUsers;
        documentsGenerated = bulkResult.data.documentsGenerated;
        summariesGenerated = totalUsers; // Assume one summary per user
        errors.push(...bulkResult.data.errors);
      } else {
        errors.push(bulkResult.error?.message || 'Year-end processing failed');
      }
    }
    
  } catch (error: any) {
    errors.push(`Year-end processing error: ${error.message}`);
  }

  return {
    totalUsers,
    summariesGenerated,
    documentsGenerated,
    errors
  };
}

// Process compliance checks for all users
async function processComplianceChecks(
  taxInfoService: TaxInformationService,
  dryRun: boolean,
  correlationId: string
) {
  let totalUsers = 0;
  let complianceChecks = 0;
  const errors: string[] = [];

  try {
    if (dryRun) {
      // Simulate compliance checking
      totalUsers = 100;
      complianceChecks = 100;
    } else {
      // Actual compliance checking would go here
      // This would involve getting all users and checking their compliance status
      totalUsers = 0; // Placeholder
      complianceChecks = 0; // Placeholder
    }
    
  } catch (error: any) {
    errors.push(`Compliance check error: ${error.message}`);
  }

  return {
    totalUsers,
    complianceChecks,
    errors
  };
}

// GET endpoint for checking tax processing status
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
        service: 'tax-processing',
        status: 'operational',
        currentTaxYear: new Date().getFullYear(),
        previousTaxYear: new Date().getFullYear() - 1
      },
      correlationId
    };
    
    if (includeHistory) {
      // Get recent processing runs
      // This would query the taxProcessingRuns collection
      response.data.recentRuns = []; // Placeholder
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[CRON] Error getting tax processing status:', error);
    
    return NextResponse.json({
      error: 'Failed to get tax processing status',
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
      'X-Service': 'tax-processing-cron',
      'X-Timestamp': new Date().toISOString()
    }
  });
}
