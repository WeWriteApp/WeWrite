/**
 * Cost Monitoring Dashboard for Firebase Optimization
 * 
 * Provides comprehensive cost tracking, optimization metrics,
 * and real-time monitoring of Firebase usage and savings.
 */

import { getCacheStats } from './serverCache';
import { getAnalyticsStats } from './analyticsOptimizer';
import { getSessionOptimizationStats } from './sessionOptimizer';
import { getQueryPerformanceStats } from './queryPerformanceMonitor';
import { getListenerOptimizationStats } from './listenerOptimizer';
import { getRealtimeConnectionStats } from './realtimeConnectionManager';
import { getBackgroundJobStats } from './backgroundJobOptimizer';
import { getApiOptimizationStats } from '../middleware/apiOptimization';

interface CostMetrics {
  totalSavings: number;
  monthlySavings: number;
  optimizationScore: number;
  lastUpdated: number;
}

interface OptimizationBreakdown {
  caching: {
    savings: number;
    hitRate: number;
    totalRequests: number;
  };
  analytics: {
    savings: number;
    eventsProcessed: number;
    batchEfficiency: number;
  };
  sessions: {
    savings: number;
    cacheHitRate: number;
    optimizedRequests: number;
  };
  queries: {
    savings: number;
    totalQueries: number;
    avgCost: number;
  };
  listeners: {
    savings: number;
    activeListeners: number;
    throttleEfficiency: number;
  };
  backgroundJobs: {
    savings: number;
    jobsCompleted: number;
    avgExecutionTime: number;
  };
  api: {
    savings: number;
    cacheHitRate: number;
    totalRequests: number;
  };
}

interface AlertLevel {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  recommendation: string;
  estimatedImpact: number;
}

class CostMonitoringDashboard {
  private metrics: CostMetrics = {
    totalSavings: 0,
    monthlySavings: 0,
    optimizationScore: 0,
    lastUpdated: Date.now()
  };

  private alerts: AlertLevel[] = [];
  private readonly COST_THRESHOLDS = {
    dailyBudget: 5.00,      // $5 daily budget
    monthlyBudget: 150.00,  // $150 monthly budget
    warningThreshold: 0.8,  // 80% of budget
    criticalThreshold: 0.95 // 95% of budget
  };

  /**
   * Get comprehensive cost optimization dashboard
   */
  async getDashboard(): Promise<{
    metrics: CostMetrics;
    breakdown: OptimizationBreakdown;
    alerts: AlertLevel[];
    recommendations: string[];
    trends: any;
  }> {
    await this.updateMetrics();
    
    const breakdown = await this.getOptimizationBreakdown();
    const recommendations = this.generateRecommendations(breakdown);
    const trends = this.calculateTrends();

    return {
      metrics: this.metrics,
      breakdown,
      alerts: this.alerts,
      recommendations,
      trends
    };
  }

  /**
   * Update cost metrics from all optimization systems
   */
  private async updateMetrics(): Promise<void> {
    try {
      const breakdown = await this.getOptimizationBreakdown();
      
      // Calculate total savings
      this.metrics.totalSavings = 
        breakdown.caching.savings +
        breakdown.analytics.savings +
        breakdown.sessions.savings +
        breakdown.queries.savings +
        breakdown.listeners.savings +
        breakdown.backgroundJobs.savings +
        breakdown.api.savings;

      // Estimate monthly savings
      this.metrics.monthlySavings = this.metrics.totalSavings * 30;

      // Calculate optimization score (0-100)
      this.metrics.optimizationScore = this.calculateOptimizationScore(breakdown);

      this.metrics.lastUpdated = Date.now();

      // Check for alerts
      this.checkForAlerts();

    } catch (error) {
      console.error('[CostMonitoringDashboard] Error updating metrics:', error);
    }
  }

