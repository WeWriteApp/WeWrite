/**
 * Rate Limiter Utility
 * 
 * Implements rate limiting for API endpoints to prevent abuse and
 * stay within external service limits (Stripe API, etc.)
 */

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  keyGenerator?: (identifier: string) => string;  // Custom key generator
  skipSuccessfulRequests?: boolean;  // Don't count successful requests
  skipFailedRequests?: boolean;  // Don't count failed requests
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyGenerator: (id) => id,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    };

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if request is allowed and update counter
   */
  async checkLimit(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalRequests: number;
  }> {
    const key = this.config.keyGenerator!(identifier);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = this.store.get(key);

    // Create new entry if doesn't exist or window has expired
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        firstRequest: now
      };
      this.store.set(key, entry);
    }

    // Check if limit exceeded
    const allowed = entry.count < this.config.maxRequests;
    
    if (allowed) {
      entry.count++;
    }

    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      totalRequests: entry.count
    };
  }

  /**
   * Record a request result (for conditional counting)
   */
  recordResult(identifier: string, success: boolean): void {
    if (this.config.skipSuccessfulRequests && success) {
      this.decrementCount(identifier);
    } else if (this.config.skipFailedRequests && !success) {
      this.decrementCount(identifier);
    }
  }

  /**
   * Decrement count for an identifier
   */
  private decrementCount(identifier: string): void {
    const key = this.config.keyGenerator!(identifier);
    const entry = this.store.get(key);
    
    if (entry && entry.count > 0) {
      entry.count--;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get current status for an identifier
   */
  getStatus(identifier: string): {
    remaining: number;
    resetTime: number;
    totalRequests: number;
  } | null {
    const key = this.config.keyGenerator!(identifier);
    const entry = this.store.get(key);
    
    if (!entry || entry.resetTime <= Date.now()) {
      return null;
    }

    return {
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      totalRequests: entry.count
    };
  }

  /**
   * Reset limits for an identifier (admin override)
   */
  reset(identifier: string): void {
    const key = this.config.keyGenerator!(identifier);
    this.store.delete(key);
  }
}

// Pre-configured rate limiters for different use cases

/**
 * Auth rate limiter - prevents brute force attacks on login/register
 * - 10 login attempts per IP per 15 minutes
 * - After limit reached, must wait for window to reset
 */
export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 attempts per window
  keyGenerator: (ip) => `auth:${ip}`,
  skipSuccessfulRequests: true // Don't count successful logins
});

/**
 * Password reset rate limiter - prevents abuse of password reset feature
 * - 5 password reset requests per email per hour
 */
export const passwordResetRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 reset requests per hour per email
  keyGenerator: (email) => `password-reset:${email.toLowerCase()}`
});

export const payoutRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 payout requests per hour per user
  keyGenerator: (userId) => `payout:${userId}`
});

export const adminRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute for admin
  keyGenerator: (userId) => `admin:${userId}`
});

export const webhookRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000, // 1000 webhook events per minute
  keyGenerator: (source) => `webhook:${source}`,
  skipSuccessfulRequests: true // Only count failed webhooks
});

export const stripeApiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // Stay well under Stripe's 100/second limit
  keyGenerator: () => 'stripe:api', // Global limit for all Stripe API calls
  skipFailedRequests: true // Don't count failed requests against limit
});

/**
 * Rate limiting middleware for Next.js API routes
 */
export function createRateLimitMiddleware(limiter: RateLimiter, getIdentifier: (req: any) => string) {
  return async function rateLimitMiddleware(req: any, res: any, next?: () => void) {
    try {
      const identifier = getIdentifier(req);
      const result = await limiter.checkLimit(identifier);

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter['config'].maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again after ${new Date(result.resetTime).toISOString()}`,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }

      // Continue to next middleware or handler
      if (next) {
        next();
      }
      
      return result;
    } catch (error) {
      console.error('Rate limiting error:', error);
      // On error, allow the request to proceed
      if (next) {
        next();
      }
      return { allowed: true, remaining: 0, resetTime: 0, totalRequests: 0 };
    }
  };
}

/**
 * Utility to check if we're approaching Stripe API limits
 */
export async function checkStripeApiLimit(): Promise<{
  safe: boolean;
  remaining: number;
  resetTime: number;
}> {
  const status = stripeApiRateLimiter.getStatus('stripe:api');
  
  if (!status) {
    return { safe: true, remaining: 100, resetTime: Date.now() + 60000 };
  }

  // Consider it unsafe if we have less than 10 requests remaining
  const safe = status.remaining > 10;
  
  return {
    safe,
    remaining: status.remaining,
    resetTime: status.resetTime
  };
}

/**
 * Delay function for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with jitter for API retries
 */
export function calculateBackoffDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Rate-limited function wrapper
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limiter: RateLimiter,
  getIdentifier: (...args: Parameters<T>) => string
): T {
  return (async (...args: Parameters<T>) => {
    const identifier = getIdentifier(...args);
    const result = await limiter.checkLimit(identifier);
    
    if (!result.allowed) {
      const waitTime = result.resetTime - Date.now();
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    try {
      const response = await fn(...args);
      limiter.recordResult(identifier, true);
      return response;
    } catch (error) {
      limiter.recordResult(identifier, false);
      throw error;
    }
  }) as T;
}
