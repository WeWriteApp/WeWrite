/**
 * Emergency Database Read Optimizer
 * 
 * Automatically detects and mitigates excessive database read patterns
 * to prevent cost overruns and performance issues.
 */

import { databaseReadAnalyzer } from './databaseReadAnalyzer';

interface OptimizationRule {
  name: string;
  condition: (analysis: any) => boolean;
  action: (analysis: any) => Promise<void>;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

interface CircuitBreakerState {
  endpoint: string;
  isOpen: boolean;
  failureCount: number;
  lastFailure: number;
  nextAttempt: number;
}

class EmergencyReadOptimizer {
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private rateLimiters = new Map<string, { count: number; resetTime: number }>();
  private optimizationRules: OptimizationRule[] = [];
  private isActive = false;

  constructor() {
    this.setupOptimizationRules();
  }

  /**
   * Setup automatic optimization rules
   */
  private setupOptimizationRules(): void {
    this.optimizationRules = [
      {
        name: 'Emergency Circuit Breaker',
        condition: (analysis) => analysis.readsPerMinute > 2000,
        action: async (analysis) => {
          console.error('🚨 EMERGENCY: Activating circuit breakers for high-volume endpoints');
          for (const pattern of analysis.topOffenders.slice(0, 5)) {
            this.activateCircuitBreaker(pattern.endpoint, 60000); // 1 minute
          }
        },
        priority: 'critical',
        description: 'Activate circuit breakers when reads exceed 2000/min'
      },
      {
        name: 'Rate Limit High Frequency Endpoints',
        condition: (analysis) => analysis.suspiciousPatterns.length > 0,
        action: async (analysis) => {
          console.warn('⚠️ Applying rate limits to suspicious endpoints');
          for (const pattern of analysis.suspiciousPatterns) {
            this.applyRateLimit(pattern.endpoint, 100, 60000); // 100 requests per minute
          }
        },
        priority: 'high',
        description: 'Apply rate limiting to endpoints with suspicious activity'
      },
      {
        name: 'Cache Warming for Low Hit Rates',
        condition: (analysis) => {
          return analysis.topOffenders.some(p => p.cacheHitRate < 30 && p.totalReads > 50);
        },
        action: async (analysis) => {
          console.log('🔥 Warming caches for low hit rate endpoints');
          const lowCacheEndpoints = analysis.topOffenders.filter(p => p.cacheHitRate < 30);
          for (const pattern of lowCacheEndpoints.slice(0, 3)) {
            await this.warmCache(pattern.endpoint);
          }
        },
        priority: 'medium',
        description: 'Warm caches for endpoints with low hit rates'
      },
      {
        name: 'Disable Non-Essential Polling',
        condition: (analysis) => analysis.readsPerMinute > 1000,
        action: async (analysis) => {
          console.warn('🛑 Disabling non-essential polling to reduce load');
          this.disableNonEssentialPolling();
        },
        priority: 'high',
        description: 'Disable non-essential polling when reads exceed 1000/min'
      }
    ];
  }

  /**
   * Run optimization analysis and apply fixes
   */
  async optimize(): Promise<void> {
    if (this.isActive) {
      console.log('⏳ Optimization already in progress, skipping...');
      return;
    }

    this.isActive = true;

    try {
      const analysis = databaseReadAnalyzer.analyzeReads();
      
      console.log(`📊 Read Analysis: ${analysis.readsPerMinute.toFixed(1)} reads/min, $${analysis.costEstimate.toFixed(4)} estimated cost`);

      // Apply optimization rules in priority order
      const sortedRules = this.optimizationRules.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      for (const rule of sortedRules) {
        if (rule.condition(analysis)) {
          console.log(`🔧 Applying optimization: ${rule.name}`);
          await rule.action(analysis);
        }
      }

    } catch (error) {
      console.error('❌ Error during optimization:', error);
    } finally {
      this.isActive = false;
    }
  }

  /**
   * Check if endpoint is circuit broken
   */
  isCircuitBroken(endpoint: string): boolean {
    const breaker = this.circuitBreakers.get(endpoint);
    if (!breaker || !breaker.isOpen) return false;

    // Check if circuit should be reset
    if (Date.now() >= breaker.nextAttempt) {
      breaker.isOpen = false;
      breaker.failureCount = 0;
      console.log(`🔄 Circuit breaker reset for ${endpoint}`);
      return false;
    }

    return true;
  }