  /**
   * Get detailed optimization breakdown
   */
  private async getOptimizationBreakdown(): Promise<OptimizationBreakdown> {
    const cacheStats = getCacheStats();
    const analyticsStats = getAnalyticsStats();
    const sessionStats = getSessionOptimizationStats();
    const queryStats = getQueryPerformanceStats();
    const listenerStats = getListenerOptimizationStats();
    const realtimeStats = getRealtimeConnectionStats();
    const jobStats = getBackgroundJobStats();
    const apiStats = getApiOptimizationStats();

    return {
      caching: {
        savings: cacheStats.total.memoryUsage * 0.00001, // Estimate savings
        hitRate: 85, // Placeholder - would come from actual cache stats
        totalRequests: 1000 // Placeholder
      },
      analytics: {
        savings: analyticsStats.costSavings || 0,
        eventsProcessed: analyticsStats.totalEvents || 0,
        batchEfficiency: analyticsStats.batchSize / analyticsStats.config.batchSize * 100 || 0
      },
      sessions: {
        savings: sessionStats.costSavings || 0,
        cacheHitRate: sessionStats.cacheHitRate || 0,
        optimizedRequests: sessionStats.cachedSessions || 0
      },
      queries: {
        savings: queryStats.lastDay?.cost || 0,
        totalQueries: queryStats.totalExecutions || 0,
        avgCost: queryStats.totalCost / Math.max(1, queryStats.totalExecutions) || 0
      },
      listeners: {
        savings: listenerStats.totalCostSavings || 0,
        activeListeners: listenerStats.totalListeners || 0,
        throttleEfficiency: listenerStats.throttleEfficiency || 0
      },
      backgroundJobs: {
        savings: jobStats.totalCostSavings || 0,
        jobsCompleted: jobStats.completedJobs || 0,
        avgExecutionTime: jobStats.averageExecutionTime || 0
      },
      api: {
        savings: apiStats.memoryCache?.size * 0.0001 || 0, // Estimate
        cacheHitRate: apiStats.cacheHitRate || 0,
        totalRequests: apiStats.totalRequests || 0
      }
    };
  }

