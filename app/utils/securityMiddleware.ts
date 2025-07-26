/**
 * Security Middleware for API Routes
 * 
 * This middleware provides comprehensive security protection for all API routes
 * including rate limiting, input validation, and security headers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateInput, ValidationSchema, createValidationErrorResponse } from './inputValidation';
import { secureLogger, logSecurityEvent } from './secureLogging';
import { getUserIdFromRequest } from '../api/auth-helper';

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// In-memory rate limit store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Default rate limits for different route types
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 requests per 15 minutes
  admin: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  api: { windowMs: 60 * 1000, maxRequests: 1000 }, // 1000 requests per minute
  search: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 searches per minute
  upload: { windowMs: 60 * 1000, maxRequests: 10 } // 10 uploads per minute
};

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest, userId?: string): string {
  // Use user ID if available, otherwise fall back to IP
  if (userId) {
    return `user:${userId}`;
  }
  
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return `ip:${forwarded.split(',')[0].trim()}`;
  }
  if (realIP) {
    return `ip:${realIP}`;
  }
  if (cfConnectingIP) {
    return `ip:${cfConnectingIP}`;
  }
  
  return 'ip:unknown';
}

/**
 * Check rate limit for a client
 */
function checkRateLimit(clientId: string, config: RateLimitConfig): { allowed: boolean; resetTime: number; remaining: number } {
  const now = Date.now();
  const key = `${clientId}:${Math.floor(now / config.windowMs)}`;
  
  const current = rateLimitStore.get(key) || { count: 0, resetTime: now + config.windowMs };
  
  if (now > current.resetTime) {
    // Reset the counter
    current.count = 0;
    current.resetTime = now + config.windowMs;
  }
  
  const allowed = current.count < config.maxRequests;
  
  if (allowed) {
    current.count++;
    rateLimitStore.set(key, current);
  }
  
  return {
    allowed,
    resetTime: current.resetTime,
    remaining: Math.max(0, config.maxRequests - current.count)
  };
}

/**
 * Clean up expired rate limit entries
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

/**
 * Security headers to add to all responses
 */
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-src 'none';"
};

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }
  return response;
}

/**
 * Detect suspicious request patterns
 */
function detectSuspiciousActivity(request: NextRequest): string[] {
  const suspiciousPatterns: string[] = [];
  const url = request.url.toLowerCase();
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  
  // Check for common attack patterns in URL
  const urlAttackPatterns = [
    'script',
    'javascript:',
    'data:',
    '../',
    '..\\',
    'union select',
    'drop table',
    'exec(',
    'eval(',
    '<script',
    'onload=',
    'onerror='
  ];
  
  for (const pattern of urlAttackPatterns) {
    if (url.includes(pattern)) {
      suspiciousPatterns.push(`Suspicious URL pattern: ${pattern}`);
    }
  }
  
  // Check for bot/scanner user agents
  const suspiciousUserAgents = [
    'sqlmap',
    'nikto',
    'nessus',
    'openvas',
    'nmap',
    'masscan',
    'zap',
    'burp',
    'w3af'
  ];
  
  for (const botAgent of suspiciousUserAgents) {
    if (userAgent.includes(botAgent)) {
      suspiciousPatterns.push(`Suspicious user agent: ${botAgent}`);
    }
  }
  
  // Check for missing or suspicious headers
  if (!request.headers.get('user-agent')) {
    suspiciousPatterns.push('Missing user agent');
  }
  
  return suspiciousPatterns;
}

/**
 * Main security middleware function
 */
