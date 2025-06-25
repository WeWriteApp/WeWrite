/**
 * Tax Reporting API
 * 
 * Provides endpoints for tax document generation, compliance management,
 * and tax information collection for administrative purposes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TaxReportingService } from '../../../services/taxReportingService';
import { TaxInformationService } from '../../../services/taxInformationService';
import { FinancialUtils } from '../../../types/financial';
import { getUserIdFromRequest } from '../../auth-helper';

// POST endpoint for tax reporting actions
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
      taxYear,
      documentType,
      ...params 
    } = body;
    
    console.log(`[ADMIN] Tax reporting action: ${action} [${correlationId}]`, {
      targetUserId,
      taxYear,
      documentType,
      params
    });
    
    switch (action) {
      case 'generateTaxSummary':
        return await handleGenerateTaxSummary(targetUserId, taxYear, correlationId);
        
      case 'generate1099':
        return await handleGenerate1099(targetUserId, taxYear, correlationId);
        
      case 'generate1042':
        return await handleGenerate1042(targetUserId, taxYear, correlationId);
        
      case 'bulkGeneration':
        return await handleBulkGeneration(taxYear, documentType, correlationId);
        
      case 'validateCompliance':
        return await handleValidateCompliance(targetUserId, correlationId);
        
      case 'calculateWithholding':
        return await handleCalculateWithholding(targetUserId, params.amount, correlationId);
        
      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`,
          correlationId
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('[ADMIN] Error handling tax reporting action:', error);
    
    return NextResponse.json({
      error: 'Failed to handle tax reporting action',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// GET endpoint for tax reporting data
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
    const taxYear = searchParams.get('taxYear');
    const includeDocuments = searchParams.get('includeDocuments') === 'true';
    const includeCompliance = searchParams.get('includeCompliance') === 'true';
    
    const taxReportingService = TaxReportingService.getInstance();
    const taxInfoService = TaxInformationService.getInstance();
    
    const response: any = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        config: taxReportingService.getConfig()
      },
      correlationId
    };
    
    if (targetUserId) {
      // Get user-specific tax information
      const userTaxInfo = await taxInfoService.getUserTaxInfo(targetUserId);
      response.data.userTaxInfo = userTaxInfo;
      
      if (taxYear) {
        // Get tax summary for specific year
        const taxSummaryResult = await taxReportingService.generateAnnualTaxSummary(
          targetUserId,
          parseInt(taxYear),
          correlationId
        );
        
        if (taxSummaryResult.success) {
          response.data.taxSummary = taxSummaryResult.data;
        }
      }
      
      if (includeDocuments) {
        const formSubmissions = await taxInfoService.getTaxFormSubmissions(targetUserId);
        response.data.formSubmissions = formSubmissions;
      }
      
      if (includeCompliance) {
        const complianceResult = await taxInfoService.validateTaxCompliance(targetUserId, correlationId);
        response.data.compliance = complianceResult.data;
      }
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[ADMIN] Error getting tax reporting data:', error);
    
    return NextResponse.json({
      error: 'Failed to get tax reporting data',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// Action handlers
async function handleGenerateTaxSummary(
  targetUserId: string,
  taxYear: number,
  correlationId: string
) {
  if (!targetUserId || !taxYear) {
    return NextResponse.json({
      error: 'Target user ID and tax year are required',
      correlationId
    }, { status: 400 });
  }

  const taxReportingService = TaxReportingService.getInstance();
  const result = await taxReportingService.generateAnnualTaxSummary(
    targetUserId,
    taxYear,
    correlationId
  );

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to generate tax summary',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Tax summary generated successfully',
    data: result.data,
    correlationId
  });
}

async function handleGenerate1099(
  targetUserId: string,
  taxYear: number,
  correlationId: string
) {
  if (!targetUserId || !taxYear) {
    return NextResponse.json({
      error: 'Target user ID and tax year are required',
      correlationId
    }, { status: 400 });
  }

  const taxReportingService = TaxReportingService.getInstance();
  const result = await taxReportingService.generate1099NEC(
    targetUserId,
    taxYear,
    correlationId
  );

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to generate 1099-NEC',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: '1099-NEC generated successfully',
    data: result.data,
    correlationId
  });
}

async function handleGenerate1042(
  targetUserId: string,
  taxYear: number,
  correlationId: string
) {
  if (!targetUserId || !taxYear) {
    return NextResponse.json({
      error: 'Target user ID and tax year are required',
      correlationId
    }, { status: 400 });
  }

  const taxReportingService = TaxReportingService.getInstance();
  const result = await taxReportingService.generate1042S(
    targetUserId,
    taxYear,
    correlationId
  );

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to generate 1042-S',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: '1042-S generated successfully',
    data: result.data,
    correlationId
  });
}

async function handleBulkGeneration(
  taxYear: number,
  documentType: string | undefined,
  correlationId: string
) {
  if (!taxYear) {
    return NextResponse.json({
      error: 'Tax year is required',
      correlationId
    }, { status: 400 });
  }

  const taxReportingService = TaxReportingService.getInstance();
  const result = await taxReportingService.processBulkTaxGeneration(
    taxYear,
    documentType as any,
    correlationId
  );

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Bulk generation failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Bulk tax document generation completed',
    data: result.data,
    correlationId
  });
}

async function handleValidateCompliance(
  targetUserId: string,
  correlationId: string
) {
  if (!targetUserId) {
    return NextResponse.json({
      error: 'Target user ID is required',
      correlationId
    }, { status: 400 });
  }

  const taxInfoService = TaxInformationService.getInstance();
  const result = await taxInfoService.validateTaxCompliance(targetUserId, correlationId);

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Compliance validation failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Tax compliance validated',
    data: result.data,
    correlationId
  });
}

async function handleCalculateWithholding(
  targetUserId: string,
  amount: number,
  correlationId: string
) {
  if (!targetUserId || !amount) {
    return NextResponse.json({
      error: 'Target user ID and amount are required',
      correlationId
    }, { status: 400 });
  }

  const taxReportingService = TaxReportingService.getInstance();
  const result = await taxReportingService.calculateWithholding(
    targetUserId,
    amount,
    correlationId
  );

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Withholding calculation failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Withholding calculated successfully',
    data: result.data,
    correlationId
  });
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'X-Service': 'tax-reporting-api',
      'X-Timestamp': new Date().toISOString()
    }
  });
}
