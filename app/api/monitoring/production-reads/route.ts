import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getProductionAnalysis, exportProductionData, productionReadMonitor } from '../../../utils/productionReadMonitor';

/**
 * Production Database Read Monitoring API
 * 
 * Provides real-time analysis of production Firebase reads to identify
 * the root causes of the 25k reads/minute spikes and optimization opportunities.
 */

/**
 * GET /api/monitoring/production-reads
 * Get production read analysis and patterns
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Require admin access for production monitoring
    // const userId = await getUserIdFromRequest(request);
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'analysis';

    switch (action) {
      case 'analysis':
        const analysis = getProductionAnalysis();
        return NextResponse.json({
          success: true,
          analysis,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
          productionMonitoring: process.env.NODE_ENV === 'production' || process.env.ENABLE_PRODUCTION_MONITORING === 'true'
        });

      case 'export':
        const exportData = exportProductionData();
        return NextResponse.json({
          success: true,
          data: exportData,
          timestamp: new Date().toISOString()
        });

      case 'recent-events':
        const limit = parseInt(searchParams.get('limit') || '100');
        const recentEvents = productionReadMonitor.getRecentEvents(limit);
        return NextResponse.json({
          success: true,
          events: recentEvents,
          count: recentEvents.length,
          timestamp: new Date().toISOString()
        });

      case 'summary':
        const summaryAnalysis = getProductionAnalysis();
        return NextResponse.json({
          success: true,
          summary: {
            totalReads: summaryAnalysis.totalReads,
            readsPerMinute: summaryAnalysis.readsPerMinute,
            uniqueUsers: summaryAnalysis.uniqueUsers,
            topEndpoints: summaryAnalysis.topEndpoints.slice(0, 5),
            suspiciousPatterns: summaryAnalysis.suspiciousPatterns.length,
            costEstimate: summaryAnalysis.costEstimate,
            criticalIssues: summaryAnalysis.suspiciousPatterns.filter(p => p.peakReadsPerMinute > 500).length
          },
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['analysis', 'export', 'recent-events', 'summary']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in production reads monitoring:', error);
    return NextResponse.json({
      error: 'Failed to get production read analysis',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/production-reads
 * Trigger specific monitoring actions
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, ...params } = await request.json();

    switch (action) {
      case 'clear':
        productionReadMonitor.clear();
        return NextResponse.json({
          success: true,
          message: 'Production read monitor cleared',
          timestamp: new Date().toISOString()
        });

      case 'analyze-endpoint':
        const { endpoint } = params;
        if (!endpoint) {
          return NextResponse.json({ error: 'Endpoint parameter required' }, { status: 400 });
        }

        const analysis = getProductionAnalysis();
        const endpointAnalysis = analysis.topEndpoints.find(e => e.endpoint === endpoint);
        
        if (!endpointAnalysis) {
          return NextResponse.json({ error: 'Endpoint not found in recent data' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          endpoint: endpointAnalysis,
          recommendations: endpointAnalysis.recommendations,
          timestamp: new Date().toISOString()
        });

      case 'get-optimization-plan':
        const fullAnalysis = getProductionAnalysis();
        const optimizationPlan = generateOptimizationPlan(fullAnalysis);
        
        return NextResponse.json({
          success: true,
          optimizationPlan,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['clear', 'analyze-endpoint', 'get-optimization-plan']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in production reads monitoring POST:', error);
    return NextResponse.json({
      error: 'Failed to execute monitoring action',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

/**
 * Generate optimization plan based on production analysis
 */
function generateOptimizationPlan(analysis: any) {
  const plan = {
    priority: 'HIGH',
    estimatedSavings: {
      readsPerMinute: 0,
      costPerMonth: 0
    },
    actions: [] as any[]
  };

  // High-priority optimizations
  analysis.suspiciousPatterns.forEach((pattern: any) => {
    if (pattern.peakReadsPerMinute > 500) {
      plan.actions.push({
        priority: 'CRITICAL',
        endpoint: pattern.endpoint,
        issue: `${pattern.peakReadsPerMinute.toFixed(0)} reads/minute`,
        action: 'Implement aggressive caching with 15+ minute TTL',
        estimatedSavings: pattern.peakReadsPerMinute * 0.8 // 80% reduction
      });
      plan.estimatedSavings.readsPerMinute += pattern.peakReadsPerMinute * 0.8;
    }
  });

  // Cache hit rate improvements
  analysis.optimizationOpportunities.lowCacheHitRateEndpoints.forEach((endpoint: string) => {
    const pattern = analysis.topEndpoints.find((p: any) => p.endpoint === endpoint);
    if (pattern) {
      plan.actions.push({
        priority: 'HIGH',
        endpoint,
        issue: `${pattern.cacheHitRate.toFixed(1)}% cache hit rate`,
        action: 'Increase cache TTL and implement background refresh',
        estimatedSavings: pattern.totalReads * 0.5 // 50% reduction
      });
      plan.estimatedSavings.readsPerMinute += (pattern.totalReads * 0.5) / 60;
    }
  });

  // Request deduplication opportunities
  analysis.optimizationOpportunities.redundantQueries.forEach((endpoint: string) => {
    const pattern = analysis.topEndpoints.find((p: any) => p.endpoint === endpoint);
    if (pattern && pattern.avgReadsPerUser > 10) {
      plan.actions.push({
        priority: 'MEDIUM',
        endpoint,
        issue: `${pattern.avgReadsPerUser.toFixed(1)} reads per user`,
        action: 'Implement request deduplication for rapid navigation',
        estimatedSavings: pattern.totalReads * 0.3 // 30% reduction
      });
      plan.estimatedSavings.readsPerMinute += (pattern.totalReads * 0.3) / 60;
    }
  });

  // Calculate cost savings
  const costPerRead = 0.00036 / 1000;
  plan.estimatedSavings.costPerMonth = plan.estimatedSavings.readsPerMinute * 60 * 24 * 30 * costPerRead;

  // Sort actions by priority and estimated savings
  plan.actions.sort((a, b) => {
    const priorityOrder = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
    
    if (aPriority !== bPriority) return bPriority - aPriority;
    return b.estimatedSavings - a.estimatedSavings;
  });

  return plan;
}
