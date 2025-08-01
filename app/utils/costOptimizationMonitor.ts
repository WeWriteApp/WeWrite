/**
 * Cost Optimization Monitoring System
 * 
 * Tracks the effectiveness of Firebase cost optimizations implemented in August 2025.
 * Provides real-time monitoring and alerting for cost-related metrics.
 * 
 * AUDIT TRAIL:
 * - Created: August 1, 2025
 * - Purpose: Monitor cost optimization effectiveness
 * - Compliance: Industry standard monitoring practices
 */

interface OptimizationMetrics {
  // Query Optimization Metrics
  queryMetrics: {
    recentEditsQueries: number;
    averageDocumentsRead: number;
    fullCollectionScans: number;
    dateFilteredQueries: number;
  };
  
  // Batching Metrics
  batchingMetrics: {
    visitorTrackingBatches: number;
    pageViewBatches: number;
    averageBatchSize: number;
    batchSuccessRate: number;
    immediateWrites: number; // Should be minimal
  };
  
  // Cost Metrics
  costMetrics: {
    firestoreReads: number;
    firestoreWrites: number;
    rtdbOperations: number;
    estimatedDailyCost: number;
  };
  
  // Performance Metrics
  performanceMetrics: {
    averageQueryTime: number;
    batchProcessingTime: number;
    cacheHitRate: number;
  };
}

class CostOptimizationMonitor {
  private metrics: OptimizationMetrics;
  private alertThresholds = {
    dailyCostWarning: 5.00,    // $5/day
    dailyCostCritical: 10.00,  // $10/day
    fullCollectionScans: 10,   // Max per hour
    batchFailureRate: 0.05,    // 5% max failure rate
    queryTimeWarning: 1000,    // 1 second
  };

  constructor() {
    this.metrics = this.initializeMetrics();
    this.startMonitoring();
  }

  private initializeMetrics(): OptimizationMetrics {
    return {
      queryMetrics: {
        recentEditsQueries: 0,
        averageDocumentsRead: 0,
        fullCollectionScans: 0,
        dateFilteredQueries: 0,
      },
      batchingMetrics: {
        visitorTrackingBatches: 0,
        pageViewBatches: 0,
        averageBatchSize: 0,
        batchSuccessRate: 1.0,
        immediateWrites: 0,
      },
      costMetrics: {
        firestoreReads: 0,
        firestoreWrites: 0,
        rtdbOperations: 0,
        estimatedDailyCost: 0,
      },
      performanceMetrics: {
        averageQueryTime: 0,
        batchProcessingTime: 0,
        cacheHitRate: 0,
      },
    };
  }

  /**
   * Track a query operation for optimization monitoring
   */
  trackQuery(operation: string, documentsRead: number, queryTime: number, hasDateFilter: boolean): void {
    this.metrics.queryMetrics.recentEditsQueries++;
    this.metrics.queryMetrics.averageDocumentsRead = 
      (this.metrics.queryMetrics.averageDocumentsRead + documentsRead) / 2;
    
    if (hasDateFilter) {
      this.metrics.queryMetrics.dateFilteredQueries++;
    } else {
      this.metrics.queryMetrics.fullCollectionScans++;
      this.checkFullCollectionScanAlert();
    }

    this.metrics.performanceMetrics.averageQueryTime = 
      (this.metrics.performanceMetrics.averageQueryTime + queryTime) / 2;

    this.updateCostEstimate('read', documentsRead);
    
    console.log(`📊 [CostMonitor] Query tracked: ${operation}, docs: ${documentsRead}, time: ${queryTime}ms, filtered: ${hasDateFilter}`);
  }

  /**
   * Track a batch operation for optimization monitoring
   */
  trackBatch(type: 'visitor' | 'pageView', batchSize: number, processingTime: number, success: boolean): void {
    if (type === 'visitor') {
      this.metrics.batchingMetrics.visitorTrackingBatches++;
    } else {
      this.metrics.batchingMetrics.pageViewBatches++;
    }

    this.metrics.batchingMetrics.averageBatchSize = 
      (this.metrics.batchingMetrics.averageBatchSize + batchSize) / 2;

    // Update success rate
    const totalBatches = this.metrics.batchingMetrics.visitorTrackingBatches + 
                        this.metrics.batchingMetrics.pageViewBatches;
    const currentSuccessRate = this.metrics.batchingMetrics.batchSuccessRate;
    this.metrics.batchingMetrics.batchSuccessRate = 
      (currentSuccessRate * (totalBatches - 1) + (success ? 1 : 0)) / totalBatches;

    this.metrics.performanceMetrics.batchProcessingTime = 
      (this.metrics.performanceMetrics.batchProcessingTime + processingTime) / 2;

    this.updateCostEstimate('write', batchSize);

    if (!success) {
      console.warn(`⚠️ [CostMonitor] Batch failed: ${type}, size: ${batchSize}`);
    }

    console.log(`📦 [CostMonitor] Batch tracked: ${type}, size: ${batchSize}, time: ${processingTime}ms, success: ${success}`);
  }

  /**
   * Track an immediate write (should be minimal after optimization)
   */
  trackImmediateWrite(operation: string): void {
    this.metrics.batchingMetrics.immediateWrites++;
    this.updateCostEstimate('write', 1);
    
    console.warn(`🚨 [CostMonitor] Immediate write detected: ${operation} - Should be batched!`);
  }

