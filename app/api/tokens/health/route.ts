/**
 * Financial System Health Check API
 * 
 * Provides comprehensive health monitoring for the token earnings and payout system
 * to ensure enterprise-grade reliability and early detection of issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FinancialOperationsService } from '../../../services/financialOperationsService';
import { FinancialUtils } from '../../../types/financial';

export async function GET(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Perform comprehensive health check
    const healthResult = await FinancialOperationsService.healthCheck(correlationId);
    
    if (healthResult.success && healthResult.data) {
      const { status, checks, timestamp } = healthResult.data;
      
      // Determine HTTP status code based on health status
      let httpStatus = 200;
      if (status === 'degraded') {
        httpStatus = 206; // Partial Content
      } else if (status === 'unhealthy') {
        httpStatus = 503; // Service Unavailable
      }
      
      return NextResponse.json({
        status,
        checks,
        timestamp,
        correlationId: healthResult.correlationId,
        message: `Financial system is ${status}`
      }, { status: httpStatus });
      
    } else {
      return NextResponse.json({
        status: 'unhealthy',
        error: healthResult.error?.message || 'Health check failed',
        correlationId: healthResult.correlationId,
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }
    
  } catch (error: any) {
    console.error('Health check endpoint error:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      error: 'Health check endpoint failed',
      details: error.message,
      correlationId,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * POST endpoint for detailed health diagnostics (admin only)
 */
export async function POST(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // This could be extended with admin authentication
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({
        error: 'Unauthorized - Admin access required',
        correlationId
      }, { status: 401 });
    }
    
    const body = await request.json();
    const { includeMetrics = false, testOperations = false } = body;
    
    // Perform basic health check
    const healthResult = await FinancialOperationsService.healthCheck(correlationId);
    
    const diagnostics: any = {
      basicHealth: healthResult.data,
      correlationId,
      timestamp: new Date().toISOString()
    };
    
    // Add additional metrics if requested
    if (includeMetrics) {
      diagnostics.metrics = {
        // This could be extended with actual metrics
        placeholder: 'Metrics collection not yet implemented'
      };
    }
    
    // Perform test operations if requested (be careful in production!)
    if (testOperations && process.env.NODE_ENV !== 'production') {
      diagnostics.testOperations = {
        warning: 'Test operations only available in non-production environments'
      };
    }
    
    return NextResponse.json({
      success: true,
      data: diagnostics,
      correlationId
    });
    
  } catch (error: any) {
    console.error('Health diagnostics endpoint error:', error);
    
    return NextResponse.json({
      error: 'Health diagnostics failed',
      details: error.message,
      correlationId,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
