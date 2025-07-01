/**
 * Security Metrics API
 * 
 * Provides aggregated security metrics for the monitoring dashboard
 * including fraud detection, compliance, audit trail, and user security data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FraudDetectionEngine } from '../../../services/fraudDetectionEngine';
import { RegulatoryComplianceService, ComplianceFramework } from '../../../services/regulatoryComplianceService';
import { AuditTrailService } from '../../../services/auditTrailService';
import { FinancialUtils } from '../../../types/financial';
import { getUserIdFromRequest } from '../../auth-helper';
import { db } from '../../../firebase/config';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

// GET endpoint for security metrics
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

    // TODO: Add admin role verification here
    
    console.log(`[ADMIN] Security metrics request [${correlationId}]`);
    
    // Gather metrics from all security services
    const metrics = await gatherSecurityMetrics(correlationId);
    
    return NextResponse.json({
      success: true,
      data: metrics,
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[ADMIN] Error getting security metrics:', error);
    
    return NextResponse.json({
      error: 'Failed to get security metrics',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

async function gatherSecurityMetrics(correlationId: string) {
  const fraudEngine = FraudDetectionEngine.getInstance();
  const complianceService = RegulatoryComplianceService.getInstance();
  const auditService = AuditTrailService.getInstance();

  // Fraud Detection Metrics
  const fraudMetrics = await getFraudDetectionMetrics(correlationId);
  
  // Compliance Metrics
  const complianceMetrics = await getComplianceMetrics(correlationId);
  
  // Audit Trail Metrics
  const auditMetrics = await getAuditTrailMetrics(correlationId);
  
  // User Security Metrics
  const userSecurityMetrics = await getUserSecurityMetrics(correlationId);

  return {
    fraudDetection: fraudMetrics,
    compliance: complianceMetrics,
    auditTrail: auditMetrics,
    userSecurity: userSecurityMetrics
  };
}

async function getFraudDetectionMetrics(correlationId: string) {
  try {
    // Get fraud alerts from last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const alertsQuery = query(
      collection(db, 'fraudAlerts'),
      where('triggeredAt', '>=', last24Hours),
      orderBy('triggeredAt', 'desc'),
      limit(1000)
    );

    const alertsSnapshot = await getDocs(alertsQuery);
    const alerts = alertsSnapshot.docs.map(doc => doc.data());

    const totalAlerts = alerts.length;
    const activeAlerts = alerts.filter(alert => alert.status === 'open').length;
    
    // Calculate average risk score
    const avgRiskScore = alerts.length > 0 
      ? Math.round(alerts.reduce((sum, alert) => sum + (alert.riskScore || 0), 0) / alerts.length)
      : 0;

    // Mock detection rate and false positive rate (would be calculated from historical data)
    const detectionRate = 95; // 95% detection rate
    const falsePositiveRate = 5; // 5% false positive rate

    return {
      totalAlerts,
      activeAlerts,
      riskScore: avgRiskScore,
      detectionRate,
      falsePositiveRate
    };
  } catch (error) {
    console.error('Error getting fraud detection metrics:', error);
    return {
      totalAlerts: 0,
      activeAlerts: 0,
      riskScore: 0,
      detectionRate: 0,
      falsePositiveRate: 0
    };
  }
}

async function getComplianceMetrics(correlationId: string) {
  try {
    // Get compliance profiles
    const profilesQuery = query(
      collection(db, 'userComplianceProfiles'),
      limit(1000)
    );

    const profilesSnapshot = await getDocs(profilesQuery);
    const profiles = profilesSnapshot.docs.map(doc => doc.data());

    // Calculate compliance scores
    let kycCompliant = 0;
    let gdprCompliant = 0;
    let pciCompliant = 0;
    let pendingReviews = 0;

    profiles.forEach(profile => {
      if (profile.kycStatus === 'compliant') kycCompliant++;
      if (profile.gdprConsent && profile.gdprConsent.consentDate) gdprCompliant++;
      // PCI compliance is system-level, assume compliant
      pciCompliant++;
      if (profile.kycStatus === 'pending_review') pendingReviews++;
    });

    const totalProfiles = profiles.length || 1; // Avoid division by zero

    return {
      overallScore: Math.round(((kycCompliant + gdprCompliant + pciCompliant) / (totalProfiles * 3)) * 100),
      kycCompliance: Math.round((kycCompliant / totalProfiles) * 100),
      gdprCompliance: Math.round((gdprCompliant / totalProfiles) * 100),
      pciCompliance: 100, // System-level compliance
      pendingReviews
    };
  } catch (error) {
    console.error('Error getting compliance metrics:', error);
    return {
      overallScore: 0,
      kycCompliance: 0,
      gdprCompliance: 0,
      pciCompliance: 0,
      pendingReviews: 0
    };
  }
}

async function getAuditTrailMetrics(correlationId: string) {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get recent audit events
    const recentEventsQuery = query(
      collection(db, 'auditTrail'),
      where('timestamp', '>=', last24Hours),
      orderBy('timestamp', 'desc'),
      limit(1000)
    );

    const recentEventsSnapshot = await getDocs(recentEventsQuery);
    const recentEvents = recentEventsSnapshot.docs.map(doc => doc.data());

    // Get total events count (approximate)
    const totalEventsQuery = query(
      collection(db, 'auditTrail'),
      limit(10000)
    );

    const totalEventsSnapshot = await getDocs(totalEventsQuery);
    const totalEvents = totalEventsSnapshot.size;

    // Mock integrity score (would be calculated by verifying hashes)
    const integrityScore = 100;
    
    // Mock retention compliance (would be calculated based on retention policies)
    const retentionCompliance = 98;

    return {
      totalEvents,
      last24Hours: recentEvents.length,
      integrityScore,
      retentionCompliance
    };
  } catch (error) {
    console.error('Error getting audit trail metrics:', error);
    return {
      totalEvents: 0,
      last24Hours: 0,
      integrityScore: 0,
      retentionCompliance: 0
    };
  }
}

async function getUserSecurityMetrics(correlationId: string) {
  try {
    // Get user statistics
    const usersQuery = query(
      collection(db, 'users'),
      limit(10000)
    );

    const usersSnapshot = await getDocs(usersQuery);
    const users = usersSnapshot.docs.map(doc => doc.data());

    const totalUsers = users.length;
    const verifiedUsers = users.filter(user => session.emailVerified).length;
    const suspendedUsers = users.filter(user => user.status === 'suspended').length;
    
    // Get flagged users from fraud system
    const flaggedUsersQuery = query(
      collection(db, 'userRiskProfiles'),
      where('riskLevel', 'in', ['high', 'critical']),
      limit(1000)
    );

    const flaggedUsersSnapshot = await getDocs(flaggedUsersQuery);
    const flaggedUsers = flaggedUsersSnapshot.size;

    return {
      totalUsers,
      verifiedUsers,
      suspendedUsers,
      flaggedUsers
    };
  } catch (error) {
    console.error('Error getting user security metrics:', error);
    return {
      totalUsers: 0,
      verifiedUsers: 0,
      suspendedUsers: 0,
      flaggedUsers: 0
    };
  }
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'X-Service': 'security-metrics-api',
      'X-Timestamp': new Date().toISOString()
    }
  });
}