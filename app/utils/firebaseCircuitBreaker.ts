/**
 * Firebase Circuit Breaker System
 * 
 * Prevents runaway Firebase reads by implementing circuit breaker patterns
 * and emergency throttling when read volumes exceed safe thresholds.
 */

interface CircuitBreakerConfig {
  maxReadsPerMinute: number;
  maxReadsPerHour: number;
  emergencyThreshold: number;
  recoveryTime: number;
  enabled: boolean;
}

interface ReadMetrics {
  readsThisMinute: number;
  readsThisHour: number;
  lastMinuteReset: number;
  lastHourReset: number;
  totalReads: number;
  blockedReads: number;
}

class FirebaseCircuitBreaker {
  private config: CircuitBreakerConfig = {
    maxReadsPerMinute: 500,    // 🚨 EMERGENCY: Max 500 reads/minute (was unlimited)
    maxReadsPerHour: 15000,    // 🚨 EMERGENCY: Max 15K reads/hour (was unlimited)
    emergencyThreshold: 1000,  // Emergency brake at 1K reads/minute
    recoveryTime: 300000,      // 5 minutes recovery time
    enabled: true
  };

  private metrics: ReadMetrics = {
    readsThisMinute: 0,
    readsThisHour: 0,
    lastMinuteReset: Date.now(),
    lastHourReset: Date.now(),
    totalReads: 0,
    blockedReads: 0
  };

  private isCircuitOpen = false;
  private lastCircuitOpenTime = 0;
  private emergencyMode = false;

  constructor() {
    this.startMetricsReset();
    this.logStatus();
  }

  /**
   * Check if a Firebase read should be allowed
   */
  shouldAllowRead(operation: string = 'unknown'): boolean {
    if (!this.config.enabled) {
      return true;
    }

    this.updateMetrics();

    // Emergency brake - immediately block if reads are out of control
    if (this.metrics.readsThisMinute > this.config.emergencyThreshold) {
      if (!this.emergencyMode) {
        console.error(`🚨 FIREBASE EMERGENCY BRAKE: ${this.metrics.readsThisMinute} reads/minute! Blocking all reads for 5 minutes.`);
        this.emergencyMode = true;
        this.isCircuitOpen = true;
        this.lastCircuitOpenTime = Date.now();
      }
      this.metrics.blockedReads++;
      return false;
    }

    // Check if circuit is open (in recovery mode)
    if (this.isCircuitOpen) {
      const timeSinceOpen = Date.now() - this.lastCircuitOpenTime;
      if (timeSinceOpen < this.config.recoveryTime) {
        this.metrics.blockedReads++;
        return false;
      } else {
        // Try to close circuit
        console.log('🔄 FIREBASE CIRCUIT BREAKER: Attempting to close circuit');
        this.isCircuitOpen = false;
        this.emergencyMode = false;
      }
    }

    // Check normal thresholds
    if (this.metrics.readsThisMinute >= this.config.maxReadsPerMinute) {
      console.warn(`⚠️ FIREBASE THROTTLE: Minute limit reached (${this.metrics.readsThisMinute}/${this.config.maxReadsPerMinute})`);
      this.metrics.blockedReads++;
      return false;
    }

    if (this.metrics.readsThisHour >= this.config.maxReadsPerHour) {
      console.warn(`⚠️ FIREBASE THROTTLE: Hour limit reached (${this.metrics.readsThisHour}/${this.config.maxReadsPerHour})`);
      this.isCircuitOpen = true;
      this.lastCircuitOpenTime = Date.now();
      this.metrics.blockedReads++;
      return false;
    }

    // Allow the read
    this.recordRead();
    return true;
  }

  /**
   * Record a Firebase read operation
   */
  private recordRead(): void {
    this.metrics.readsThisMinute++;
    this.metrics.readsThisHour++;
    this.metrics.totalReads++;
  }

