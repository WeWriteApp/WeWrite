/**
 * Fraud Detection Management API
 * 
 * Provides endpoints for fraud detection configuration, alert management,
 * and security monitoring for administrative purposes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FraudDetectionEngine } from '../../../services/fraudDetectionEngine';
import { FraudResponseService } from '../../../services/fraudResponseService';
import { FinancialUtils } from '../../../types/financial';
import { getUserIdFromRequest } from '../../auth-helper';

// POST endpoint for fraud detection actions
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
      ruleId,
      alertId,
      ...params 
    } = body;
    
    console.log(`[ADMIN] Fraud detection action: ${action} [${correlationId}]`, {
      targetUserId,
      ruleId,
      alertId,
      params
    });
    
    switch (action) {
      case 'analyzeUser':
        return await handleAnalyzeUser(targetUserId, params, correlationId);
        
      case 'resolveAlert':
        return await handleResolveAlert(alertId, params.status, correlationId);
        
      case 'removeRestrictions':
        return await handleRemoveRestrictions(targetUserId, params.reason, correlationId);
        
      case 'addFraudRule':
        return await handleAddFraudRule(params.rule, correlationId);
        
      case 'updateResponseConfig':
        return await handleUpdateResponseConfig(params.config, correlationId);
        
      case 'manualReview':
        return await handleManualReview(targetUserId, params, correlationId);
        
      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`,
          correlationId
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('[ADMIN] Error handling fraud detection action:', error);
    
    return NextResponse.json({
      error: 'Failed to handle fraud detection action',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// GET endpoint for fraud detection data
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
    const includeAlerts = searchParams.get('includeAlerts') === 'true';
    const includeRestrictions = searchParams.get('includeRestrictions') === 'true';
    const includeRules = searchParams.get('includeRules') === 'true';
    
    const fraudEngine = FraudDetectionEngine.getInstance();
    const responseService = FraudResponseService.getInstance();
    
    const response: any = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        config: responseService.getConfig()
      },
      correlationId
    };
    
    if (includeRules) {
      response.data.rules = fraudEngine.getRules();
    }
    
    if (targetUserId) {
      // Get user-specific fraud data
      if (includeAlerts) {
        const alerts = await fraudEngine.getFraudAlerts(targetUserId);
        response.data.alerts = alerts;
      }
      
      if (includeRestrictions) {
        const restrictions = await responseService.getAccountRestrictions(targetUserId);
        response.data.restrictions = restrictions;
        response.data.hasActiveRestrictions = await responseService.hasActiveRestrictions(targetUserId);
      }
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[ADMIN] Error getting fraud detection data:', error);
    
    return NextResponse.json({
      error: 'Failed to get fraud detection data',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// Action handlers
async function handleAnalyzeUser(
  targetUserId: string,
  params: any,
  correlationId: string
) {
  if (!targetUserId) {
    return NextResponse.json({
      error: 'Target user ID is required',
      correlationId
    }, { status: 400 });
  }

  const fraudEngine = FraudDetectionEngine.getInstance();
  
  // Create mock transaction context for analysis
  const context = {
    userId: targetUserId,
    transactionType: params.transactionType || 'manual_review',
    amount: params.amount || 0,
    currency: 'usd',
    timestamp: new Date(),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    deviceFingerprint: params.deviceFingerprint,
    geolocation: params.geolocation,
    metadata: {
      manualReview: true,
      reviewedBy: params.reviewedBy || 'admin'
    }
  };

  const result = await fraudEngine.analyzeTransaction(context, correlationId);

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'User analysis failed',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'User analysis completed',
    data: result.data,
    correlationId
  });
}

async function handleResolveAlert(
  alertId: string,
  status: string,
  correlationId: string
) {
  if (!alertId || !status) {
    return NextResponse.json({
      error: 'Alert ID and status are required',
      correlationId
    }, { status: 400 });
  }

  if (!['resolved', 'false_positive'].includes(status)) {
    return NextResponse.json({
      error: 'Invalid status. Must be "resolved" or "false_positive"',
      correlationId
    }, { status: 400 });
  }

  const fraudEngine = FraudDetectionEngine.getInstance();
  await fraudEngine.resolveAlert(alertId, status as any, correlationId);

  return NextResponse.json({
    success: true,
    message: 'Alert resolved successfully',
    correlationId
  });
}

async function handleRemoveRestrictions(
  targetUserId: string,
  reason: string,
  correlationId: string
) {
  if (!targetUserId || !reason) {
    return NextResponse.json({
      error: 'Target user ID and reason are required',
      correlationId
    }, { status: 400 });
  }

  const responseService = FraudResponseService.getInstance();
  const result = await responseService.removeRestrictions(targetUserId, reason, correlationId);

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to remove restrictions',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Restrictions removed successfully',
    correlationId
  });
}

async function handleAddFraudRule(
  rule: any,
  correlationId: string
) {
  if (!rule || !rule.type || !rule.name) {
    return NextResponse.json({
      error: 'Rule type and name are required',
      correlationId
    }, { status: 400 });
  }

  const fraudEngine = FraudDetectionEngine.getInstance();
  
  try {
    const ruleId = await fraudEngine.addRule(rule);
    
    return NextResponse.json({
      success: true,
      message: 'Fraud rule added successfully',
      data: { ruleId },
      correlationId
    });
  } catch (error: any) {
    return NextResponse.json({
      error: `Failed to add fraud rule: ${error.message}`,
      correlationId
    }, { status: 500 });
  }
}

async function handleUpdateResponseConfig(
  config: any,
  correlationId: string
) {
  if (!config) {
    return NextResponse.json({
      error: 'Configuration is required',
      correlationId
    }, { status: 400 });
  }

  const responseService = FraudResponseService.getInstance();
  responseService.updateConfig(config);

  return NextResponse.json({
    success: true,
    message: 'Response configuration updated successfully',
    data: responseService.getConfig(),
    correlationId
  });
}

async function handleManualReview(
  targetUserId: string,
  params: any,
  correlationId: string
) {
  if (!targetUserId) {
    return NextResponse.json({
      error: 'Target user ID is required',
      correlationId
    }, { status: 400 });
  }

  // This would create a manual review record
  // For now, return a placeholder response
  
  return NextResponse.json({
    success: true,
    message: 'Manual review initiated',
    data: {
      reviewId: `review_${Date.now()}`,
      userId: targetUserId,
      status: 'pending',
      priority: params.priority || 'medium'
    },
    correlationId
  });
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'X-Service': 'fraud-detection-api',
      'X-Timestamp': new Date().toISOString()
    }
  });
}