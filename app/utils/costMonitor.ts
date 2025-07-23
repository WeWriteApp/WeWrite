/**
 * Firebase Cost Monitor - Real-time tracking and alerting
 * 
 * Monitors database reads and costs to prevent expensive operations
 */

interface ReadOperation {
  timestamp: number;
  collection: string;
  operation: string;
  documentsRead: number;
  estimatedCost: number;
  source: string;
}

interface CostAlert {
  level: 'warning' | 'critical' | 'emergency';
  message: string;
  currentCost: number;
  threshold: number;
  recommendations: string[];
}

class CostMonitor {
  private operations: ReadOperation[] = [];
  private readonly MAX_OPERATIONS = 1000;
  
  // Cost thresholds (daily)
  private readonly THRESHOLDS = {
    warning: 5.00,    // $5/day
    critical: 10.00,  // $10/day
    emergency: 20.00  // $20/day
  };

  // Firestore pricing (approximate)
  private readonly FIRESTORE_READ_COST = 0.00036 / 1000; // $0.36 per 100K reads
  private readonly RTDB_READ_COST = 0.054 / 1000000;     // $0.054 per 1M reads

  /**
   * Track a database read operation
   */
  trackRead(
    collection: string,
    operation: string,
    documentsRead: number = 1,
    source: string = 'unknown'
  ): void {
    const estimatedCost = this.calculateCost(collection, documentsRead);
    
    const readOp: ReadOperation = {
      timestamp: Date.now(),
      collection,
      operation,
      documentsRead,
      estimatedCost,
      source
    };

    this.operations.push(readOp);

    // Keep only recent operations
    if (this.operations.length > this.MAX_OPERATIONS) {
      this.operations = this.operations.slice(-this.MAX_OPERATIONS);
    }

    // Check for alerts
    this.checkAlerts();

    // Log expensive operations immediately
    if (estimatedCost > 0.01) { // More than 1 cent
      console.warn(`💸 EXPENSIVE OPERATION: ${collection}.${operation} - ${documentsRead} reads - $${estimatedCost.toFixed(4)}`, {
        source,
        collection,
        operation,
        documentsRead,
        estimatedCost
      });
    }
  }

  /**
   * Calculate estimated cost for operation
   */
  private calculateCost(collection: string, documentsRead: number): number {
    // Assume Firestore for most collections
    return documentsRead * this.FIRESTORE_READ_COST;
  }

  /**
   * Get current daily cost
   */
  getDailyCost(): number {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return this.operations
      .filter(op => op.timestamp > oneDayAgo)
      .reduce((total, op) => total + op.estimatedCost, 0);
  }

  /**
   * Get hourly cost
   */
  getHourlyCost(): number {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return this.operations
      .filter(op => op.timestamp > oneHourAgo)
      .reduce((total, op) => total + op.estimatedCost, 0);
  }

  /**
   * Check for cost alerts
   */
  private checkAlerts(): void {
    const dailyCost = this.getDailyCost();
    const hourlyCost = this.getHourlyCost();

    // Emergency alert - immediate action needed
    if (dailyCost > this.THRESHOLDS.emergency) {
      this.sendAlert({
        level: 'emergency',
        message: `🚨 EMERGENCY: Daily Firebase cost exceeded $${this.THRESHOLDS.emergency}!`,
        currentCost: dailyCost,
        threshold: this.THRESHOLDS.emergency,
        recommendations: [
          'IMMEDIATELY disable all real-time listeners',
          'Enable aggressive caching for all queries',
          'Reduce query frequency and batch operations',
          'Consider implementing query result pagination'
        ]
      });
    }
    // Critical alert
    else if (dailyCost > this.THRESHOLDS.critical) {
      this.sendAlert({
        level: 'critical',
        message: `🔥 CRITICAL: Daily Firebase cost exceeded $${this.THRESHOLDS.critical}`,
        currentCost: dailyCost,
        threshold: this.THRESHOLDS.critical,
        recommendations: [
          'Disable non-essential real-time listeners',
          'Implement caching for frequently accessed data',
          'Review and optimize expensive queries'
        ]
      });
    }
    // Warning alert
    else if (dailyCost > this.THRESHOLDS.warning) {
      this.sendAlert({
        level: 'warning',
        message: `⚠️ WARNING: Daily Firebase cost exceeded $${this.THRESHOLDS.warning}`,
        currentCost: dailyCost,
        threshold: this.THRESHOLDS.warning,
        recommendations: [
          'Monitor query patterns for optimization opportunities',
          'Consider implementing caching for repeated queries'
        ]
      });
    }

    // Hourly rate check - if we're on track for expensive day
    const projectedDailyCost = hourlyCost * 24;
    if (projectedDailyCost > this.THRESHOLDS.critical) {
      console.warn(`📈 HIGH HOURLY RATE: $${hourlyCost.toFixed(4)}/hour (projected daily: $${projectedDailyCost.toFixed(2)})`);
    }
  }

