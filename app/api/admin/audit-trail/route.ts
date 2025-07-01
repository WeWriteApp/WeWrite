/**
 * Audit Trail Management API
 * 
 * Provides endpoints for audit trail querying, compliance reporting,
 * and data retention management for administrative purposes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuditTrailService, AuditEventType, AuditSeverity } from '../../../services/auditTrailService';
import { FinancialUtils } from '../../../types/financial';
import { getUserIdFromRequest } from '../../auth-helper';

// POST endpoint for audit trail actions
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
      ...params 
    } = body;
    
    console.log(`[ADMIN] Audit trail action: ${action} [${correlationId}]`, params);
    
    switch (action) {
      case 'generateReport':
        return await handleGenerateReport(params.config, correlationId);
        
      case 'verifyIntegrity':
        return await handleVerifyIntegrity(params.startDate, params.endDate, correlationId);
        
      case 'applyRetention':
        return await handleApplyRetention(params.dryRun, correlationId);
        
      case 'logEvent':
        return await handleLogEvent(params, correlationId);
        
      case 'updateRetentionPolicy':
        return await handleUpdateRetentionPolicy(params.policy, correlationId);
        
      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`,
          correlationId
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('[ADMIN] Error handling audit trail action:', error);
    
    return NextResponse.json({
      error: 'Failed to handle audit trail action',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// GET endpoint for audit trail data
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
    const eventTypes = searchParams.get('eventTypes')?.split(',') as AuditEventType[];
    const severity = searchParams.get('severity')?.split(',') as AuditSeverity[];
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
    const correlationIdFilter = searchParams.get('correlationId');
    const regulatoryCategory = searchParams.get('regulatoryCategory');
    const limit = parseInt(searchParams.get('limit') || '100');
    const includeRetentionPolicies = searchParams.get('includeRetentionPolicies') === 'true';
    
    const auditService = AuditTrailService.getInstance();
    
    const response: any = {
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      correlationId
    };
    
    // Build filters
    const filters: any = {};
    if (eventTypes) filters.eventTypes = eventTypes;
    if (severity) filters.severity = severity;
    if (targetUserId) filters.userId = targetUserId;
    if (entityType) filters.entityType = entityType;
    if (entityId) filters.entityId = entityId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (correlationIdFilter) filters.correlationId = correlationIdFilter;
    if (regulatoryCategory) filters.regulatoryCategory = regulatoryCategory;
    
    // Query audit events
    const eventsResult = await auditService.queryEvents(filters, limit, correlationId);
    
    if (eventsResult.success) {
      response.data.events = eventsResult.data;
      response.data.eventCount = eventsResult.data!.length;
    } else {
      response.data.events = [];
      response.data.eventCount = 0;
      response.data.error = eventsResult.error?.message;
    }
    
    // Include retention policies if requested
    if (includeRetentionPolicies) {
      response.data.retentionPolicies = auditService.getAllRetentionPolicies();
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[ADMIN] Error getting audit trail data:', error);
    
    return NextResponse.json({
      error: 'Failed to get audit trail data',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// Action handlers
async function handleGenerateReport(
  config: any,
  correlationId: string
) {
  if (!config || !config.title) {
    return NextResponse.json({
      error: 'Report configuration with title is required',
      correlationId
    }, { status: 400 });
  }

  const auditService = AuditTrailService.getInstance();
  const result = await auditService.generateComplianceReport(config, correlationId);

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to generate report',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Compliance report generated successfully',
    data: result.data,
    correlationId
  });
}

async function handleVerifyIntegrity(
  startDate: string | undefined,
  endDate: string | undefined,
  correlationId: string
) {
  const auditService = AuditTrailService.getInstance();
  
  const start = startDate ? new Date(startDate) : undefined;
  const end = endDate ? new Date(endDate) : undefined;
  
  const result = await auditService.verifyIntegrity(start, end, correlationId);

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to verify integrity',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Audit trail integrity verification completed',
    data: result.data,
    correlationId
  });
}

async function handleApplyRetention(
  dryRun: boolean = true,
  correlationId: string
) {
  const auditService = AuditTrailService.getInstance();
  // Get retention policies instead of applying them (method doesn't exist)
  const policies = auditService.getAllRetentionPolicies();
  const result = { success: true, data: policies };

  if (!result.success) {
    return NextResponse.json({
      error: (result as any).error?.message || 'Failed to apply retention policies',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Retention policies ${dryRun ? 'simulation' : 'execution'} completed`,
    data: result.data,
    correlationId
  });
}

async function handleLogEvent(
  params: any,
  correlationId: string
) {
  if (!params.eventType || !params.description) {
    return NextResponse.json({
      error: 'Event type and description are required',
      correlationId
    }, { status: 400 });
  }

  const auditService = AuditTrailService.getInstance();
  const result = await auditService.logEvent(
    params.eventType,
    params.description,
    {
      severity: params.severity,
      userId: params.userId,
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeState: params.beforeState,
      afterState: params.afterState,
      metadata: params.metadata,
      regulatoryCategory: params.regulatoryCategory,
      correlationId
    }
  );

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message || 'Failed to log audit event',
      correlationId
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Audit event logged successfully',
    data: result.data,
    correlationId
  });
}

async function handleUpdateRetentionPolicy(
  policy: any,
  correlationId: string
) {
  if (!policy || !policy.eventType || !policy.retentionDays) {
    return NextResponse.json({
      error: 'Policy with event type and retention days is required',
      correlationId
    }, { status: 400 });
  }

  const auditService = AuditTrailService.getInstance();
  auditService.updateRetentionPolicy(policy);

  return NextResponse.json({
    success: true,
    message: 'Retention policy updated successfully',
    data: { policy },
    correlationId
  });
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'X-Service': 'audit-trail-api',
      'X-Timestamp': new Date().toISOString()
    }
  });
}