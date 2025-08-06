import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getProductionAnalysis } from '../../../utils/productionReadMonitor';

/**
 * Production Database Optimization Report API
 * 
 * Provides comprehensive analysis and actionable recommendations
 * to reduce the 25k reads/minute spikes in production.
 */

interface OptimizationRecommendation {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'CACHING' | 'DEDUPLICATION' | 'BATCHING' | 'ARCHITECTURE';
  title: string;
  description: string;
  implementation: string;
  estimatedSavings: {
    readsPerMinute: number;
    costPerMonth: number;
  };
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * GET /api/monitoring/optimization-report
 * Generate comprehensive optimization report
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Require admin access
    // const userId = await getUserIdFromRequest(request);
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const analysis = getProductionAnalysis();
    const recommendations = generateOptimizationRecommendations(analysis);
    const implementationPlan = generateImplementationPlan(recommendations);

    return NextResponse.json({
      success: true,
      report: {
        summary: {
          currentReadsPerMinute: analysis.readsPerMinute,
          projectedSavings: calculateTotalSavings(recommendations),
          criticalIssues: recommendations.filter(r => r.priority === 'CRITICAL').length,
          quickWins: recommendations.filter(r => r.effort === 'LOW' && r.impact === 'HIGH').length
        },
        analysis: {
          totalReads: analysis.totalReads,
          uniqueUsers: analysis.uniqueUsers,
          topEndpoints: analysis.topEndpoints.slice(0, 10),
          suspiciousPatterns: analysis.suspiciousPatterns,
          costEstimate: analysis.costEstimate
        },
        recommendations: recommendations.sort((a, b) => {
          const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          const aPriority = priorityOrder[a.priority];
          const bPriority = priorityOrder[b.priority];
          if (aPriority !== bPriority) return bPriority - aPriority;
          return b.estimatedSavings.readsPerMinute - a.estimatedSavings.readsPerMinute;
        }),
        implementationPlan,
        monitoring: {
          nextSteps: [
            'Deploy optimizations to production',
            'Monitor read reduction in Firebase console',
            'Validate user experience remains smooth',
            'Iterate on additional optimizations'
          ],
          successMetrics: [
            'Reduce reads/minute from 25k to <5k during peak usage',
            'Maintain <200ms average API response times',
            'Achieve >80% cache hit rate on navigation endpoints',
            'Keep monthly Firebase costs under $50'
          ]
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating optimization report:', error);
    return NextResponse.json({
      error: 'Failed to generate optimization report',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

/**
 * Generate optimization recommendations based on production analysis
 */
function generateOptimizationRecommendations(analysis: any): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // CRITICAL: Search API optimization
  if (analysis.topEndpoints.some((e: any) => e.endpoint.includes('/search') && e.peakReadsPerMinute > 500)) {
    recommendations.push({
      priority: 'CRITICAL',
      category: 'CACHING',
      title: 'Implement Aggressive Search Result Caching',
      description: 'Search API is causing excessive database reads with poor cache hit rates',
      implementation: 'Increase search cache TTL to 10+ minutes, implement localStorage for recent searches, add request deduplication',
      estimatedSavings: {
        readsPerMinute: 15000,
        costPerMonth: 162
      },
      effort: 'MEDIUM',
      impact: 'HIGH'
    });
  }

  // HIGH: User profile caching
  if (analysis.topEndpoints.some((e: any) => e.endpoint.includes('/user') && e.avgReadsPerUser > 5)) {
    recommendations.push({
      priority: 'HIGH',
      category: 'CACHING',
      title: 'Extend User Profile Cache TTL',
      description: 'User profiles are being fetched repeatedly during navigation',
      implementation: 'Increase user profile cache TTL to 30+ minutes with background refresh',
      estimatedSavings: {
        readsPerMinute: 8000,
        costPerMonth: 86.4
      },
      effort: 'LOW',
      impact: 'HIGH'
    });
  }

  // HIGH: Navigation deduplication
  if (analysis.navigationPatterns.rapidNavigationEvents > 10) {
    recommendations.push({
      priority: 'HIGH',
      category: 'DEDUPLICATION',
      title: 'Implement Navigation Request Deduplication',
      description: 'Rapid navigation is causing duplicate API calls within short time windows',
      implementation: 'Add 5-second deduplication window for identical requests during navigation',
      estimatedSavings: {
        readsPerMinute: 5000,
        costPerMonth: 54
      },
      effort: 'MEDIUM',
      impact: 'HIGH'
    });
  }

  // MEDIUM: Recent searches optimization
  recommendations.push({
    priority: 'MEDIUM',
    category: 'ARCHITECTURE',
    title: 'Optimize Recent Searches Storage',
    description: 'Recent searches are hitting database on every search page visit',
    implementation: 'Move to localStorage-first with periodic database sync',
    estimatedSavings: {
      readsPerMinute: 2000,
      costPerMonth: 21.6
    },
    effort: 'LOW',
    impact: 'MEDIUM'
  });

  // MEDIUM: Batch user data loading
  if (analysis.optimizationOpportunities.batchingOpportunities.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'BATCHING',
      title: 'Implement Batch User Data Loading',
      description: 'Multiple individual user profile requests can be batched',
      implementation: 'Create batch API endpoint for loading multiple user profiles in single request',
      estimatedSavings: {
        readsPerMinute: 3000,
        costPerMonth: 32.4
      },
      effort: 'HIGH',
      impact: 'MEDIUM'
    });
  }

  // LOW: Preloading optimization
  recommendations.push({
    priority: 'LOW',
    category: 'CACHING',
    title: 'Optimize Navigation Preloading',
    description: 'Current preloading may be too aggressive and causing unnecessary reads',
    implementation: 'Add intelligent preloading based on user behavior patterns with rate limiting',
    estimatedSavings: {
      readsPerMinute: 1000,
      costPerMonth: 10.8
    },
    effort: 'MEDIUM',
    impact: 'LOW'
  });

  return recommendations;
}

/**
 * Generate implementation plan with phases
 */
function generateImplementationPlan(recommendations: OptimizationRecommendation[]) {
  const criticalItems = recommendations.filter(r => r.priority === 'CRITICAL');
  const highItems = recommendations.filter(r => r.priority === 'HIGH');
  const quickWins = recommendations.filter(r => r.effort === 'LOW' && r.impact === 'HIGH');

  return {
    phase1: {
      title: 'Emergency Optimizations (Deploy Immediately)',
      duration: '1-2 days',
      items: criticalItems.concat(quickWins),
      expectedSavings: criticalItems.concat(quickWins).reduce((sum, r) => sum + r.estimatedSavings.readsPerMinute, 0)
    },
    phase2: {
      title: 'High-Impact Improvements',
      duration: '1 week',
      items: highItems.filter(r => !quickWins.includes(r)),
      expectedSavings: highItems.filter(r => !quickWins.includes(r)).reduce((sum, r) => sum + r.estimatedSavings.readsPerMinute, 0)
    },
    phase3: {
      title: 'Long-term Optimizations',
      duration: '2-4 weeks',
      items: recommendations.filter(r => r.priority === 'MEDIUM' || r.priority === 'LOW'),
      expectedSavings: recommendations.filter(r => r.priority === 'MEDIUM' || r.priority === 'LOW').reduce((sum, r) => sum + r.estimatedSavings.readsPerMinute, 0)
    }
  };
}

/**
 * Calculate total potential savings
 */
function calculateTotalSavings(recommendations: OptimizationRecommendation[]) {
  return {
    readsPerMinute: recommendations.reduce((sum, r) => sum + r.estimatedSavings.readsPerMinute, 0),
    costPerMonth: recommendations.reduce((sum, r) => sum + r.estimatedSavings.costPerMonth, 0)
  };
}
