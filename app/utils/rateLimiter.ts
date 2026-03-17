/**
 * Rate Limiter Utility
 *
 * Implements rate limiting for API endpoints to prevent abuse and
 * stay within external service limits (Stripe API, etc.)
 *
 * Uses in-memory storage for single-instance rate limiting.
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
  private config: Required<Pick<RateLimitConfig, 'windowMs' | 'maxRequests' | 'keyGenerator' | 'skipSuccessfulRequests' | 'skipFailedRequests'>>;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyGenerator: (id) => id,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    };

    // Clean up expired entries every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
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
    const key = this.config.keyGenerator(identifier);
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        firstRequest: now
      };
      this.store.set(key, entry);
    }

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

  private decrementCount(identifier: string): void {
    const key = this.config.keyGenerator(identifier);
    const entry = this.store.get(key);

    if (entry && entry.count > 0) {
      entry.count--;
    }
  }

  /**
   * Get current status for an identifier
   */
  async getStatus(identifier: string): Promise<{
    remaining: number;
    resetTime: number;
    totalRequests: number;
  } | null> {
    const key = this.config.keyGenerator(identifier);
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
  async reset(identifier: string): Promise<void> {
    const key = this.config.keyGenerator(identifier);
    this.store.delete(key);
  }

  /**
   * Destroy the rate limiter (cleanup intervals)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }
}

// Pre-configured rate limiters for different use cases

/**
 * Auth rate limiter - prevents brute force attacks on login/register
 * 10 login attempts per IP per 15 minutes
 */
export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyGenerator: (ip) => `auth:${ip}`,
  skipSuccessfulRequests: true
});

/**
 * Password reset rate limiter - prevents abuse of password reset feature
 * 5 password reset requests per email per hour
 */
export const passwordResetRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyGenerator: (email) => `password-reset:${email.toLowerCase()}`
});

/**
 * Payout rate limiter - 5 payout requests per hour per user
 */
export const payoutRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyGenerator: (userId) => `payout:${userId}`
});

/**
 * Admin rate limiter - 100 requests per minute for admin operations
 */
export const adminRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyGenerator: (userId) => `admin:${userId}`
});

/**
 * Webhook rate limiter - 1000 webhook events per minute
 */
export const webhookRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 1000,
  keyGenerator: (source) => `webhook:${source}`,
  skipSuccessfulRequests: true
});