  /**
   * Update cost estimates based on operations
   */
  private updateCostEstimate(operation: 'read' | 'write', count: number): void {
    const FIRESTORE_READ_COST = 0.00036 / 1000;  // $0.36 per 100K reads
    const FIRESTORE_WRITE_COST = 0.00108 / 1000; // $1.08 per 100K writes

    if (operation === 'read') {
      this.metrics.costMetrics.firestoreReads += count;
      this.metrics.costMetrics.estimatedDailyCost += count * FIRESTORE_READ_COST;
    } else {
      this.metrics.costMetrics.firestoreWrites += count;
      this.metrics.costMetrics.estimatedDailyCost += count * FIRESTORE_WRITE_COST;
    }

    this.checkCostAlerts();
  }

  /**
   * Check for cost-related alerts
   */
  private checkCostAlerts(): void {
    const dailyCost = this.metrics.costMetrics.estimatedDailyCost;

    if (dailyCost > this.alertThresholds.dailyCostCritical) {
      console.error(`🚨 [CostMonitor] CRITICAL: Daily cost estimate $${dailyCost.toFixed(2)} exceeds critical threshold!`);
      this.triggerEmergencyProcedures();
    } else if (dailyCost > this.alertThresholds.dailyCostWarning) {
      console.warn(`⚠️ [CostMonitor] WARNING: Daily cost estimate $${dailyCost.toFixed(2)} exceeds warning threshold`);
    }
  }

  /**
   * Check for full collection scan alerts
   */
  private checkFullCollectionScanAlert(): void {
    if (this.metrics.queryMetrics.fullCollectionScans > this.alertThresholds.fullCollectionScans) {
      console.error(`🚨 [CostMonitor] ALERT: ${this.metrics.queryMetrics.fullCollectionScans} full collection scans detected in the last hour!`);
    }
  }

  /**
   * Trigger emergency cost reduction procedures
   */
  private triggerEmergencyProcedures(): void {
    console.error('🚨 [CostMonitor] EMERGENCY: Triggering cost reduction procedures');
    
    // Log emergency state
    console.error('Emergency metrics:', JSON.stringify(this.metrics, null, 2));
    
    // In a real implementation, this would:
    // 1. Enable quota bypass
    // 2. Send alerts to development team
    // 3. Temporarily disable non-critical features
    // 4. Scale down batch processing if needed
  }

  /**
   * Get current optimization effectiveness report
   */
  getOptimizationReport(): {
    summary: string;
    metrics: OptimizationMetrics;
    recommendations: string[];
  } {
    const queryOptimizationRate = this.metrics.queryMetrics.dateFilteredQueries / 
      Math.max(this.metrics.queryMetrics.recentEditsQueries, 1);
    
    const batchingEffectiveness = 1 - (this.metrics.batchingMetrics.immediateWrites / 
      Math.max(this.metrics.batchingMetrics.visitorTrackingBatches + this.metrics.batchingMetrics.pageViewBatches, 1));

    const recommendations: string[] = [];
    
    if (queryOptimizationRate < 0.9) {
      recommendations.push('Increase date filtering usage in queries');
    }
    
    if (this.metrics.batchingMetrics.batchSuccessRate < 0.95) {
      recommendations.push('Investigate batch processing failures');
    }
    
    if (this.metrics.batchingMetrics.immediateWrites > 10) {
      recommendations.push('Reduce immediate writes by improving batching');
    }

    return {
      summary: `Query Optimization: ${(queryOptimizationRate * 100).toFixed(1)}%, Batching Effectiveness: ${(batchingEffectiveness * 100).toFixed(1)}%`,
      metrics: this.metrics,
      recommendations
    };
  }

  /**
   * Start monitoring system
   */
  private startMonitoring(): void {
    // Reset metrics every hour for fresh tracking
    setInterval(() => {
      console.log('📊 [CostMonitor] Hourly metrics reset');
      this.metrics = this.initializeMetrics();
    }, 60 * 60 * 1000); // 1 hour

    // Log summary every 15 minutes
    setInterval(() => {
      const report = this.getOptimizationReport();
      console.log(`📊 [CostMonitor] ${report.summary}`);
      
      if (report.recommendations.length > 0) {
        console.warn('📊 [CostMonitor] Recommendations:', report.recommendations);
      }
    }, 15 * 60 * 1000); // 15 minutes

    console.log('📊 [CostMonitor] Monitoring system started');
  }
}

// Global monitor instance
export const costOptimizationMonitor = new CostOptimizationMonitor();

// Convenience functions for easy integration
export const trackQuery = (operation: string, documentsRead: number, queryTime: number, hasDateFilter: boolean) => {
  costOptimizationMonitor.trackQuery(operation, documentsRead, queryTime, hasDateFilter);
};

export const trackBatch = (type: 'visitor' | 'pageView', batchSize: number, processingTime: number, success: boolean) => {
  costOptimizationMonitor.trackBatch(type, batchSize, processingTime, success);
};

export const trackImmediateWrite = (operation: string) => {
  costOptimizationMonitor.trackImmediateWrite(operation);
};

export const getOptimizationReport = () => {
  return costOptimizationMonitor.getOptimizationReport();
};