  /**
   * Calculate overall optimization score
   */
  private calculateOptimizationScore(breakdown: OptimizationBreakdown): number {
    const scores = [
      Math.min(100, breakdown.caching.hitRate),
      Math.min(100, breakdown.analytics.batchEfficiency),
      Math.min(100, breakdown.sessions.cacheHitRate),
      Math.min(100, breakdown.listeners.throttleEfficiency),
      Math.min(100, breakdown.api.cacheHitRate)
    ];

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  /**
   * Check for cost and performance alerts
   */
  private checkForAlerts(): void {
    this.alerts = [];

    // Budget alerts
    const dailySpend = this.estimateDailySpend();
    if (dailySpend > this.COST_THRESHOLDS.dailyBudget * this.COST_THRESHOLDS.criticalThreshold) {
      this.alerts.push({
        level: 'critical',
        message: `Daily spend approaching budget limit: $${dailySpend.toFixed(2)}`,
        recommendation: 'Implement immediate cost reduction measures',
        estimatedImpact: dailySpend - this.COST_THRESHOLDS.dailyBudget
      });
    } else if (dailySpend > this.COST_THRESHOLDS.dailyBudget * this.COST_THRESHOLDS.warningThreshold) {
      this.alerts.push({
        level: 'warning',
        message: `Daily spend above warning threshold: $${dailySpend.toFixed(2)}`,
        recommendation: 'Review optimization opportunities',
        estimatedImpact: dailySpend - (this.COST_THRESHOLDS.dailyBudget * this.COST_THRESHOLDS.warningThreshold)
      });
    }

    // Optimization score alerts
    if (this.metrics.optimizationScore < 60) {
      this.alerts.push({
        level: 'error',
        message: `Low optimization score: ${this.metrics.optimizationScore}%`,
        recommendation: 'Review and implement optimization recommendations',
        estimatedImpact: (100 - this.metrics.optimizationScore) * 0.01
      });
    } else if (this.metrics.optimizationScore < 80) {
      this.alerts.push({
        level: 'warning',
        message: `Optimization score could be improved: ${this.metrics.optimizationScore}%`,
        recommendation: 'Consider additional optimization measures',
        estimatedImpact: (100 - this.metrics.optimizationScore) * 0.005
      });
    }

    // Savings opportunity alerts
    if (this.metrics.totalSavings < 0.10) { // Less than $0.10 daily savings
      this.alerts.push({
        level: 'info',
        message: 'Low cost savings detected',
        recommendation: 'Review optimization implementations',
        estimatedImpact: 0.50 // Potential additional savings
      });
    }
  }

  /**
   * Estimate current daily spend
   */
  private estimateDailySpend(): number {
    // This would integrate with actual Firebase billing data
    // For now, we'll estimate based on usage patterns
    const queryStats = getQueryPerformanceStats();
    const estimatedDailyReads = queryStats.lastDay?.reads || 1000;
    const estimatedDailyWrites = estimatedDailyReads * 0.1; // Assume 10% write ratio
    
    const readCost = (estimatedDailyReads / 100000) * 0.36; // $0.36 per 100K reads
    const writeCost = (estimatedDailyWrites / 100000) * 1.08; // $1.08 per 100K writes
    
    return readCost + writeCost;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(breakdown: OptimizationBreakdown): string[] {
    const recommendations: string[] = [];

    // Caching recommendations
    if (breakdown.caching.hitRate < 70) {
      recommendations.push('Increase cache TTL values to improve hit rates and reduce Firebase reads');
    }

    // Analytics recommendations
    if (breakdown.analytics.batchEfficiency < 80) {
      recommendations.push('Increase analytics batch size to reduce write operations');
    }

    // Query recommendations
    if (breakdown.queries.avgCost > 0.001) {
      recommendations.push('Review expensive queries and implement better filtering');
    }

    // Listener recommendations
    if (breakdown.listeners.throttleEfficiency < 60) {
      recommendations.push('Increase listener throttling intervals to reduce real-time costs');
    }

    // Background job recommendations
    if (breakdown.backgroundJobs.avgExecutionTime > 30000) {
      recommendations.push('Optimize background job execution to reduce function runtime costs');
    }

    // General recommendations
    if (this.metrics.optimizationScore < 85) {
      recommendations.push('Consider implementing additional caching layers for frequently accessed data');
      recommendations.push('Review data structure optimization opportunities');
    }

    return recommendations;
  }

  /**
   * Calculate cost trends
   */
  private calculateTrends(): any {
    // This would analyze historical data
    // For now, return placeholder trends
    return {
      dailySavings: {
        trend: 'increasing',
        percentage: 15.5,
        data: [0.05, 0.08, 0.12, 0.15, 0.18, 0.22, 0.25] // Last 7 days
      },
      optimizationScore: {
        trend: 'stable',
        percentage: 2.1,
        data: [82, 83, 85, 84, 86, 85, 87] // Last 7 days
      },
      queryPerformance: {
        trend: 'improving',
        percentage: -8.3, // Negative is good (cost reduction)
        data: [0.002, 0.0018, 0.0016, 0.0015, 0.0014, 0.0013, 0.0012] // Cost per query
      }
    };
  }

  /**
   * Get real-time cost monitoring data
   */
  getRealTimeMetrics() {
    return {
      currentOptimizationScore: this.metrics.optimizationScore,
      todaysSavings: this.metrics.totalSavings,
      activeOptimizations: {
        caching: getCacheStats().total.size > 0,
        analytics: getAnalyticsStats().totalEvents > 0,
        sessions: getSessionOptimizationStats().cachedSessions > 0,
        backgroundJobs: getBackgroundJobStats().totalJobs > 0
      },
      alerts: this.alerts.filter(a => a.level === 'critical' || a.level === 'error').length
    };
  }

  /**
   * Export cost optimization report
   */
  async exportReport(): Promise<{
    summary: any;
    detailed: any;
    recommendations: string[];
    timestamp: string;
  }> {
    const dashboard = await this.getDashboard();
    
    return {
      summary: {
        totalSavings: this.metrics.totalSavings,
        monthlySavings: this.metrics.monthlySavings,
        optimizationScore: this.metrics.optimizationScore,
        alertCount: this.alerts.length
      },
      detailed: dashboard.breakdown,
      recommendations: dashboard.recommendations,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const costMonitoringDashboard = new CostMonitoringDashboard();

// Convenience functions
export const getCostDashboard = () => {
  return costMonitoringDashboard.getDashboard();
};

export const getRealTimeCostMetrics = () => {
  return costMonitoringDashboard.getRealTimeMetrics();
};

export const exportCostReport = () => {
  return costMonitoringDashboard.exportReport();
};
