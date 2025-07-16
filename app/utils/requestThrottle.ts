/**
 * Request Throttling Utility
 * 
 * Prevents excessive network requests that can cause ERR_INSUFFICIENT_RESOURCES errors
 * by implementing global request throttling and monitoring.
 */

interface RequestTracker {
  count: number;
  lastReset: number;
  blocked: number;
}

class RequestThrottleManager {
  private tracker: RequestTracker = {
    count: 0,
    lastReset: Date.now(),
    blocked: 0
  };

  private readonly MAX_REQUESTS_PER_MINUTE = 60; // Reduced from typical 100+ to prevent resource exhaustion
  private readonly RESET_INTERVAL = 60 * 1000; // 1 minute
  private readonly BURST_LIMIT = 10; // Max requests in a 5-second burst
  private readonly BURST_WINDOW = 5 * 1000; // 5 seconds

  private burstTracker: number[] = [];

  /**
   * Check if a request should be allowed
   */
  public shouldAllowRequest(requestType: string = 'general'): boolean {
    const now = Date.now();

    // Reset counters if interval has passed
    if (now - this.tracker.lastReset > this.RESET_INTERVAL) {
      this.tracker.count = 0;
      this.tracker.lastReset = now;
      this.burstTracker = [];
    }

    // Check burst limit
    this.burstTracker = this.burstTracker.filter(time => now - time < this.BURST_WINDOW);
    if (this.burstTracker.length >= this.BURST_LIMIT) {
      this.tracker.blocked++;
      console.warn(`[RequestThrottle] Burst limit exceeded for ${requestType}. Blocking request.`);
      return false;
    }

    // Check overall rate limit
    if (this.tracker.count >= this.MAX_REQUESTS_PER_MINUTE) {
      this.tracker.blocked++;
      console.warn(`[RequestThrottle] Rate limit exceeded for ${requestType}. Blocking request.`);
      return false;
    }

    // Allow request
    this.tracker.count++;
    this.burstTracker.push(now);
    return true;
  }

  /**
   * Get current throttling statistics
   */
  public getStats() {
    return {
      ...this.tracker,
      burstCount: this.burstTracker.length,
      timeUntilReset: Math.max(0, this.RESET_INTERVAL - (Date.now() - this.tracker.lastReset))
    };
  }

  /**
   * Reset all counters (for testing or manual reset)
   */
  public reset() {
    this.tracker = {
      count: 0,
      lastReset: Date.now(),
      blocked: 0
    };
    this.burstTracker = [];
  }
}

// Global instance
const requestThrottleManager = new RequestThrottleManager();

/**
 * Throttled fetch wrapper that respects global rate limits
 */
export const throttledFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  const requestType = `fetch:${new URL(url, window.location.origin).pathname}`;
  
  if (!requestThrottleManager.shouldAllowRequest(requestType)) {
    throw new Error(`Request throttled: ${requestType}`);
  }

  return fetch(url, options);
};

/**
 * Check if a request type should be allowed
 */
export const shouldAllowRequest = (requestType: string): boolean => {
  return requestThrottleManager.shouldAllowRequest(requestType);
};

/**
 * Get throttling statistics
 */
export const getThrottleStats = () => {
  return requestThrottleManager.getStats();
};

/**
 * Reset throttling counters
 */
export const resetThrottle = () => {
  requestThrottleManager.reset();
};

/**
 * Debounced function creator with built-in throttling
 */
export const createThrottledDebounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  requestType: string
): T => {
  let timeoutId: NodeJS.Timeout | null = null;

  return ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      if (shouldAllowRequest(requestType)) {
        func(...args);
      } else {
        console.warn(`[RequestThrottle] Debounced function blocked: ${requestType}`);
      }
    }, delay);
  }) as T;
};

/**
 * Monitor and log excessive request patterns
 */
export const monitorRequestPatterns = () => {
  if (typeof window === 'undefined') return;

  // Disable request monitoring in development to prevent feedback loops
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  // Monitor fetch requests
  const originalFetch = window.fetch;
  let requestCount = 0;
  let lastLogTime = Date.now();

  window.fetch = async (...args) => {
    requestCount++;

    // Log warning if too many requests in a short time
    const now = Date.now();
    if (now - lastLogTime > 60000) { // Every 60 seconds (reduced frequency further)
      if (requestCount > 200) { // Much higher threshold to reduce noise
        console.warn(`[RequestMonitor] High request volume detected: ${requestCount} requests in 60 seconds`);
      }
      requestCount = 0;
      lastLogTime = now;
    }

    return originalFetch(...args);
  };
};

// Auto-start monitoring in browser environment
if (typeof window !== 'undefined') {
  monitorRequestPatterns();
}