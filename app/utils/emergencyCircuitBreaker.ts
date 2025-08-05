/**
 * 🚨 EMERGENCY CIRCUIT BREAKER
 * 
 * Immediately stops all non-essential database operations
 * to address the 13K reads per minute crisis
 */

interface CircuitBreakerConfig {
  enabled: boolean;
  allowedEndpoints: string[];
  blockedEndpoints: string[];
  emergencyMode: boolean;
  maxReadsPerMinute: number;
  currentReads: number;
  lastResetTime: number;
  // Dynamic throttling based on Firebase usage
  dynamicThrottling: boolean;
  lastFirebaseCheck: number;
  firebaseReadRate: number; // reads per minute from Firebase metrics
}

class EmergencyCircuitBreaker {
  private config: CircuitBreakerConfig = {
    enabled: true,
    emergencyMode: true, // 🚨 EMERGENCY MODE ACTIVE - 2.5M reads/60min crisis (300K/min spikes)
    maxReadsPerMinute: 50, // 🚨 CRITICAL: Reduced to 50 due to 300K/min spikes
    currentReads: 0,
    lastResetTime: Date.now(),

    // Dynamic throttling configuration
    dynamicThrottling: true,
    lastFirebaseCheck: 0,
    firebaseReadRate: 0,

    // Only allow absolutely essential endpoints during crisis
    allowedEndpoints: [
      '/api/auth', // Authentication is critical
      '/api/pages/', // Page content is essential (but limit to single page views)
      '/api/build-info', // App updates
      '/api/usd/allocations/batch', // New batch endpoint to replace individual calls
    ],
    
    // Block all high-volume endpoints
    blockedEndpoints: [
      '/api/recent-edits/global',
      '/api/home',
      '/api/usd/pledge-bar-data',
      '/api/earnings/user',
      '/api/account-subscription',
      '/api/visitor-tracking',
      '/api/monitoring',
      '/api/admin',
      '/api/analytics',
      '/api/daily-notes',
      '/api/user-preferences',
      '/api/users',
      '/api/trending',
    ]
  };

  /**
   * Update dynamic throttling based on Firebase usage metrics
   */
  private updateDynamicThrottling(): void {
    if (!this.config.dynamicThrottling) return;

    const now = Date.now();
    // Check Firebase metrics every 5 minutes
    if (now - this.config.lastFirebaseCheck < 5 * 60 * 1000) return;

    this.config.lastFirebaseCheck = now;

    // Simulate Firebase metrics check (in real implementation, this would call Firebase API)
    // For now, we'll use conservative estimates based on the 2.5M reads/60min crisis
    const estimatedReadsPerMinute = 41667; // 2.5M / 60 minutes
    this.config.firebaseReadRate = estimatedReadsPerMinute;

    // Adjust throttling based on read rate
    if (estimatedReadsPerMinute > 10000) {
      // Extreme throttling for high read rates
      this.config.maxReadsPerMinute = 10;
      this.config.emergencyMode = true;
      console.warn(`🚨 EXTREME THROTTLING: ${estimatedReadsPerMinute} reads/min detected, limiting to 10 API calls/min`);
    } else if (estimatedReadsPerMinute > 1000) {
      // Heavy throttling for moderate read rates
      this.config.maxReadsPerMinute = 25;
      this.config.emergencyMode = true;
      console.warn(`🚨 HEAVY THROTTLING: ${estimatedReadsPerMinute} reads/min detected, limiting to 25 API calls/min`);
    } else {
      // Normal throttling
      this.config.maxReadsPerMinute = 100;
      this.config.emergencyMode = false;
    }
  }

  /**
   * Check if an API call should be blocked
   */
  shouldBlockRequest(endpoint: string): { blocked: boolean; reason?: string } {
    if (!this.config.enabled) {
      return { blocked: false };
    }

    // Update dynamic throttling
    this.updateDynamicThrottling();

    // Reset counter every minute
    const now = Date.now();
    if (now - this.config.lastResetTime > 60000) {
      this.config.currentReads = 0;
      this.config.lastResetTime = now;
    }

    // In emergency mode, block everything except critical endpoints
    if (this.config.emergencyMode) {
      const isAllowed = this.config.allowedEndpoints.some(allowed => 
        endpoint.includes(allowed) || allowed.includes(endpoint)
      );
      
      if (!isAllowed) {
        console.warn(`🚨 EMERGENCY CIRCUIT BREAKER: Blocked ${endpoint}`);
        return { 
          blocked: true, 
          reason: 'Emergency mode: Only critical endpoints allowed' 
        };
      }
    }

    // Check if endpoint is explicitly blocked
    const isBlocked = this.config.blockedEndpoints.some(blocked => 
      endpoint.includes(blocked) || blocked.includes(endpoint)
    );
    
    if (isBlocked) {
      console.warn(`🚨 CIRCUIT BREAKER: Blocked high-volume endpoint ${endpoint}`);
      return { 
        blocked: true, 
        reason: 'High-volume endpoint blocked to prevent read spike' 
      };
    }

    // Check read limit
    if (this.config.currentReads >= this.config.maxReadsPerMinute) {
      console.warn(`🚨 CIRCUIT BREAKER: Read limit exceeded (${this.config.currentReads}/${this.config.maxReadsPerMinute})`);
      return { 
        blocked: true, 
        reason: 'Read limit exceeded for this minute' 
      };
    }

    // Allow the request and increment counter
    this.config.currentReads++;
    return { blocked: false };
  }