  /**
   * Update metrics and reset counters as needed
   */
  private updateMetrics(): void {
    const now = Date.now();

    // Reset minute counter
    if (now - this.metrics.lastMinuteReset >= 60000) {
      this.metrics.readsThisMinute = 0;
      this.metrics.lastMinuteReset = now;
    }

    // Reset hour counter
    if (now - this.metrics.lastHourReset >= 3600000) {
      this.metrics.readsThisHour = 0;
      this.metrics.lastHourReset = now;
    }
  }

  /**
   * Start periodic metrics reset
   */
  private startMetricsReset(): void {
    // Reset minute counter every minute
    setInterval(() => {
      this.metrics.readsThisMinute = 0;
      this.metrics.lastMinuteReset = Date.now();
    }, 60000);

    // Reset hour counter every hour
    setInterval(() => {
      this.metrics.readsThisHour = 0;
      this.metrics.lastHourReset = Date.now();
    }, 3600000);
  }

  /**
   * Log status periodically
   */
  private logStatus(): void {
    setInterval(() => {
      if (this.metrics.readsThisMinute > 0 || this.isCircuitOpen) {
        console.log(`📊 FIREBASE CIRCUIT BREAKER STATUS:`, {
          readsThisMinute: this.metrics.readsThisMinute,
          readsThisHour: this.metrics.readsThisHour,
          totalReads: this.metrics.totalReads,
          blockedReads: this.metrics.blockedReads,
          circuitOpen: this.isCircuitOpen,
          emergencyMode: this.emergencyMode,
          savingsRate: this.metrics.blockedReads > 0 ? 
            ((this.metrics.blockedReads / (this.metrics.totalReads + this.metrics.blockedReads)) * 100).toFixed(1) + '%' : '0%'
        });
      }
    }, 60000); // Log every minute
  }

  /**
   * Get current metrics
   */
  getMetrics(): ReadMetrics & { circuitOpen: boolean; emergencyMode: boolean } {
    this.updateMetrics();
    return {
      ...this.metrics,
      circuitOpen: this.isCircuitOpen,
      emergencyMode: this.emergencyMode
    };
  }

  /**
   * Force circuit open (emergency stop)
   */
  forceCircuitOpen(reason: string): void {
    console.error(`🚨 FIREBASE EMERGENCY STOP: ${reason}`);
    this.isCircuitOpen = true;
    this.emergencyMode = true;
    this.lastCircuitOpenTime = Date.now();
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    console.log('🔄 FIREBASE CIRCUIT BREAKER: Manual reset');
    this.isCircuitOpen = false;
    this.emergencyMode = false;
    this.metrics.readsThisMinute = 0;
    this.metrics.readsThisHour = 0;
    this.metrics.blockedReads = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 FIREBASE CIRCUIT BREAKER: Configuration updated', this.config);
  }
}

// Global circuit breaker instance
export const firebaseCircuitBreaker = new FirebaseCircuitBreaker();

/**
 * Wrapper for Firebase operations with circuit breaker protection
 */
export async function protectedFirebaseOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'unknown'
): Promise<T | null> {
  if (!firebaseCircuitBreaker.shouldAllowRead(operationName)) {
    console.warn(`🚫 FIREBASE BLOCKED: ${operationName} - Circuit breaker active`);
    return null;
  }

  try {
    return await operation();
  } catch (error) {
    console.error(`❌ FIREBASE ERROR: ${operationName}`, error);
    throw error;
  }
}

/**
 * Get circuit breaker status
 */
export const getCircuitBreakerStatus = () => {
  return firebaseCircuitBreaker.getMetrics();
};

/**
 * Force emergency stop
 */
export const emergencyStopFirebase = (reason: string) => {
  firebaseCircuitBreaker.forceCircuitOpen(reason);
};

/**
 * Reset circuit breaker
 */
export const resetCircuitBreaker = () => {
  firebaseCircuitBreaker.reset();
};
