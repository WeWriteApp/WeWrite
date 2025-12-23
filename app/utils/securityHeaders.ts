/**
 * Security Headers Configuration for PWA Payment Processing
 * 
 * This module defines security headers and Content Security Policy
 * configurations to ensure PCI DSS compliance and secure payment processing.
 */

/**
 * Content Security Policy for payment processing
 * Allows Stripe.js and other necessary payment-related resources
 */
export const getContentSecurityPolicy = (isDevelopment: boolean = false) => {
  const basePolicy = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Required for Next.js
      "'unsafe-eval'", // Required for development
      'https://js.stripe.com',
      'https://maps.googleapis.com',
      'https://www.google-analytics.com',
      'https://www.googletagmanager.com'
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for styled-components and CSS-in-JS
      'https://fonts.googleapis.com'
    ],
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
      'data:'
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https:',
      'https://www.google-analytics.com',
      'https://www.googletagmanager.com'
    ],
    'connect-src': [
      "'self'",
      'https://api.stripe.com',
      'https://maps.googleapis.com',
      'https://www.google-analytics.com',
      'https://www.googletagmanager.com',
          ],
    'frame-src': [
      "'self'",
      'https://js.stripe.com',
      'https://hooks.stripe.com'
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': [
      "'self'",
      'https://api.stripe.com'
    ],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': []
  };

  // Add development-specific policies
  if (isDevelopment) {
    basePolicy['connect-src'].push('ws://localhost:*', 'http://localhost:*');
    basePolicy['script-src'].push('http://localhost:*');
  }

  // Convert to CSP string
  return Object.entries(basePolicy)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(' ')}`;
    })
    .join('; ');
};

/**
 * Security headers for payment processing
 */
export const getSecurityHeaders = (isDevelopment: boolean = false) => {
  return {
    // Content Security Policy
    'Content-Security-Policy': getContentSecurityPolicy(isDevelopment),
    
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block',
    
    // Referrer policy for privacy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions policy
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=(self)',
      'payment=(self "https://js.stripe.com")',
      'usb=()',
      'bluetooth=()'
    ].join(', '),
    
    // Strict Transport Security (HTTPS only)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    
    // Prevent caching of sensitive pages
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
};

/**
 * Payment-specific security headers
 */
export const getPaymentSecurityHeaders = () => {
  return {
    // Additional headers for payment pages
    'X-Payment-Security': 'stripe-elements',
    'X-PCI-Compliance': 'stripe-certified',
    
    // Prevent caching of payment forms
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    
    // Additional frame protection for payment forms
    'X-Frame-Options': 'DENY',
    
    // Ensure HTTPS for payment processing
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  };
};

/**
 * Validate security requirements for payment processing
 */
export const validatePaymentSecurity = (request: Request): { 
  isSecure: boolean; 
  errors: string[] 
} => {
  const errors: string[] = [];
  const url = new URL(request.url);

  // Check HTTPS
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    errors.push('HTTPS required for payment processing');
  }

  // Check for secure headers
  const userAgent = request.headers.get('user-agent') || '';
  if (userAgent.includes('curl') || userAgent.includes('wget')) {
    errors.push('Automated requests not allowed for payment processing');
  }

  // Check origin for CSRF protection
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  if (request.method === 'POST' && !origin && !referer) {
    errors.push('Origin or Referer header required for POST requests');
  }

  return {
    isSecure: errors.length === 0,
    errors
  };
};

/**
 * Generate nonce for inline scripts (CSP)
 */
export const generateNonce = (): string => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback for environments without crypto
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

/**
 * Sanitize payment-related data
 */
export const sanitizePaymentData = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = { ...data };
  
  // Remove sensitive fields that should never be logged or stored
  const sensitiveFields = [
    'card_number',
    'card_cvc',
    'card_exp_month',
    'card_exp_year',
    'ssn',
    'bank_account',
    'routing_number',
    'account_number'
  ];

  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      delete sanitized[field];
    }
  });

  // Recursively sanitize nested objects
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizePaymentData(sanitized[key]);
    }
  });

  return sanitized;
};

/**
 * Rate limiting configuration for payment endpoints
 */
export const getPaymentRateLimits = () => {
  return {
    // Setup intents: 10 per minute per IP
    setupIntent: {
      windowMs: 60 * 1000, // 1 minute
      max: 10,
      message: 'Too many payment setup attempts'
    },
    
    // Subscription creation: 5 per minute per user
    subscription: {
      windowMs: 60 * 1000, // 1 minute
      max: 5,
      message: 'Too many subscription attempts'
    },
    
    // Token allocation: 30 per minute per user
    tokenAllocation: {
      windowMs: 60 * 1000, // 1 minute
      max: 30,
      message: 'Too many token allocation requests'
    }
  };
};
