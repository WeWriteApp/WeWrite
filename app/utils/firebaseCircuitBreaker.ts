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

/**
 * Generic Circuit Breaker Pattern
 * (Consolidated from circuitBreaker.ts)
 *
 * Prevents cascading failures by temporarily blocking requests
 * when error rates exceed thresholds
 */
interface GenericCircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

class CircuitBreaker {
  private circuits = new Map<string, GenericCircuitBreakerState>();
  private readonly FAILURE_THRESHOLD = 5;
  private readonly TIMEOUT = 30000;
  private readonly RESET_TIMEOUT = 60000;

  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const circuit = this.getCircuit(key);

    if (circuit.state === 'OPEN') {
      const timeSinceFailure = Date.now() - circuit.lastFailureTime;
      if (timeSinceFailure < this.TIMEOUT) {
        if (fallback) return await fallback();
        throw new Error(`Circuit breaker is OPEN for ${key}. Try again later.`);
      } else {
        circuit.state = 'HALF_OPEN';
      }
    }

    try {
      const result = await operation();
      if (circuit.state === 'HALF_OPEN') {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
      } else if (circuit.failures > 0 && Date.now() - circuit.lastFailureTime > this.RESET_TIMEOUT) {
        circuit.failures = 0;
      }
      return result;
    } catch (error) {
      circuit.failures++;
      circuit.lastFailureTime = Date.now();
      if (circuit.failures >= this.FAILURE_THRESHOLD) {
        circuit.state = 'OPEN';
      }
      if (fallback && circuit.state === 'OPEN') {
        return await fallback();
      }
      throw error;
    }
  }

  private getCircuit(key: string): GenericCircuitBreakerState {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, { failures: 0, lastFailureTime: 0, state: 'CLOSED' });
    }
    return this.circuits.get(key)!;
  }

  getStatus(key: string): GenericCircuitBreakerState | null {
    return this.circuits.get(key) || null;
  }

  reset(key: string): void {
    const circuit = this.circuits.get(key);
    if (circuit) {
      circuit.failures = 0;
      circuit.state = 'CLOSED';
      circuit.lastFailureTime = 0;
    }
  }
}

export const circuitBreaker = new CircuitBreaker();
