/**
 * Simple Circuit Breaker Pattern
 * 
 * Prevents cascading failures by temporarily blocking requests
 * when error rates exceed thresholds
 */

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

class CircuitBreaker {
  private circuits = new Map<string, CircuitBreakerState>();
  private readonly FAILURE_THRESHOLD = 5; // Open circuit after 5 failures
  private readonly TIMEOUT = 30000; // 30 seconds before trying again
  private readonly RESET_TIMEOUT = 60000; // 1 minute to reset failure count

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const circuit = this.getCircuit(key);
    
    // Check if circuit is open
    if (circuit.state === 'OPEN') {
      const timeSinceFailure = Date.now() - circuit.lastFailureTime;
      
      if (timeSinceFailure < this.TIMEOUT) {
        console.warn(`🚫 Circuit breaker OPEN for ${key} - blocking request`);
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Circuit breaker is OPEN for ${key}. Try again later.`);
      } else {
        // Move to half-open state
        circuit.state = 'HALF_OPEN';
        console.log(`🔄 Circuit breaker HALF_OPEN for ${key} - trying request`);
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit
      if (circuit.state === 'HALF_OPEN') {
        console.log(`✅ Circuit breaker CLOSED for ${key} - request succeeded`);
        circuit.state = 'CLOSED';
        circuit.failures = 0;
      } else if (circuit.failures > 0) {
        // Reset failure count on success
        const timeSinceFailure = Date.now() - circuit.lastFailureTime;
        if (timeSinceFailure > this.RESET_TIMEOUT) {
          circuit.failures = 0;
        }
      }
      
      return result;
      
    } catch (error) {
      circuit.failures++;
      circuit.lastFailureTime = Date.now();
      
      if (circuit.failures >= this.FAILURE_THRESHOLD) {
        circuit.state = 'OPEN';
        console.error(`🚨 Circuit breaker OPENED for ${key} after ${circuit.failures} failures`);
      }
      
      console.error(`❌ Circuit breaker failure ${circuit.failures}/${this.FAILURE_THRESHOLD} for ${key}:`, error);
      
      if (fallback && circuit.state === 'OPEN') {
        return await fallback();
      }
      
      throw error;
    }
  }

  /**
   * Get or create circuit state
   */
  private getCircuit(key: string): CircuitBreakerState {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED'
      });
    }
    return this.circuits.get(key)!;
  }

  /**
   * Get circuit status for monitoring
   */
  getStatus(key: string): CircuitBreakerState | null {
    return this.circuits.get(key) || null;
  }

  /**
   * Manually reset a circuit
   */
  reset(key: string): void {
    const circuit = this.circuits.get(key);
    if (circuit) {
      circuit.failures = 0;
      circuit.state = 'CLOSED';
      circuit.lastFailureTime = 0;
      console.log(`🔄 Circuit breaker manually reset for ${key}`);
    }
  }
}

// Global circuit breaker instance
export const circuitBreaker = new CircuitBreaker();
