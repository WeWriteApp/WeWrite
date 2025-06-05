/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by temporarily disabling operations
 * that are likely to fail, allowing the system to recover gracefully.
 * Test comment for Vercel build verification
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

// Page reload circuit breaker with enhanced infinite reload detection
export const pageReloadBreaker = getCircuitBreaker('page_reload', {
  failureThreshold: 3, // Trigger after 3 consecutive reloads
  resetTimeMs: 30000 // 30 seconds window
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

/**
 * Page-specific refresh circuit breaker for preventing infinite refresh loops
 * Tracks automatic refreshes per page ID within a time window
 */
class PageRefreshCircuitBreaker {
  constructor() {
    this.pageRefreshData = new Map();
    this.REFRESH_THRESHOLD = 3; // 3 consecutive automatic refreshes
    this.TIME_WINDOW_MS = 30000; // 30 seconds
    this.RESET_TIME_MS = 300000; // 5 minutes
    this.INACTIVITY_RESET_MS = 300000; // 5 minutes of inactivity
  }

  /**
   * Get refresh data for a specific page
   */
  getPageData(pageId) {
    if (!this.pageRefreshData.has(pageId)) {
      this.pageRefreshData.set(pageId, {
        refreshCount: 0,
        firstRefreshTime: null,
        lastRefreshTime: null,
        lastActivityTime: Date.now(),
        isBlocked: false,
        blockedUntil: null
      });
    }
    return this.pageRefreshData.get(pageId);
  }

  /**
   * Record user activity (navigation, interaction) to reset inactivity timer
   */
  recordActivity(pageId) {
    const data = this.getPageData(pageId);
    data.lastActivityTime = Date.now();

    // Reset refresh count if enough time has passed since last activity
    const timeSinceLastRefresh = data.lastRefreshTime ?
      Date.now() - data.lastRefreshTime : Infinity;

    if (timeSinceLastRefresh > this.INACTIVITY_RESET_MS) {
      this.resetPageData(pageId);
    }
  }

  /**
   * Record an automatic refresh attempt
   */
  recordRefresh(pageId, isAutomatic = true) {
    // Only track automatic refreshes, not user-initiated ones
    if (!isAutomatic) {
      this.recordActivity(pageId);
      return false;
    }

    const data = this.getPageData(pageId);
    const now = Date.now();

    // Check if we're still in the blocked period
    if (data.isBlocked && data.blockedUntil && now < data.blockedUntil) {
      console.warn(`Page refresh circuit breaker: Page ${pageId} is blocked until ${new Date(data.blockedUntil)}`);
      return true; // Blocked
    }

    // Reset if enough time has passed since first refresh
    if (data.firstRefreshTime && (now - data.firstRefreshTime) > this.TIME_WINDOW_MS) {
      this.resetPageData(pageId);
      data = this.getPageData(pageId); // Get fresh data
    }

    // Reset if enough inactivity time has passed
    if (data.lastActivityTime && (now - data.lastActivityTime) > this.INACTIVITY_RESET_MS) {
      this.resetPageData(pageId);
      data = this.getPageData(pageId); // Get fresh data
    }

    // Record the refresh
    data.refreshCount++;
    data.lastRefreshTime = now;
    if (!data.firstRefreshTime) {
      data.firstRefreshTime = now;
    }

    console.log(`Page refresh circuit breaker: Recorded refresh ${data.refreshCount}/${this.REFRESH_THRESHOLD} for page ${pageId}`);

    // Check if we've hit the threshold
    if (data.refreshCount >= this.REFRESH_THRESHOLD) {
      data.isBlocked = true;
      data.blockedUntil = now + this.RESET_TIME_MS;

      console.error(`Page refresh circuit breaker: TRIGGERED for page ${pageId}. Blocked until ${new Date(data.blockedUntil)}`);

      // Log the incident for debugging
      this.logIncident(pageId, data);

      return true; // Blocked
    }

    return false; // Not blocked
  }

  /**
   * Check if a page is currently blocked
   */
  isPageBlocked(pageId) {
    const data = this.getPageData(pageId);
    const now = Date.now();

    if (data.isBlocked && data.blockedUntil && now < data.blockedUntil) {
      return true;
    }

    // Auto-reset if block period has expired
    if (data.isBlocked && data.blockedUntil && now >= data.blockedUntil) {
      this.resetPageData(pageId);
    }

    return false;
  }

  /**
   * Reset data for a specific page
   */
  resetPageData(pageId) {
    console.log(`Page refresh circuit breaker: Resetting data for page ${pageId}`);
    this.pageRefreshData.set(pageId, {
      refreshCount: 0,
      firstRefreshTime: null,
      lastRefreshTime: null,
      lastActivityTime: Date.now(),
      isBlocked: false,
      blockedUntil: null
    });
  }

  /**
   * Record successful page load
   */
  recordSuccess(pageId) {
    const data = this.getPageData(pageId);
    data.lastActivityTime = Date.now();

    // Reset refresh count on successful load
    data.refreshCount = 0;
    data.firstRefreshTime = null;
    data.lastRefreshTime = null;

    console.log(`Page refresh circuit breaker: Recorded successful load for page ${pageId}`);
  }

  /**
   * Log incident for debugging purposes
   */
  logIncident(pageId, data) {
    const incident = {
      timestamp: new Date().toISOString(),
      pageId,
      refreshCount: data.refreshCount,
      timeWindow: this.TIME_WINDOW_MS,
      firstRefreshTime: data.firstRefreshTime ? new Date(data.firstRefreshTime).toISOString() : null,
      lastRefreshTime: data.lastRefreshTime ? new Date(data.lastRefreshTime).toISOString() : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    };

    console.error('Page refresh circuit breaker incident:', incident);

    // Store incident in localStorage for debugging
    try {
      const incidents = JSON.parse(localStorage.getItem('wewrite_refresh_incidents') || '[]');
      incidents.push(incident);

      // Keep only last 10 incidents
      if (incidents.length > 10) {
        incidents.splice(0, incidents.length - 10);
      }

      localStorage.setItem('wewrite_refresh_incidents', JSON.stringify(incidents));
    } catch (error) {
      console.error('Failed to store refresh incident:', error);
    }
  }

  /**
   * Get status for debugging
   */
  getStatus(pageId) {
    const data = this.getPageData(pageId);
    const now = Date.now();

    return {
      pageId,
      refreshCount: data.refreshCount,
      threshold: this.REFRESH_THRESHOLD,
      isBlocked: this.isPageBlocked(pageId),
      timeUntilReset: data.blockedUntil ? Math.max(0, data.blockedUntil - now) : 0,
      timeSinceFirstRefresh: data.firstRefreshTime ? now - data.firstRefreshTime : 0,
      timeSinceLastActivity: data.lastActivityTime ? now - data.lastActivityTime : 0
    };
  }

  /**
   * Get all incidents for debugging
   */
  getIncidents() {
    try {
      return JSON.parse(localStorage.getItem('wewrite_refresh_incidents') || '[]');
    } catch (error) {
      console.error('Failed to retrieve refresh incidents:', error);
      return [];
    }
  }

  /**
   * Clear all incidents
   */
  clearIncidents() {
    try {
      localStorage.removeItem('wewrite_refresh_incidents');
      console.log('Page refresh circuit breaker: Cleared all incidents');
    } catch (error) {
      console.error('Failed to clear refresh incidents:', error);
    }
  }
}

// Global instance
export const pageRefreshCircuitBreaker = new PageRefreshCircuitBreaker();

export default CircuitBreaker;