export async function securityMiddleware(
  request: NextRequest,
  options: {
    rateLimitType?: keyof typeof DEFAULT_RATE_LIMITS;
    customRateLimit?: RateLimitConfig;
    requireAuth?: boolean;
    requireAdmin?: boolean;
    validateInput?: ValidationSchema;
    skipSuspiciousCheck?: boolean;
  } = {}
): Promise<{ allowed: boolean; response?: NextResponse; userId?: string }> {
  
  const startTime = Date.now();
  const path = new URL(request.url).pathname;
  const method = request.method;
  
  try {
    // Get user ID if available
    const userId = await getUserIdFromRequest(request);
    
    // Check for suspicious activity
    if (!options.skipSuspiciousCheck) {
      const suspiciousPatterns = detectSuspiciousActivity(request);
      if (suspiciousPatterns.length > 0) {
        logSecurityEvent('Suspicious request detected', userId, undefined, {
          patterns: suspiciousPatterns,
          path,
          method,
          userAgent: request.headers.get('user-agent')
        });
        
        // Block obviously malicious requests
        if (suspiciousPatterns.some(p => p.includes('script') || p.includes('sql'))) {
          const response = NextResponse.json(
            { error: 'Request blocked for security reasons' },
            { status: 403 }
          );
          return { allowed: false, response: addSecurityHeaders(response) };
        }
      }
    }
    
    // Check authentication if required
    if (options.requireAuth && !userId) {
      const response = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
      return { allowed: false, response: addSecurityHeaders(response) };
    }
    
    // Check admin access if required
    if (options.requireAdmin) {
      const { isUserAdmin } = await import('./adminSecurity');
      if (!userId || !(await isUserAdmin(userId))) {
        logSecurityEvent('Unauthorized admin access attempt', userId, undefined, { path, method });
        const response = NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
        return { allowed: false, response: addSecurityHeaders(response) };
      }
    }
    
    // Apply rate limiting
    const rateLimitConfig = options.customRateLimit || 
      (options.rateLimitType ? DEFAULT_RATE_LIMITS[options.rateLimitType] : DEFAULT_RATE_LIMITS.api);
    
    const clientId = getClientIdentifier(request, userId);
    const rateLimitResult = checkRateLimit(clientId, rateLimitConfig);
    
    if (!rateLimitResult.allowed) {
      logSecurityEvent('Rate limit exceeded', userId, undefined, {
        clientId,
        path,
        method,
        resetTime: new Date(rateLimitResult.resetTime).toISOString()
      });
      
      const response = NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          resetTime: rateLimitResult.resetTime
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      );
      return { allowed: false, response: addSecurityHeaders(response) };
    }
    
    // Validate input if schema provided
    if (options.validateInput) {
      let validationResult;
      
      if (method === 'GET') {
        const { validateQueryParams } = await import('./inputValidation');
        validationResult = validateQueryParams(request, options.validateInput);
      } else {
        const { validateRequestBody } = await import('./inputValidation');
        validationResult = await validateRequestBody(request, options.validateInput);
      }
      
      if (!validationResult.isValid) {
        logSecurityEvent('Input validation failed', userId, undefined, {
          path,
          method,
          errors: validationResult.errors
        });
        
        return { 
          allowed: false, 
          response: addSecurityHeaders(createValidationErrorResponse(validationResult.errors))
        };
      }
    }
    
    // Log successful security check
    const duration = Date.now() - startTime;
    secureLogger.debug('Security middleware passed', {
      path,
      method,
      userId: userId || 'anonymous',
      duration: `${duration}ms`,
      rateLimitRemaining: rateLimitResult.remaining
    });
    
    return { allowed: true, userId };
    
  } catch (error) {
    secureLogger.error('Security middleware error', { path, method, error });
    
    // Fail securely - deny access on any error
    const response = NextResponse.json(
      { error: 'Security check failed' },
      { status: 500 }
    );
    return { allowed: false, response: addSecurityHeaders(response) };
  }
}

/**
 * Wrapper function to easily apply security middleware to API routes
 */
export function withSecurity(
  handler: (request: NextRequest, context: { userId?: string }) => Promise<NextResponse>,
  options: Parameters<typeof securityMiddleware>[1] = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const securityResult = await securityMiddleware(request, options);
    
    if (!securityResult.allowed) {
      return securityResult.response!;
    }
    
    try {
      const response = await handler(request, { userId: securityResult.userId });
      return addSecurityHeaders(response);
    } catch (error) {
      secureLogger.error('API handler error', { 
        path: new URL(request.url).pathname,
        method: request.method,
        error 
      });
      
      const errorResponse = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
      return addSecurityHeaders(errorResponse);
    }
  };
}