  /**
   * Activate circuit breaker for endpoint
   */
  private activateCircuitBreaker(endpoint: string, duration: number): void {
    const breaker: CircuitBreakerState = {
      endpoint,
      isOpen: true,
      failureCount: 0,
      lastFailure: Date.now(),
      nextAttempt: Date.now() + duration
    };

    this.circuitBreakers.set(endpoint, breaker);
    console.warn(`🚫 Circuit breaker activated for ${endpoint} (${duration}ms)`);
  }

  /**
   * Check if request should be rate limited
   */
  shouldRateLimit(endpoint: string, userId?: string): boolean {
    const key = `${endpoint}:${userId || 'anonymous'}`;
    const limiter = this.rateLimiters.get(key);
    const now = Date.now();

    if (!limiter || now >= limiter.resetTime) {
      // Reset or create new limiter
      this.rateLimiters.set(key, { count: 1, resetTime: now + 60000 });
      return false;
    }

    limiter.count++;
    return limiter.count > 100; // Default limit
  }

  /**
   * Apply rate limit to endpoint
   */
  private applyRateLimit(endpoint: string, limit: number, windowMs: number): void {
    // This would integrate with your existing rate limiting system
    console.log(`🚦 Rate limit applied to ${endpoint}: ${limit} requests per ${windowMs}ms`);
  }

  /**
   * Warm cache for endpoint
   */
  private async warmCache(endpoint: string): Promise<void> {
    try {
      // This would make a few strategic requests to warm the cache
      console.log(`🔥 Cache warming initiated for ${endpoint}`);
      
      // Example: Make a few common requests to warm the cache
      if (endpoint.includes('pledge-bar-data')) {
        // Could make requests for common user/page combinations
      } else if (endpoint.includes('user-profile')) {
        // Could pre-load popular user profiles
      }
    } catch (error) {
      console.error(`❌ Cache warming failed for ${endpoint}:`, error);
    }
  }

  /**
   * Disable non-essential polling
   */
  private disableNonEssentialPolling(): void {
    // This would integrate with your polling systems
    console.log('🛑 Disabling non-essential polling systems');
    
    // Example: Increase polling intervals or disable certain polls
    if (typeof window !== 'undefined') {
      // Client-side polling adjustments
      try {
        window.dispatchEvent(new CustomEvent('emergency-optimization', {
          detail: { action: 'disable-polling' }
        }));
      } catch (error) {
        console.warn('Failed to dispatch emergency optimization event:', error);
      }
    }
  }

  /**
   * Get optimization status
   */
  getStatus(): any {
    return {
      isActive: this.isActive,
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([endpoint, state]) => ({
        endpoint,
        isOpen: state.isOpen,
        nextAttempt: state.nextAttempt
      })),
      rateLimiters: this.rateLimiters.size,
      rules: this.optimizationRules.map(rule => ({
        name: rule.name,
        priority: rule.priority,
        description: rule.description
      }))
    };
  }

  /**
   * Manual override to disable optimization
   */
  disable(): void {
    this.isActive = false;
    this.circuitBreakers.clear();
    this.rateLimiters.clear();
    console.log('🔓 Emergency optimization disabled');
  }

  /**
   * Reset all optimizations
   */
  reset(): void {
    this.circuitBreakers.clear();
    this.rateLimiters.clear();
    console.log('🔄 Emergency optimization reset');
  }
}

// Singleton instance
export const emergencyReadOptimizer = new EmergencyReadOptimizer();

// Auto-run optimization every 2 minutes
if (typeof window === 'undefined') { // Server-side only
  setInterval(() => {
    emergencyReadOptimizer.optimize().catch(console.error);
  }, 2 * 60 * 1000);
}

// Export utilities
export const optimizeReads = () => emergencyReadOptimizer.optimize();
export const isCircuitBroken = (endpoint: string) => emergencyReadOptimizer.isCircuitBroken(endpoint);
export const shouldRateLimit = (endpoint: string, userId?: string) => emergencyReadOptimizer.shouldRateLimit(endpoint, userId);
export const getOptimizationStatus = () => emergencyReadOptimizer.getStatus();
export const resetOptimization = () => emergencyReadOptimizer.reset();
