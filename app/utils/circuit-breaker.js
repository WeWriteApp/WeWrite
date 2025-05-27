/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by temporarily disabling operations
 * that are likely to fail, allowing the system to recover gracefully.
 */

const CIRCUIT_BREAKER_KEY = 'circuit_breaker_state';
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_RESET_TIME_MS = 60000; // 1 minute

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || DEFAULT_FAILURE_THRESHOLD;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.resetTimeMs = options.resetTimeMs || DEFAULT_RESET_TIME_MS;

    this.state = this.loadState();
  }

  loadState() {
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(`${CIRCUIT_BREAKER_KEY}_${this.name}`);
        if (stored) {
          const state = JSON.parse(stored);

          // Check if we should reset from OPEN to HALF_OPEN
          if (state.state === 'OPEN' && Date.now() - state.lastFailureTime > this.resetTimeMs) {
            return {
              state: 'HALF_OPEN',
              failureCount: 0,
              lastFailureTime: null,
              lastSuccessTime: Date.now()
            };
          }

          return state;
        }
      }
    } catch (error) {
      console.error('Error loading circuit breaker state:', error);
    }

    return {
      state: 'CLOSED', // CLOSED = normal operation, OPEN = failing, HALF_OPEN = testing
      failureCount: 0,
      lastFailureTime: null,
      lastSuccessTime: null
    };
  }

  saveState() {
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(
          `${CIRCUIT_BREAKER_KEY}_${this.name}`,
          JSON.stringify(this.state)
        );
      }
    } catch (error) {
      console.error('Error saving circuit breaker state:', error);
    }
  }

  /**
   * Check if the operation should be allowed
   */
  canExecute() {
    if (this.state.state === 'OPEN') {
      console.warn(`Circuit breaker ${this.name} is OPEN - blocking operation`);
      return false;
    }

    return true;
  }

  /**
   * Record a successful operation
   */
  recordSuccess() {
    this.state.failureCount = 0;
    this.state.lastSuccessTime = Date.now();

    if (this.state.state === 'HALF_OPEN') {
      console.log(`Circuit breaker ${this.name} recovered - moving to CLOSED`);
      this.state.state = 'CLOSED';
    }

    this.saveState();
  }

  /**
   * Record a failed operation
   */
  recordFailure() {
    this.state.failureCount += 1;
    this.state.lastFailureTime = Date.now();

    if (this.state.failureCount >= this.failureThreshold) {
      console.warn(`Circuit breaker ${this.name} tripped - moving to OPEN`);
      this.state.state = 'OPEN';
    }

    this.saveState();
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute(operation) {
    if (!this.canExecute()) {
      throw new Error(`Circuit breaker ${this.name} is OPEN`);
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Get current state information
   */
  getState() {
    return {
      name: this.name,
      state: this.state.state,
      failureCount: this.state.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.state.lastFailureTime,
      lastSuccessTime: this.state.lastSuccessTime
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset() {
    console.log(`Circuit breaker ${this.name} manually reset`);
    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: null,
      lastSuccessTime: Date.now()
    };
    this.saveState();
  }
}

// Global circuit breakers for common operations
const circuitBreakers = new Map();

/**
 * Get or create a circuit breaker for a specific operation
 */
export function getCircuitBreaker(name, options = {}) {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, options));
  }
  return circuitBreakers.get(name);
}

/**
 * Execute an operation with circuit breaker protection
 */
export async function executeWithCircuitBreaker(name, operation, options = {}) {
  const breaker = getCircuitBreaker(name, options);
  return breaker.execute(operation);
}

/**
 * Check if an operation is allowed by its circuit breaker
 */
export function canExecuteOperation(name) {
  const breaker = getCircuitBreaker(name);
  return breaker.canExecute();
}

/**
 * Get the state of all circuit breakers
 */
export function getAllCircuitBreakerStates() {
  const states = {};
  for (const [name, breaker] of circuitBreakers) {
    states[name] = breaker.getState();
  }
  return states;
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers() {
  console.log('Resetting all circuit breakers');
  for (const [name, breaker] of circuitBreakers) {
    breaker.reset();
  }
}

/**
 * Specific circuit breakers for common operations
 */

// Page reload circuit breaker
export const pageReloadBreaker = getCircuitBreaker('page_reload', {
  failureThreshold: 2,
  resetTimeMs: 120000 // 2 minutes
});

// Analytics script loading circuit breaker
export const analyticsBreaker = getCircuitBreaker('analytics_scripts', {
  failureThreshold: 3,
  resetTimeMs: 300000 // 5 minutes
});

// Data loading circuit breaker
export const dataLoadingBreaker = getCircuitBreaker('data_loading', {
  failureThreshold: 5,
  resetTimeMs: 60000 // 1 minute
});

export default CircuitBreaker;
