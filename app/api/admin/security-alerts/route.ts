/**
 * Security Alerts API
 * 
 * Provides security alert management for the monitoring dashboard
 * including fraud alerts, compliance violations, and system security events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FinancialUtils } from '../../../types/financial';
import { getUserIdFromRequest } from '../../auth-helper';
import { db } from '../../../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  updateDoc, 
  doc,
  serverTimestamp 
} from 'firebase/firestore';

interface SecurityAlert {
  id: string;
  type: 'fraud' | 'compliance' | 'audit' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  status: 'open' | 'investigating' | 'resolved';
  userId?: string;
  metadata?: Record<string, any>;
}

// GET endpoint for security alerts
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
    const alertType = searchParams.get('type');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const limitCount = parseInt(searchParams.get('limit') || '50');
    
    console.log(`[ADMIN] Security alerts request [${correlationId}]`, {
      type: alertType,
      severity,
      status,
      limit: limitCount
    });
    
    // Gather alerts from all sources
    const alerts = await gatherSecurityAlerts({
      type: alertType,
      severity,
      status,
      limit: limitCount
    }, correlationId);
    
    return NextResponse.json({
      success: true,
      data: alerts,
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[ADMIN] Error getting security alerts:', error);
    
    return NextResponse.json({
      error: 'Failed to get security alerts',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

// POST endpoint for alert management actions
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

    const body = await request.json();
    const { action, alertId, status, notes } = body;
    
    console.log(`[ADMIN] Security alert action: ${action} [${correlationId}]`, {
      alertId,
      status,
      notes
    });
    
    switch (action) {
      case 'updateStatus':
        return await handleUpdateAlertStatus(alertId, status, notes, userId, correlationId);
        
      case 'bulkUpdate':
        return await handleBulkUpdateAlerts(body.alertIds, status, notes, userId, correlationId);
        
      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`,
          correlationId
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('[ADMIN] Error handling security alert action:', error);
    
    return NextResponse.json({
      error: 'Failed to handle security alert action',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

async function gatherSecurityAlerts(
  filters: {
    type?: string | null;
    severity?: string | null;
    status?: string | null;
    limit: number;
  },
  correlationId: string
): Promise<SecurityAlert[]> {
  const alerts: SecurityAlert[] = [];

  try {
    // Get fraud alerts
    const fraudAlerts = await getFraudAlerts(filters, correlationId);
    alerts.push(...fraudAlerts);

    // Get compliance alerts
    const complianceAlerts = await getComplianceAlerts(filters, correlationId);
    alerts.push(...complianceAlerts);

    // Get audit alerts
    const auditAlerts = await getAuditAlerts(filters, correlationId);
    alerts.push(...auditAlerts);

    // Get system alerts
    const systemAlerts = await getSystemAlerts(filters, correlationId);
    alerts.push(...systemAlerts);

    // Sort by timestamp (newest first) and apply limit
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return alerts.slice(0, filters.limit);
  } catch (error) {
    console.error('Error gathering security alerts:', error);
    return [];
  }
}

async function getFraudAlerts(
  filters: any,
  correlationId: string
): Promise<SecurityAlert[]> {
  try {
    let fraudQuery = collection(db, 'fraudAlerts');
    const constraints: any[] = [];

    // Apply filters
    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }

    constraints.push(orderBy('triggeredAt', 'desc'));
    constraints.push(limit(Math.min(filters.limit, 100)));

    const finalQuery = query(fraudQuery, ...constraints);
    const querySnapshot = await getDocs(finalQuery);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: 'fraud' as const,
        severity: mapFraudSeverity(data.severity),
        title: `Fraud Alert: ${data.description || 'Suspicious Activity Detected'}`,
        description: data.description || 'Suspicious activity detected by fraud detection system',
        timestamp: data.triggeredAt?.toDate() || new Date(),
        status: data.status || 'open',
        userId: data.userId,
        metadata: {
          riskScore: data.riskScore,
          triggeredRules: data.metadata?.triggeredRules || []
        }
      };
    });
  } catch (error) {
    console.error('Error getting fraud alerts:', error);
    return [];
  }
}

async function getComplianceAlerts(
  filters: any,
  correlationId: string
): Promise<SecurityAlert[]> {
  try {
    // Get compliance reviews that are overdue or have issues
    const reviewsQuery = query(
      collection(db, 'complianceReviews'),
      where('status', '==', 'scheduled'),
      orderBy('scheduledDate', 'desc'),
      limit(50)
    );

    const reviewsSnapshot = await getDocs(reviewsQuery);
    const alerts: SecurityAlert[] = [];

    reviewsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const scheduledDate = data.scheduledDate?.toDate();
      const isOverdue = scheduledDate && scheduledDate < new Date();

      if (isOverdue) {
        alerts.push({
          id: doc.id,
          type: 'compliance' as const,
          severity: 'medium' as const,
          title: `Overdue Compliance Review: ${data.framework}`,
          description: `Compliance review for ${data.framework} is overdue`,
          timestamp: scheduledDate,
          status: 'open' as const,
          userId: data.userId,
          metadata: {
            framework: data.framework,
            scheduledDate: scheduledDate.toISOString()
          }
        });
      }
    });

    return alerts;
  } catch (error) {
    console.error('Error getting compliance alerts:', error);
    return [];
  }
}

async function getAuditAlerts(
  filters: any,
  correlationId: string
): Promise<SecurityAlert[]> {
  try {
    // Get audit events with critical severity
    const auditQuery = query(
      collection(db, 'auditTrail'),
      where('severity', '==', 'critical'),
      orderBy('timestamp', 'desc'),
      limit(25)
    );

    const auditSnapshot = await getDocs(auditQuery);

    return auditSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: 'audit' as const,
        severity: 'high' as const,
        title: `Critical Audit Event: ${data.eventType}`,
        description: data.description || 'Critical audit event detected',
        timestamp: data.timestamp?.toDate() || new Date(),
        status: 'open' as const,
        userId: data.userId,
        metadata: {
          eventType: data.eventType,
          regulatoryCategory: data.regulatoryCategory
        }
      };
    });
  } catch (error) {
    console.error('Error getting audit alerts:', error);
    return [];
  }
}

async function getSystemAlerts(
  filters: any,
  correlationId: string
): Promise<SecurityAlert[]> {
  try {
    // Get system error events
    const systemQuery = query(
      collection(db, 'auditTrail'),
      where('eventType', '==', 'system_error'),
      orderBy('timestamp', 'desc'),
      limit(25)
    );

    const systemSnapshot = await getDocs(systemQuery);

    return systemSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: 'system' as const,
        severity: mapAuditSeverity(data.severity),
        title: `System Alert: ${data.description}`,
        description: data.description || 'System error detected',
        timestamp: data.timestamp?.toDate() || new Date(),
        status: 'open' as const,
        metadata: {
          eventType: data.eventType,
          correlationId: data.correlationId
        }
      };
    });
  } catch (error) {
    console.error('Error getting system alerts:', error);
    return [];
  }
}

async function handleUpdateAlertStatus(
  alertId: string,
  status: string,
  notes: string,
  adminUserId: string,
  correlationId: string
) {
  try {
    // Update fraud alert if it exists
    try {
      await updateDoc(doc(db, 'fraudAlerts', alertId), {
        status,
        resolvedAt: status === 'resolved' ? serverTimestamp() : null,
        resolvedBy: status === 'resolved' ? adminUserId : null,
        notes: notes || null,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      // Alert might not be a fraud alert, try other collections
    }

    return NextResponse.json({
      success: true,
      message: 'Alert status updated successfully',
      correlationId
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to update alert status',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

async function handleBulkUpdateAlerts(
  alertIds: string[],
  status: string,
  notes: string,
  adminUserId: string,
  correlationId: string
) {
  try {
    const updatePromises = alertIds.map(alertId => 
      handleUpdateAlertStatus(alertId, status, notes, adminUserId, correlationId)
    );

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: `${alertIds.length} alerts updated successfully`,
      correlationId
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to bulk update alerts',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

function mapFraudSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (severity) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'medium': return 'medium';
    default: return 'low';
  }
}

function mapAuditSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (severity) {
    case 'critical': return 'critical';
    case 'error': return 'high';
    case 'warning': return 'medium';
    default: return 'low';
  }
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'X-Service': 'security-alerts-api',
      'X-Timestamp': new Date().toISOString()
    }
  });
}