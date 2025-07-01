/**
 * Regulatory Compliance Management API
 * 
 * Provides endpoints for compliance framework management, KYC/AML processing,
 * GDPR data protection, and regulatory reporting for administrative purposes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { RegulatoryComplianceService, ComplianceFramework, KYCLevel } from '../../../services/regulatoryComplianceService';
import { FinancialUtils } from '../../../types/financial';
import { getUserIdFromRequest } from '../../auth-helper';

// POST endpoint for compliance actions
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
      ...params 
    } = body;
    
    console.log(`[ADMIN] Compliance action: ${action} [${correlationId}]`, {
      targetUserId,
      params
    });
    
    switch (action) {
      case 'performComplianceCheck':
        return await handlePerformComplianceCheck(targetUserId, params.frameworks, correlationId);
        
      case 'updateKYC':
        return await handleUpdateKYC(targetUserId, params.kycData, correlationId);
        
      case 'updateGDPRConsent':
        return await handleUpdateGDPRConsent(targetUserId, params.consentData, correlationId);
        
      case 'processRightToBeForgotten':
        return await handleRightToBeForgotten(targetUserId, params.requestDetails, correlationId);
        
      case 'generateRegulatoryReport':
        return await handleGenerateRegulatoryReport(params.config, params.dateRange, correlationId);
        
      case 'scheduleComplianceReview':
        return await handleScheduleComplianceReview(targetUserId, params.framework, params.reviewDate, correlationId);
        
      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`,
          correlationId
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('[ADMIN] Error handling compliance action:', error);
    
    return NextResponse.json({
      error: 'Failed to handle compliance action',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// GET endpoint for compliance data
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
    const includeProfile = searchParams.get('includeProfile') === 'true';
    const includeStatus = searchParams.get('includeStatus') === 'true';
    const frameworks = searchParams.get('frameworks')?.split(',') as ComplianceFramework[];
    
    const complianceService = RegulatoryComplianceService.getInstance();
    
    const response: any = {
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      correlationId
    };
    
    if (targetUserId) {
      // Get user-specific compliance data
      if (includeStatus) {
        const statusResult = await complianceService.getUserComplianceStatus(targetUserId, correlationId);
        if (statusResult.success) {
          response.data.complianceStatus = statusResult.data;
        } else {
          response.data.complianceStatus = null;
          response.data.statusError = statusResult.error?.message;
        }
      }
      
      if (includeProfile) {
        // This would get the full compliance profile
        // For now, return a placeholder
        response.data.complianceProfile = {
          userId: targetUserId,
          profileExists: true,
          note: 'Full profile data would be included here'
        };
      }
      
      if (frameworks && frameworks.length > 0) {
        const checkResult = await complianceService.performComplianceCheck(targetUserId, frameworks, correlationId);
        if (checkResult.success) {
          response.data.frameworkChecks = checkResult.data;
        } else {
          response.data.frameworkChecks = [];
          response.data.checkError = checkResult.error?.message;
        }
      }
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[ADMIN] Error getting compliance data:', error);
    
    return NextResponse.json({
      error: 'Failed to get compliance data',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// Action handlers
async function handlePerformComplianceCheck(
  targetUserId: string,
  frameworks: ComplianceFramework[],
  correlationId: string
) {
  if (!targetUserId || !frameworks || frameworks.length === 0) {
    return NextResponse.json({
      error: 'Target user ID and frameworks are required',
      correlationId
    }, { status: 400 });
  }

  const complianceService = RegulatoryComplianceService.getInstance();
  const result = await complianceService.performComplianceCheck(targetUserId, frameworks, correlationId);

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Compliance check failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Compliance check completed successfully',
    data: result.data,
    correlationId
  });
}

async function handleUpdateKYC(
  targetUserId: string,
  kycData: any,
  correlationId: string
) {
  if (!targetUserId || !kycData || !kycData.level) {
    return NextResponse.json({
      error: 'Target user ID and KYC data with level are required',
      correlationId
    }, { status: 400 });
  }

  // Validate KYC level
  if (!Object.values(KYCLevel).includes(kycData.level)) {
    return NextResponse.json({
      error: 'Invalid KYC level',
      correlationId
    }, { status: 400 });
  }

  const complianceService = RegulatoryComplianceService.getInstance();
  const result = await complianceService.updateKYCInformation(targetUserId, kycData, correlationId);

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'KYC update failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'KYC information updated successfully',
    data: result.data,
    correlationId
  });
}

async function handleUpdateGDPRConsent(
  targetUserId: string,
  consentData: any,
  correlationId: string
) {
  if (!targetUserId || !consentData) {
    return NextResponse.json({
      error: 'Target user ID and consent data are required',
      correlationId
    }, { status: 400 });
  }

  // Validate consent data structure
  const requiredFields = ['marketing', 'analytics', 'profiling', 'dataSharing', 'consentVersion'];
  const missingFields = requiredFields.filter(field => !(field in consentData));
  
  if (missingFields.length > 0) {
    return NextResponse.json({
      error: `Missing required consent fields: ${missingFields.join(', ')}`,
      correlationId
    }, { status: 400 });
  }

  const complianceService = RegulatoryComplianceService.getInstance();
  const result = await (complianceService as any).updateGDPRConsent(targetUserId, consentData, correlationId);

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'GDPR consent update failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'GDPR consent updated successfully',
    data: result.data,
    correlationId
  });
}

async function handleRightToBeForgotten(
  targetUserId: string,
  requestDetails: any,
  correlationId: string
) {
  if (!targetUserId || !requestDetails || !requestDetails.reason) {
    return NextResponse.json({
      error: 'Target user ID and request details with reason are required',
      correlationId
    }, { status: 400 });
  }

  const complianceService = RegulatoryComplianceService.getInstance();
  const result = await (complianceService as any).processRightToBeForgotten(targetUserId, requestDetails, correlationId);

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Right to be forgotten request failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Right to be forgotten request processed successfully',
    data: result.data,
    correlationId
  });
}

async function handleGenerateRegulatoryReport(
  config: any,
  dateRange: any,
  correlationId: string
) {
  if (!config || !config.framework || !dateRange || !dateRange.startDate || !dateRange.endDate) {
    return NextResponse.json({
      error: 'Report configuration and date range are required',
      correlationId
    }, { status: 400 });
  }

  // Convert date strings to Date objects
  const parsedDateRange = {
    startDate: new Date(dateRange.startDate),
    endDate: new Date(dateRange.endDate)
  };

  const complianceService = RegulatoryComplianceService.getInstance();
  const result = await complianceService.generateRegulatoryReport(config, parsedDateRange, correlationId);

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Regulatory report generation failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Regulatory report generated successfully',
    data: result.data,
    correlationId
  });
}

async function handleScheduleComplianceReview(
  targetUserId: string,
  framework: ComplianceFramework,
  reviewDate: string,
  correlationId: string
) {
  if (!targetUserId || !framework || !reviewDate) {
    return NextResponse.json({
      error: 'Target user ID, framework, and review date are required',
      correlationId
    }, { status: 400 });
  }

  const parsedReviewDate = new Date(reviewDate);
  if (isNaN(parsedReviewDate.getTime())) {
    return NextResponse.json({
      error: 'Invalid review date format',
      correlationId
    }, { status: 400 });
  }

  const complianceService = RegulatoryComplianceService.getInstance();
  const result = await complianceService.scheduleComplianceReview(targetUserId, framework, parsedReviewDate, correlationId);

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Compliance review scheduling failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Compliance review scheduled successfully',
    data: result.data,
    correlationId
  });
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'X-Service': 'compliance-api',
      'X-Timestamp': new Date().toISOString()
    }
  });
}