/**
 * Query Performance Monitor for Firebase Cost Optimization
 * 
 * Monitors query performance, identifies expensive operations,
 * and provides recommendations for cost reduction.
 */

import { QueryConstraint } from 'firebase/firestore';
// Note: estimateQueryCost functionality moved to unifiedApiClient

interface QueryExecution {
  id: string;
  collection: string;
  constraints: QueryConstraint[];
  executionTime: number;
  documentsRead: number;
  timestamp: number;
  costUSD: number;
  cacheHit: boolean;
  userId?: string;
}

interface QueryPattern {
  pattern: string;
  count: number;
  totalCost: number;
  avgExecutionTime: number;
  avgDocumentsRead: number;
  lastSeen: number;
}

interface PerformanceAlert {
  type: 'expensive_query' | 'frequent_pattern' | 'missing_index' | 'full_scan';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  queryId?: string;
  pattern?: string;
  recommendation: string;
  estimatedSavings?: number;
}

class QueryPerformanceMonitor {
  private executions: QueryExecution[] = [];
  private patterns = new Map<string, QueryPattern>();
  private alerts: PerformanceAlert[] = [];
  private totalCostSavings = 0;

  private readonly MAX_EXECUTIONS = 1000;
  private readonly EXPENSIVE_QUERY_THRESHOLD = 1000; // documents
  private readonly SLOW_QUERY_THRESHOLD = 5000; // milliseconds
  private readonly FREQUENT_PATTERN_THRESHOLD = 10; // executions per hour

