/**
 * Rate Limiter Utility
 *
 * Implements rate limiting for API endpoints to prevent abuse and
 * stay within external service limits (Stripe API, etc.)
 *
 * Supports both in-memory (single-instance) and Redis (distributed) storage.
 * Redis adapter uses Upstash for serverless-compatible distributed rate limiting.
 *
 * @see https://upstash.com/docs/redis/overall/getstarted
 */

// Storage adapter interface for different backends
export interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | null>;
  set(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void>;
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
  delete(key: string): Promise<void>;
  cleanup?(): Promise<void>;
}

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  keyGenerator?: (identifier: string) => string;  // Custom key generator
  skipSuccessfulRequests?: boolean;  // Don't count successful requests
  skipFailedRequests?: boolean;  // Don't count failed requests
  store?: RateLimitStore;  // Optional external store (Redis)
  prefix?: string;  // Key prefix for namespacing
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

// In-memory store implementation (default)
class MemoryStore implements RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();

  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(key);
    if (!entry || entry.resetTime <= Date.now()) {
      return null;
    }
    return entry;
  }

  async set(key: string, entry: RateLimitEntry, _ttlMs: number): Promise<void> {
    this.store.set(key, entry);
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
        firstRequest: now,
      };
    } else {
      entry.count++;
    }

    this.store.set(key, entry);
    return { count: entry.count, resetTime: entry.resetTime };
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }
}

// Upstash Redis store implementation
export class RedisStore implements RateLimitStore {
  private redis: any; // Redis client
  private prefix: string;
  private initPromise: Promise<void> | null = null;
  private initialized = false;

  constructor(options: {
    url?: string;
    token?: string;
    prefix?: string;
  } = {}) {
    this.prefix = options.prefix || 'ratelimit:';

    // Lazy-load the Redis client
    this.initPromise = this.initRedis(options);
  }

