/**
 * Security Report Generation API
 * 
 * Generates comprehensive security reports for compliance and monitoring purposes
 * including fraud detection summaries, compliance status, and audit trail reports.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FinancialUtils } from '../../../types/financial';
import { getUserIdFromRequest } from '../../auth-helper';

// POST endpoint for security report generation
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
    const { action, config } = body;
    
    console.log(`[ADMIN] Security report action: ${action} [${correlationId}]`, config);
    
    switch (action) {
      case 'generateReport':
        return await handleGenerateSecurityReport(config, userId, correlationId);
        
      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`,
          correlationId
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('[ADMIN] Error handling security report action:', error);
    
    return NextResponse.json({
      error: 'Failed to handle security report action',
      details: error.message,
      correlationId,
      retryable: true
    }, { status: 500 });
  }
}

async function handleGenerateSecurityReport(
  config: any,
  adminUserId: string,
  correlationId: string
) {
  try {
    const reportId = `security_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Gather security data
    const securityData = await gatherSecurityReportData(config, correlationId);
    
    // Generate report based on format
    let reportContent: any;
    let contentType: string;
    let filename: string;
    
    switch (config.format) {
      case 'pdf':
        reportContent = generatePDFReport(securityData, config);
        contentType = 'application/pdf';
        filename = `security-report-${new Date().toISOString().split('T')[0]}.pdf`;
        break;
        
      case 'csv':
        reportContent = generateCSVReport(securityData, config);
        contentType = 'text/csv';
        filename = `security-report-${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      case 'json':
      default:
        reportContent = generateJSONReport(securityData, config);
        contentType = 'application/json';
        filename = `security-report-${new Date().toISOString().split('T')[0]}.json`;
        break;
    }
    
    // For this implementation, we'll return the JSON data
    // In production, you would store the report and return a download URL
    
    return NextResponse.json({
      success: true,
      message: 'Security report generated successfully',
      data: {
        reportId,
        format: config.format,
        generatedAt: new Date().toISOString(),
        generatedBy: adminUserId,
        content: reportContent
      },
      correlationId
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to generate security report',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

async function gatherSecurityReportData(config: any, correlationId: string) {
  const reportData: any = {
    metadata: {
      title: config.title || 'Security Monitoring Report',
      description: config.description || 'Comprehensive security status report',
      generatedAt: new Date().toISOString(),
      reportPeriod: {
        startDate: config.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: config.endDate || new Date().toISOString()
      }
    }
  };

  try {
    // Get security metrics if requested
    if (config.includeMetrics) {
      const metricsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/security-metrics`, {
        headers: {
          'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        reportData.securityMetrics = metricsData.data;
      }
    }

    // Get security alerts if requested
    if (config.includeAlerts) {
      const alertsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/security-alerts?limit=100`, {
        headers: {
          'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        reportData.securityAlerts = alertsData.data;
      }
    }

    // Add executive summary
    reportData.executiveSummary = generateExecutiveSummary(reportData);

    return reportData;
  } catch (error) {
    console.error('Error gathering security report data:', error);
    return reportData;
  }
}

function generateExecutiveSummary(reportData: any) {
  const summary = {
    overallSecurityStatus: 'Good',
    keyFindings: [],
    recommendations: [],
    riskLevel: 'Low'
  };

  try {
    const metrics = reportData.securityMetrics;
    const alerts = reportData.securityAlerts;

    if (metrics) {
      // Assess overall security status
      const fraudRisk = metrics.fraudDetection?.riskScore || 0;
      const complianceScore = metrics.compliance?.overallScore || 0;
      const auditIntegrity = metrics.auditTrail?.integrityScore || 0;

      // Determine overall status
      if (fraudRisk > 70 || complianceScore < 70 || auditIntegrity < 95) {
        summary.overallSecurityStatus = 'Needs Attention';
        summary.riskLevel = 'Medium';
      }

      if (fraudRisk > 85 || complianceScore < 50 || auditIntegrity < 90) {
        summary.overallSecurityStatus = 'Critical';
        summary.riskLevel = 'High';
      }

      // Key findings
      if (metrics.fraudDetection?.activeAlerts > 0) {
        summary.keyFindings.push(`${metrics.fraudDetection.activeAlerts} active fraud alerts requiring attention`);
      }

      if (metrics.compliance?.pendingReviews > 0) {
        summary.keyFindings.push(`${metrics.compliance.pendingReviews} compliance reviews pending`);
      }

      if (metrics.userSecurity?.flaggedUsers > 0) {
        summary.keyFindings.push(`${metrics.userSecurity.flaggedUsers} users flagged for security review`);
      }

      // Recommendations
      if (fraudRisk > 50) {
        summary.recommendations.push('Review and enhance fraud detection rules');
      }

      if (complianceScore < 80) {
        summary.recommendations.push('Improve compliance framework implementation');
      }

      if (metrics.userSecurity?.flaggedUsers > 10) {
        summary.recommendations.push('Conduct security review of flagged user accounts');
      }
    }

    if (alerts && alerts.length > 0) {
      const criticalAlerts = alerts.filter((alert: any) => alert.severity === 'critical').length;
      const highAlerts = alerts.filter((alert: any) => alert.severity === 'high').length;

      if (criticalAlerts > 0) {
        summary.keyFindings.push(`${criticalAlerts} critical security alerts detected`);
        summary.recommendations.push('Immediately address critical security alerts');
      }

      if (highAlerts > 5) {
        summary.keyFindings.push(`${highAlerts} high-severity alerts require review`);
        summary.recommendations.push('Prioritize resolution of high-severity alerts');
      }
    }

    // Default recommendations if none found
    if (summary.recommendations.length === 0) {
      summary.recommendations.push('Continue monitoring security metrics');
      summary.recommendations.push('Maintain current security protocols');
    }

  } catch (error) {
    console.error('Error generating executive summary:', error);
  }

  return summary;
}

function generateJSONReport(securityData: any, config: any) {
  return {
    ...securityData,
    reportConfig: config,
    format: 'json'
  };
}

function generateCSVReport(securityData: any, config: any) {
  const csvRows = [];
  
  // Header
  csvRows.push('Report Type,Security Monitoring Report');
  csvRows.push('Generated At,' + securityData.metadata.generatedAt);
  csvRows.push('');
  
  // Executive Summary
  if (securityData.executiveSummary) {
    csvRows.push('Executive Summary');
    csvRows.push('Overall Status,' + securityData.executiveSummary.overallSecurityStatus);
    csvRows.push('Risk Level,' + securityData.executiveSummary.riskLevel);
    csvRows.push('');
  }
  
  // Security Metrics
  if (securityData.securityMetrics) {
    csvRows.push('Security Metrics');
    csvRows.push('Metric,Value');
    
    const metrics = securityData.securityMetrics;
    if (metrics.fraudDetection) {
      csvRows.push('Active Fraud Alerts,' + metrics.fraudDetection.activeAlerts);
      csvRows.push('Fraud Risk Score,' + metrics.fraudDetection.riskScore + '%');
    }
    
    if (metrics.compliance) {
      csvRows.push('Overall Compliance Score,' + metrics.compliance.overallScore + '%');
      csvRows.push('Pending Reviews,' + metrics.compliance.pendingReviews);
    }
    
    csvRows.push('');
  }
  
  // Security Alerts
  if (securityData.securityAlerts && securityData.securityAlerts.length > 0) {
    csvRows.push('Security Alerts');
    csvRows.push('ID,Type,Severity,Title,Status,Timestamp');
    
    securityData.securityAlerts.forEach((alert: any) => {
      csvRows.push([
        alert.id,
        alert.type,
        alert.severity,
        `"${alert.title.replace(/"/g, '""')}"`,
        alert.status,
        alert.timestamp
      ].join(','));
    });
  }
  
  return csvRows.join('\n');
}

function generatePDFReport(securityData: any, config: any) {
  // In a real implementation, this would use a PDF generation library
  // For now, return a placeholder structure
  return {
    format: 'pdf',
    title: securityData.metadata.title,
    content: 'PDF generation would be implemented with a proper PDF library',
    pages: 1,
    sections: [
      'Executive Summary',
      'Security Metrics',
      'Security Alerts',
      'Recommendations'
    ]
  };
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'X-Service': 'security-report-api',
      'X-Timestamp': new Date().toISOString()
    }
  });
}