  /**
   * Record a query execution
   */
  recordExecution(
    collection: string,
    constraints: QueryConstraint[],
    executionTime: number,
    documentsRead: number,
    cacheHit: boolean = false,
    userId?: string
  ): string {
    const id = this.generateExecutionId();
    const costUSD = (documentsRead / 100000) * 0.36; // Firestore pricing

    const execution: QueryExecution = {
      id,
      collection,
      constraints,
      executionTime,
      documentsRead,
      timestamp: Date.now(),
      costUSD,
      cacheHit,
      userId
    };

    this.executions.push(execution);

    // Maintain max executions limit
    if (this.executions.length > this.MAX_EXECUTIONS) {
      this.executions = this.executions.slice(-this.MAX_EXECUTIONS);
    }

    // Update patterns
    this.updatePatterns(execution);

    // Check for alerts
    this.checkForAlerts(execution);

    // Log expensive queries
    if (documentsRead > this.EXPENSIVE_QUERY_THRESHOLD) {
      console.warn(`[QueryMonitor] Expensive query detected: ${collection} (${documentsRead} reads, $${costUSD.toFixed(6)})`);
    }

    return id;
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update query patterns
   */
  private updatePatterns(execution: QueryExecution): void {
    const pattern = this.generatePattern(execution.collection, execution.constraints);
    
    if (!this.patterns.has(pattern)) {
      this.patterns.set(pattern, {
        pattern,
        count: 0,
        totalCost: 0,
        avgExecutionTime: 0,
        avgDocumentsRead: 0,
        lastSeen: 0
      });
    }

    const patternData = this.patterns.get(pattern)!;
    patternData.count++;
    patternData.totalCost += execution.costUSD;
    patternData.avgExecutionTime = (patternData.avgExecutionTime * (patternData.count - 1) + execution.executionTime) / patternData.count;
    patternData.avgDocumentsRead = (patternData.avgDocumentsRead * (patternData.count - 1) + execution.documentsRead) / patternData.count;
    patternData.lastSeen = execution.timestamp;
  }

  /**
   * Generate pattern string for query
   */
  private generatePattern(collection: string, constraints: QueryConstraint[]): string {
    const constraintStrings = constraints.map(c => {
      if (c.type === 'where') {
        const whereConstraint = c as any;
        return `where(${whereConstraint.fieldPath?.toString()}, ${whereConstraint.opStr})`;
      } else if (c.type === 'orderBy') {
        const orderConstraint = c as any;
        return `orderBy(${orderConstraint.fieldPath?.toString()}, ${orderConstraint.directionStr})`;
      } else if (c.type === 'limit') {
        const limitConstraint = c as any;
        return `limit(${limitConstraint.limit})`;
      }
      return c.type;
    });

    return `${collection}:${constraintStrings.join(',')}`;
  }

  /**
   * Check for performance alerts
   */
  private checkForAlerts(execution: QueryExecution): void {
    // Check for expensive queries
    if (execution.documentsRead > this.EXPENSIVE_QUERY_THRESHOLD) {
      this.addAlert({
        type: 'expensive_query',
        severity: execution.documentsRead > 5000 ? 'critical' : 'high',
        message: `Query read ${execution.documentsRead} documents (cost: $${execution.costUSD.toFixed(6)})`,
        queryId: execution.id,
        recommendation: 'Add more specific filters or implement pagination',
        estimatedSavings: execution.costUSD * 0.8 // Estimate 80% savings with optimization
      });
    }

    // Check for slow queries
    if (execution.executionTime > this.SLOW_QUERY_THRESHOLD) {
      this.addAlert({
        type: 'expensive_query',
        severity: 'medium',
        message: `Slow query detected: ${execution.executionTime}ms execution time`,
        queryId: execution.id,
        recommendation: 'Consider adding indexes or optimizing query structure'
      });
    }

    // Check for frequent patterns
    const pattern = this.generatePattern(execution.collection, execution.constraints);
    const patternData = this.patterns.get(pattern);
    
    if (patternData && this.isFrequentPattern(patternData)) {
      this.addAlert({
        type: 'frequent_pattern',
        severity: 'medium',
        message: `Frequent query pattern detected: ${patternData.count} executions`,
        pattern,
        recommendation: 'Consider caching results or denormalizing data',
        estimatedSavings: patternData.totalCost * 0.9 // 90% savings with caching
      });
    }

    // Check for potential full scans
    if (execution.constraints.length === 0 || 
        (execution.constraints.length === 1 && execution.constraints[0].type === 'limit')) {
      this.addAlert({
        type: 'full_scan',
        severity: 'critical',
        message: 'Potential full collection scan detected',
        queryId: execution.id,
        recommendation: 'Add where clauses to filter documents',
        estimatedSavings: execution.costUSD * 0.95 // 95% savings with proper filtering
      });
    }
  }

  /**
   * Check if pattern is frequent
   */
  private isFrequentPattern(pattern: QueryPattern): boolean {
    const oneHourAgo = Date.now() - 3600000;
    const recentExecutions = this.executions.filter(e => 
      e.timestamp > oneHourAgo && 
      this.generatePattern(e.collection, e.constraints) === pattern.pattern
    );
    
    return recentExecutions.length >= this.FREQUENT_PATTERN_THRESHOLD;
  }

  /**
   * Add performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    // Avoid duplicate alerts
    const isDuplicate = this.alerts.some(existing => 
      existing.type === alert.type &&
      existing.queryId === alert.queryId &&
      existing.pattern === alert.pattern
    );

    if (!isDuplicate) {
      this.alerts.push(alert);
      
      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(-100);
      }

      // Log critical alerts
      if (alert.severity === 'critical') {
        console.error(`[QueryMonitor] CRITICAL ALERT: ${alert.message}`);
        console.error(`[QueryMonitor] Recommendation: ${alert.recommendation}`);
      }
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const now = Date.now();
    const lastHour = this.executions.filter(e => now - e.timestamp < 3600000);
    const lastDay = this.executions.filter(e => now - e.timestamp < 86400000);

    const totalCost = this.executions.reduce((sum, e) => sum + e.costUSD, 0);
    const totalReads = this.executions.reduce((sum, e) => sum + e.documentsRead, 0);
    const avgExecutionTime = this.executions.reduce((sum, e) => sum + e.executionTime, 0) / this.executions.length || 0;

    const cacheHits = this.executions.filter(e => e.cacheHit).length;
    const cacheHitRate = this.executions.length > 0 ? (cacheHits / this.executions.length) * 100 : 0;

    return {
      totalExecutions: this.executions.length,
      totalCost: totalCost,
      totalReads: totalReads,
      avgExecutionTime: Math.round(avgExecutionTime),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      
      lastHour: {
        executions: lastHour.length,
        cost: lastHour.reduce((sum, e) => sum + e.costUSD, 0),
        reads: lastHour.reduce((sum, e) => sum + e.documentsRead, 0)
      },
      
      lastDay: {
        executions: lastDay.length,
        cost: lastDay.reduce((sum, e) => sum + e.costUSD, 0),
        reads: lastDay.reduce((sum, e) => sum + e.documentsRead, 0)
      },

      alerts: {
        total: this.alerts.length,
        critical: this.alerts.filter(a => a.severity === 'critical').length,
        high: this.alerts.filter(a => a.severity === 'high').length,
        medium: this.alerts.filter(a => a.severity === 'medium').length,
        low: this.alerts.filter(a => a.severity === 'low').length
      },

      patterns: {
        total: this.patterns.size,
        mostFrequent: Array.from(this.patterns.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map(p => ({
            pattern: p.pattern,
            count: p.count,
            totalCost: p.totalCost,
            avgCost: p.totalCost / p.count
          }))
      },

      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getStats();

    // Cost-based recommendations
    if (stats.totalCost > 1.0) {
      recommendations.push(`High query costs detected ($${stats.totalCost.toFixed(2)}). Consider implementing more aggressive caching.`);
    }

    // Cache hit rate recommendations
    if (stats.cacheHitRate < 50) {
      recommendations.push(`Low cache hit rate (${stats.cacheHitRate}%). Increase cache TTL or improve cache key strategies.`);
    }

    // Performance recommendations
    if (stats.avgExecutionTime > 2000) {
      recommendations.push(`Slow average query time (${stats.avgExecutionTime}ms). Review query structure and indexes.`);
    }

    // Alert-based recommendations
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical').length;
    if (criticalAlerts > 0) {
      recommendations.push(`${criticalAlerts} critical performance issues detected. Review alerts for immediate action.`);
    }

    // Pattern-based recommendations
    const frequentPatterns = Array.from(this.patterns.values()).filter(p => p.count > 20);
    if (frequentPatterns.length > 0) {
      recommendations.push(`${frequentPatterns.length} frequently executed query patterns detected. Consider result caching.`);
    }

    return recommendations;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 10): PerformanceAlert[] {
    return this.alerts.slice(-limit).reverse();
  }

  /**
   * Get query patterns sorted by frequency
   */
  getTopPatterns(limit: number = 10): QueryPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Clear old data
   */
  cleanup(retentionHours: number = 24): void {
    const cutoff = Date.now() - (retentionHours * 3600000);
    
    this.executions = this.executions.filter(e => e.timestamp > cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp ? a.timestamp > cutoff : true);
    
    // Clean up old patterns
    for (const [pattern, data] of this.patterns.entries()) {
      if (data.lastSeen < cutoff) {
        this.patterns.delete(pattern);
      }
    }

    console.log(`[QueryMonitor] Cleaned up data older than ${retentionHours} hours`);
  }

  /**
   * Reset all monitoring data
   */
  reset(): void {
    this.executions = [];
    this.patterns.clear();
    this.alerts = [];
    this.totalCostSavings = 0;
    console.log('[QueryMonitor] All monitoring data reset');
  }
}

// Export singleton instance
export const queryPerformanceMonitor = new QueryPerformanceMonitor();

// Convenience functions
export const recordQueryExecution = (
  collection: string,
  constraints: QueryConstraint[],
  executionTime: number,
  documentsRead: number,
  cacheHit?: boolean,
  userId?: string
) => {
  return queryPerformanceMonitor.recordExecution(
    collection,
    constraints,
    executionTime,
    documentsRead,
    cacheHit,
    userId
  );
};

export const getQueryPerformanceStats = () => {
  return queryPerformanceMonitor.getStats();
};

export const getQueryAlerts = (limit?: number) => {
  return queryPerformanceMonitor.getRecentAlerts(limit);
};

export const getTopQueryPatterns = (limit?: number) => {
  return queryPerformanceMonitor.getTopPatterns(limit);
};

export const cleanupQueryMonitoring = (retentionHours?: number) => {
  queryPerformanceMonitor.cleanup(retentionHours);
};

export const resetQueryMonitoring = () => {
  queryPerformanceMonitor.reset();
};