  /**
   * Send cost alert
   */
  private sendAlert(alert: CostAlert): void {
    console.error(`${alert.message} - Current: $${alert.currentCost.toFixed(4)}`);
    console.error('Recommendations:', alert.recommendations);

    // In production, you could send to monitoring service, email, Slack, etc.
    if (typeof window !== 'undefined') {
      // Client-side: could show user notification
      console.error('Cost alert triggered - see console for details');
    }
  }

  /**
   * Get cost breakdown by collection
   */
  getCostBreakdown(hours: number = 24): Record<string, number> {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const breakdown: Record<string, number> = {};

    this.operations
      .filter(op => op.timestamp > cutoff)
      .forEach(op => {
        breakdown[op.collection] = (breakdown[op.collection] || 0) + op.estimatedCost;
      });

    return breakdown;
  }

  /**
   * Get most expensive operations
   */
  getExpensiveOperations(limit: number = 10): ReadOperation[] {
    return [...this.operations]
      .sort((a, b) => b.estimatedCost - a.estimatedCost)
      .slice(0, limit);
  }

  /**
   * Get statistics
   */
  getStats() {
    const dailyCost = this.getDailyCost();
    const hourlyCost = this.getHourlyCost();
    const breakdown = this.getCostBreakdown();
    const expensive = this.getExpensiveOperations(5);

    return {
      dailyCost,
      hourlyCost,
      projectedDailyCost: hourlyCost * 24,
      totalOperations: this.operations.length,
      breakdown,
      expensiveOperations: expensive,
      alerts: {
        warning: dailyCost > this.THRESHOLDS.warning,
        critical: dailyCost > this.THRESHOLDS.critical,
        emergency: dailyCost > this.THRESHOLDS.emergency
      }
    };
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.operations = [];
    console.log('🔄 Cost monitor reset');
  }
}

// Global cost monitor instance
export const costMonitor = new CostMonitor();

/**
 * Track a Firebase read operation
 */
export function trackFirebaseRead(
  collection: string,
  operation: string,
  documentsRead: number = 1,
  source: string = 'unknown'
): void {
  costMonitor.trackRead(collection, operation, documentsRead, source);
}

/**
 * Get current cost statistics
 */
export function getCostStats() {
  return costMonitor.getStats();
}

/**
 * Wrapper for Firebase queries with cost tracking
 */
export async function trackedFirebaseQuery<T>(
  collection: string,
  operation: string,
  queryFn: () => Promise<T>,
  estimatedReads: number = 1,
  source: string = 'unknown'
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    
    // Track the read operation
    trackFirebaseRead(collection, operation, estimatedReads, source);
    
    const duration = Date.now() - startTime;
    if (duration > 1000) { // Log slow queries
      console.warn(`🐌 SLOW QUERY: ${collection}.${operation} took ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ QUERY ERROR: ${collection}.${operation}`, error);
    throw error;
  }
}

// Auto-report stats every 10 minutes in development
if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const stats = costMonitor.getStats();
    if (stats.totalOperations > 0) {
      console.log(`💰 COST MONITOR: Daily: $${stats.dailyCost.toFixed(4)}, Hourly: $${stats.hourlyCost.toFixed(4)}, Operations: ${stats.totalOperations}`);
      
      // Show top expensive collections
      const topCollections = Object.entries(stats.breakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      if (topCollections.length > 0) {
        console.log('💸 Top expensive collections:', topCollections.map(([name, cost]) => `${name}: $${cost.toFixed(4)}`).join(', '));
      }
    }
  }, 600000); // 10 minutes
}