  private async initRedis(options: { url?: string; token?: string }) {
    if (this.initialized) return;

    try {
      // Use environment variables if not provided
      const url = options.url || process.env.UPSTASH_REDIS_REST_URL;
      const token = options.token || process.env.UPSTASH_REDIS_REST_TOKEN;

      if (!url || !token) {
        // Silently skip - will fall back to memory store
        this.initialized = true;
        return;
      }

      // Dynamic import to avoid bundling issues when package isn't installed
      try {
        const upstashModule = await import('@upstash/redis').catch(() => null);
        if (upstashModule && upstashModule.Redis) {
          this.redis = new upstashModule.Redis({ url, token });
        }
      } catch {
        // Package not installed - silently fall back to memory store
      }

      this.initialized = true;
    } catch (error) {
      console.error('[RedisStore] Failed to initialize Redis:', error);
      this.initialized = true;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    await this.ensureInitialized();
    if (!this.redis) return null;

    try {
      const data = await this.redis.get(this.getKey(key));
      if (!data) return null;

      const entry = typeof data === 'string' ? JSON.parse(data) : data;
      if (entry.resetTime <= Date.now()) {
        return null;
      }
      return entry;
    } catch (error) {
      console.error('[RedisStore] Get error:', error);
      return null;
    }
  }

  async set(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void> {
    await this.ensureInitialized();
    if (!this.redis) return;

    try {
      const fullKey = this.getKey(key);
      await this.redis.set(fullKey, JSON.stringify(entry), {
        px: ttlMs, // TTL in milliseconds
      });
    } catch (error) {
      console.error('[RedisStore] Set error:', error);
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    await this.ensureInitialized();
    if (!this.redis) {
      // Fallback - treat as first request
      const now = Date.now();
      return { count: 1, resetTime: now + windowMs };
    }

    try {
      const fullKey = this.getKey(key);
      const now = Date.now();

      // Use Lua script for atomic increment with window handling
      const result = await this.redis.eval(
        `
        local key = KEYS[1]
        local windowMs = tonumber(ARGV[1])
        local now = tonumber(ARGV[2])

        local data = redis.call('GET', key)
        local entry

        if data then
          entry = cjson.decode(data)
          if entry.resetTime <= now then
            -- Window expired, start new window
            entry = {count = 1, resetTime = now + windowMs, firstRequest = now}
          else
            entry.count = entry.count + 1
          end
        else
          -- No entry, create new
          entry = {count = 1, resetTime = now + windowMs, firstRequest = now}
        end

        local ttl = entry.resetTime - now
        if ttl > 0 then
          redis.call('SET', key, cjson.encode(entry), 'PX', ttl)
        end

        return cjson.encode({count = entry.count, resetTime = entry.resetTime})
        `,
        [fullKey],
        [windowMs.toString(), now.toString()]
      );

      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      return { count: parsed.count, resetTime: parsed.resetTime };
    } catch (error) {
      console.error('[RedisStore] Increment error:', error);
      // Fallback on error
      const now = Date.now();
      return { count: 1, resetTime: now + windowMs };
    }
  }

  async delete(key: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.redis) return;

    try {
      await this.redis.del(this.getKey(key));
    } catch (error) {
      console.error('[RedisStore] Delete error:', error);
    }
  }
}

// Singleton Redis store for sharing across limiters
let sharedRedisStore: RedisStore | null = null;

export function getRedisStore(): RedisStore {
  if (!sharedRedisStore) {
    sharedRedisStore = new RedisStore();
  }
  return sharedRedisStore;
}

// Check if Redis is configured
export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

export class RateLimiter {
  private memoryStore: Map<string, RateLimitEntry> = new Map();
  private externalStore: RateLimitStore | null = null;
  private config: RateLimitConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyGenerator: (id) => id,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      prefix: '',
      ...config
    };

    // Use external store if provided
    this.externalStore = config.store || null;

    // Clean up expired entries every 5 minutes (only for memory store)
    if (!this.externalStore && typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  private getFullKey(identifier: string): string {
    const baseKey = this.config.keyGenerator!(identifier);
    return this.config.prefix ? `${this.config.prefix}:${baseKey}` : baseKey;
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
    const key = this.getFullKey(identifier);

    // Use external store if available
    if (this.externalStore) {
      const result = await this.externalStore.increment(key, this.config.windowMs);
      const allowed = result.count <= this.config.maxRequests;

      return {
        allowed,
        remaining: Math.max(0, this.config.maxRequests - result.count),
        resetTime: result.resetTime,
        totalRequests: result.count,
      };
    }

    // Fall back to memory store
    const now = Date.now();
    let entry = this.memoryStore.get(key);

    // Create new entry if doesn't exist or window has expired
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        firstRequest: now
      };
      this.memoryStore.set(key, entry);
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
    // Note: Decrement only works with memory store
    // Redis implementation would need a separate decrement operation
    if (this.externalStore) {
      // For Redis, we could implement decrement but it's rarely needed
      return;
    }

    const key = this.getFullKey(identifier);
    const entry = this.memoryStore.get(key);

    if (entry && entry.count > 0) {
      entry.count--;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    if (this.externalStore) {
      // External stores handle their own cleanup via TTL
      return;
    }

    const now = Date.now();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.resetTime <= now) {
        this.memoryStore.delete(key);
      }
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
    const key = this.getFullKey(identifier);

    if (this.externalStore) {
      const entry = await this.externalStore.get(key);
      if (!entry) return null;

      return {
        remaining: Math.max(0, this.config.maxRequests - entry.count),
        resetTime: entry.resetTime,
        totalRequests: entry.count,
      };
    }

    const entry = this.memoryStore.get(key);

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
    const key = this.getFullKey(identifier);

    if (this.externalStore) {
      await this.externalStore.delete(key);
      return;
    }

    this.memoryStore.delete(key);
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

// Anti-spam rate limiters with tiered limits based on account trust

/**
 * Page creation rate limiter for new accounts (< 7 days old)
 * More restrictive to prevent spam from new accounts
 */
export const newAccountPageRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 pages per hour for new accounts
  keyGenerator: (userId) => `page:new:${userId}`,
  prefix: 'spam',
});

/**
 * Page creation rate limiter for regular accounts (7-90 days old)
 */
export const regularPageRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20, // 20 pages per hour for regular accounts
  keyGenerator: (userId) => `page:regular:${userId}`,
  prefix: 'spam',
});

/**
 * Page creation rate limiter for trusted accounts (> 90 days, email verified)
 */
export const trustedPageRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 100, // 100 pages per hour for trusted accounts
  keyGenerator: (userId) => `page:trusted:${userId}`,
  prefix: 'spam',
});

/**
 * Reply creation rate limiter
 */
export const replyRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 30, // 30 replies per hour
  keyGenerator: (userId) => `reply:${userId}`,
  prefix: 'spam',
});

/**
 * Account creation rate limiter - per IP
 * Prevents mass account creation from single IP
 */
export const accountCreationRateLimiter = new RateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  maxRequests: 3, // 3 accounts per IP per day
  keyGenerator: (ip) => `account:${ip}`,
  prefix: 'spam',
});

/**
 * Get the appropriate page rate limiter based on account age and trust
 */
export function getPageRateLimiter(accountAgeInDays: number, isTrusted: boolean): RateLimiter {
  if (isTrusted || accountAgeInDays > 90) {
    return trustedPageRateLimiter;
  }
  if (accountAgeInDays >= 7) {
    return regularPageRateLimiter;
  }
  return newAccountPageRateLimiter;
}

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
  const status = await stripeApiRateLimiter.getStatus('stripe:api');

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