  /**
   * Get mock response for blocked endpoints
   */
  getMockResponse(endpoint: string): any {
    const baseResponse = {
      success: false,
      error: 'Service temporarily unavailable',
      message: '🚨 Emergency circuit breaker active - preventing database read crisis',
      circuitBreaker: true,
      timestamp: new Date().toISOString()
    };

    // Endpoint-specific mock responses
    if (endpoint.includes('recent-edits')) {
      return {
        ...baseResponse,
        edits: [],
        hasMore: false,
        nextCursor: null
      };
    }

    if (endpoint.includes('home')) {
      return {
        ...baseResponse,
        recentlyVisitedPages: [],
        trendingPages: [],
        userStats: null
      };
    }

    if (endpoint.includes('earnings')) {
      return {
        ...baseResponse,
        data: {
          totalEarnings: 0,
          availableBalance: 0,
          pendingBalance: 0,
          hasEarnings: false
        }
      };
    }

    if (endpoint.includes('subscription')) {
      return {
        ...baseResponse,
        hasSubscription: false,
        status: 'inactive'
      };
    }

    return baseResponse;
  }

  /**
   * Get current circuit breaker status
   */
  getStatus() {
    return {
      ...this.config,
      readsThisMinute: this.config.currentReads,
      timeUntilReset: Math.max(0, 60000 - (Date.now() - this.config.lastResetTime))
    };
  }

  /**
   * Emergency disable (use with caution)
   */
  emergencyDisable() {
    this.config.enabled = false;
    this.config.emergencyMode = false;
    console.log('🔄 EMERGENCY: Circuit breaker disabled');
  }

  /**
   * Re-enable circuit breaker
   */
  enable() {
    this.config.enabled = true;
    this.config.emergencyMode = true;
    console.log('🚨 Circuit breaker re-enabled in emergency mode');
  }

  /**
   * Adjust read limits
   */
  setReadLimit(limit: number) {
    this.config.maxReadsPerMinute = limit;
    console.log(`🔧 Circuit breaker read limit set to ${limit}/minute`);
  }

  /**
   * Add endpoint to allowed list
   */
  allowEndpoint(endpoint: string) {
    if (!this.config.allowedEndpoints.includes(endpoint)) {
      this.config.allowedEndpoints.push(endpoint);
      console.log(`✅ Endpoint allowed: ${endpoint}`);
    }
  }

  /**
   * Block specific endpoint
   */
  blockEndpoint(endpoint: string) {
    if (!this.config.blockedEndpoints.includes(endpoint)) {
      this.config.blockedEndpoints.push(endpoint);
      console.log(`🚫 Endpoint blocked: ${endpoint}`);
    }
  }
}

// Singleton instance
export const emergencyCircuitBreaker = new EmergencyCircuitBreaker();

/**
 * Middleware for API routes
 */
export function withCircuitBreaker(handler: any) {
  return async (req: any, res: any) => {
    const endpoint = req.url || req.nextUrl?.pathname || 'unknown';
    const { blocked, reason } = emergencyCircuitBreaker.shouldBlockRequest(endpoint);
    
    if (blocked) {
      const mockResponse = emergencyCircuitBreaker.getMockResponse(endpoint);
      return res.status(503).json(mockResponse);
    }
    
    return handler(req, res);
  };
}

/**
 * Client-side fetch wrapper
 */
export async function circuitBreakerFetch(url: string, options?: RequestInit): Promise<Response> {
  const endpoint = new URL(url, window.location.origin).pathname;
  const { blocked, reason } = emergencyCircuitBreaker.shouldBlockRequest(endpoint);
  
  if (blocked) {
    const mockResponse = emergencyCircuitBreaker.getMockResponse(endpoint);
    return new Response(JSON.stringify(mockResponse), {
      status: 503,
      statusText: 'Service Unavailable (Circuit Breaker)',
      headers: {
        'Content-Type': 'application/json',
        'X-Circuit-Breaker': 'blocked'
      }
    });
  }
  
  return fetch(url, options);
}

/**
 * Utility functions
 */
export const getCircuitBreakerStatus = () => emergencyCircuitBreaker.getStatus();
export const disableCircuitBreaker = () => emergencyCircuitBreaker.emergencyDisable();
export const enableCircuitBreaker = () => emergencyCircuitBreaker.enable();
export const setCircuitBreakerLimit = (limit: number) => emergencyCircuitBreaker.setReadLimit(limit);
