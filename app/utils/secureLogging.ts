/**
 * Secure Logging Module
 * 
 * This module provides secure logging that automatically sanitizes
 * sensitive data to prevent exposure of emails, tokens, and other
 * confidential information in logs.
 */

// Sensitive data patterns that should be redacted
const SENSITIVE_PATTERNS = [
  // Email addresses
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL_REDACTED]'
  },
  // API keys and tokens
  {
    pattern: /\b(sk_live_|sk_test_|pk_live_|pk_test_)[A-Za-z0-9]{20,}/g,
    replacement: '[API_KEY_REDACTED]'
  },
  // Firebase API keys
  {
    pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g,
    replacement: '[FIREBASE_KEY_REDACTED]'
  },
  // JWT tokens
  {
    pattern: /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    replacement: '[JWT_TOKEN_REDACTED]'
  },
  // Credit card numbers
  {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CARD_NUMBER_REDACTED]'
  },
  // Social Security Numbers
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN_REDACTED]'
  },
  // Phone numbers
  {
    pattern: /\b\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    replacement: '[PHONE_REDACTED]'
  },
  // Passwords (common field names)
  {
    pattern: /"password"\s*:\s*"[^"]*"/gi,
    replacement: '"password": "[PASSWORD_REDACTED]"'
  },
  // Auth tokens in headers
  {
    pattern: /authorization:\s*bearer\s+[A-Za-z0-9._-]+/gi,
    replacement: 'authorization: bearer [TOKEN_REDACTED]'
  }
];

// Sensitive field names that should have their values redacted
const SENSITIVE_FIELD_NAMES = [
  'password',
  'token',
  'secret',
  'key',
  'apiKey',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'authToken',
  'privateKey',
  'clientSecret',
  'webhookSecret',
  'stripeKey',
  'firebaseKey',
  'databaseUrl',
  'connectionString',
  'email', // Redact email values in structured data
  'emailAddress',
  'userEmail',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
  'socialSecurityNumber',
  'bankAccount',
  'routingNumber'
];

/**
 * Sanitize a string by removing sensitive data
 */
function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }
  
  let sanitized = input;
  
  // Apply all sensitive patterns
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  
  return sanitized;
}

/**
 * Sanitize an object by redacting sensitive fields
 */
function sanitizeObject(obj: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_REACHED]';
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Check if this is a sensitive field
      const isSensitiveField = SENSITIVE_FIELD_NAMES.some(sensitiveField => 
        lowerKey.includes(sensitiveField.toLowerCase())
      );
      
      if (isSensitiveField) {
        sanitized[key] = '[SENSITIVE_DATA_REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1);
      }
    }
    
    return sanitized;
  }
  
  return obj;
}

/**
 * Mask email address for logging (show first 2 chars and domain)
 */
function maskEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '[INVALID_EMAIL]';
  }
  
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  
  return `${localPart.substring(0, 2)}***@${domain}`;
}

/**
 * Mask user ID for logging (show first 8 chars)
 */
function maskUserId(userId: string): string {
  if (!userId || typeof userId !== 'string') {
    return '[INVALID_USER_ID]';
  }
  
  if (userId.length <= 8) {
    return userId.substring(0, 4) + '***';
  }
  
  return userId.substring(0, 8) + '...';
}

/**
 * Secure console logging with automatic sanitization
 */
export class SecureLogger {
  private isDevelopment: boolean;
  
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }
  
  /**
   * Log with automatic sanitization
   */
  private secureLog(level: 'log' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const sanitizedMessage = sanitizeString(message);
    const sanitizedData = data ? sanitizeObject(data) : undefined;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [SECURE]`;
    
    switch (level) {
      case 'log':
        console.log(`${prefix} ${sanitizedMessage}`, sanitizedData || '');
        break;
      case 'info':
        console.info(`${prefix} ℹ️ ${sanitizedMessage}`, sanitizedData || '');
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️ ${sanitizedMessage}`, sanitizedData || '');
        break;
      case 'error':
        console.error(`${prefix} ❌ ${sanitizedMessage}`, sanitizedData || '');
        break;
    }
  }
  
  /**
   * Secure info logging
   */
  info(message: string, data?: any): void {
    this.secureLog('info', message, data);
  }
  
  /**
   * Secure warning logging
   */
  warn(message: string, data?: any): void {
    this.secureLog('warn', message, data);
  }
  
  /**
   * Secure error logging
   */
  error(message: string, data?: any): void {
    this.secureLog('error', message, data);
  }
  
  /**
   * Secure debug logging (only in development)
   */
  debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      this.secureLog('log', `[DEBUG] ${message}`, data);
    }
  }
  
  /**
   * Log user action with masked sensitive data
   */
  logUserAction(action: string, userId?: string, userEmail?: string, additionalData?: any): void {
    const logData = {
      action,
      userId: userId ? maskUserId(userId) : null,
      userEmail: userEmail ? maskEmail(userEmail) : null,
      timestamp: new Date().toISOString(),
      ...sanitizeObject(additionalData || {})
    };
    
    this.info(`User action: ${action}`, logData);
  }
  
  /**
   * Log API request with sanitized data
   */
  logApiRequest(method: string, path: string, userId?: string, statusCode?: number, duration?: number): void {
    const logData = {
      method,
      path,
      userId: userId ? maskUserId(userId) : null,
      statusCode,
      duration: duration ? `${duration}ms` : null,
      timestamp: new Date().toISOString()
    };
    
    this.info(`API ${method} ${path}`, logData);
  }
  
  /**
   * Log security event with full audit trail
   */
  logSecurityEvent(event: string, userId?: string, userEmail?: string, details?: any): void {
    const logData = {
      securityEvent: event,
      userId: userId ? maskUserId(userId) : null,
      userEmail: userEmail ? maskEmail(userEmail) : null,
      timestamp: new Date().toISOString(),
      details: sanitizeObject(details || {})
    };
    
    this.warn(`SECURITY EVENT: ${event}`, logData);
  }
}

// Export singleton instance
export const secureLogger = new SecureLogger();

// Export utility functions
export { maskEmail, maskUserId, sanitizeString, sanitizeObject };

// Convenience functions for common logging patterns
export const logUserAction = (action: string, userId?: string, userEmail?: string, data?: any) => {
  secureLogger.logUserAction(action, userId, userEmail, data);
};

export const logApiRequest = (method: string, path: string, userId?: string, statusCode?: number, duration?: number) => {
  secureLogger.logApiRequest(method, path, userId, statusCode, duration);
};

export const logSecurityEvent = (event: string, userId?: string, userEmail?: string, details?: any) => {
  secureLogger.logSecurityEvent(event, userId, userEmail, details);
};
