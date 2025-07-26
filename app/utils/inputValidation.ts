/**
 * Secure Input Validation and Sanitization Module
 * 
 * This module provides comprehensive input validation and sanitization
 * to prevent injection attacks and ensure data integrity.
 */

import { NextRequest } from 'next/server';

// Common validation patterns
const VALIDATION_PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  username: /^[a-zA-Z0-9_-]{3,30}$/,
  pageId: /^[a-zA-Z0-9_-]{1,100}$/,
  userId: /^[a-zA-Z0-9_-]{1,128}$/,
  searchTerm: /^[a-zA-Z0-9\s\-_.,!?'"()]{1,200}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  numeric: /^\d+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
};

// Dangerous patterns that should be rejected
const DANGEROUS_PATTERNS = [
  // SQL injection patterns
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
  // NoSQL injection patterns
  /(\$where|\$ne|\$gt|\$lt|\$regex|\$exists)/i,
  // JavaScript injection patterns
  /(javascript:|data:|vbscript:|onload|onerror|onclick)/i,
  // Path traversal patterns
  /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i,
  // Command injection patterns
  /(\||&|;|`|\$\(|\${)/,
  // XSS patterns
  /(<script|<iframe|<object|<embed|<link|<meta)/i
];

export interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: any;
  errors: string[];
}

export interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'email' | 'username' | 'pageId' | 'userId' | 'searchTerm';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    allowEmpty?: boolean;
  };
}

/**
 * Check if input contains dangerous patterns
 */
function containsDangerousPatterns(input: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Sanitize string input for database safety
 */
function sanitizeString(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Normalize whitespace
  sanitized = sanitized.trim().replace(/\s+/g, ' ');
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

/**
 * Validate and sanitize a single value
 */
function validateValue(value: any, rules: ValidationSchema[string]): ValidationResult {
  const errors: string[] = [];
  
  // Check if required
  if (rules.required && (value === null || value === undefined || value === '')) {
    return { isValid: false, errors: ['Field is required'] };
  }
  
  // Allow empty if not required
  if (!rules.required && (value === null || value === undefined || value === '')) {
    return { isValid: true, sanitizedValue: value, errors: [] };
  }
  
  let sanitizedValue = value;
  
  // Type-specific validation
  switch (rules.type) {
    case 'string':
    case 'email':
    case 'username':
    case 'pageId':
    case 'userId':
    case 'searchTerm':
      if (typeof value !== 'string') {
        errors.push('Must be a string');
        break;
      }
      
      // Check for dangerous patterns
      if (containsDangerousPatterns(value)) {
        errors.push('Contains invalid characters');
        break;
      }
      
      // Sanitize string
      sanitizedValue = sanitizeString(value);
      
      // Length validation
      if (rules.minLength && sanitizedValue.length < rules.minLength) {
        errors.push(`Must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && sanitizedValue.length > rules.maxLength) {
        errors.push(`Must be no more than ${rules.maxLength} characters`);
      }
      
      // Pattern validation
      let pattern = rules.pattern;
      if (!pattern && VALIDATION_PATTERNS[rules.type]) {
        pattern = VALIDATION_PATTERNS[rules.type];
      }
      
      if (pattern && !pattern.test(sanitizedValue)) {
        errors.push(`Invalid format for ${rules.type}`);
      }
      
      break;
      
    case 'number':
      const numValue = Number(value);
      if (isNaN(numValue)) {
        errors.push('Must be a valid number');
        break;
      }
      
      sanitizedValue = numValue;
      
      if (rules.min !== undefined && numValue < rules.min) {
        errors.push(`Must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && numValue > rules.max) {
        errors.push(`Must be no more than ${rules.max}`);
      }
      
      break;
      
    case 'boolean':
      if (typeof value === 'boolean') {
        sanitizedValue = value;
      } else if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'true' || lowerValue === '1') {
          sanitizedValue = true;
        } else if (lowerValue === 'false' || lowerValue === '0') {
          sanitizedValue = false;
        } else {
          errors.push('Must be a valid boolean');
        }
      } else {
        errors.push('Must be a boolean');
      }
      break;
  }
  
  return {
    isValid: errors.length === 0,
    sanitizedValue,
    errors
  };
}

/**
 * Validate and sanitize an object against a schema
 */
export function validateInput(input: any, schema: ValidationSchema): ValidationResult {
  const errors: string[] = [];
  const sanitizedValue: any = {};
  
  // Validate each field in the schema
  for (const [fieldName, rules] of Object.entries(schema)) {
    const fieldValue = input[fieldName];
    const fieldResult = validateValue(fieldValue, rules);
    
    if (!fieldResult.isValid) {
      errors.push(...fieldResult.errors.map(error => `${fieldName}: ${error}`));
    } else {
      sanitizedValue[fieldName] = fieldResult.sanitizedValue;
    }
  }
  
  // Check for unexpected fields (potential injection attempt)
  const allowedFields = Object.keys(schema);
  const inputFields = Object.keys(input || {});
  const unexpectedFields = inputFields.filter(field => !allowedFields.includes(field));
  
  if (unexpectedFields.length > 0) {
    errors.push(`Unexpected fields: ${unexpectedFields.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    sanitizedValue,
    errors
  };
}

/**
 * Validate query parameters from URL
 */
export function validateQueryParams(request: NextRequest, schema: ValidationSchema): ValidationResult {
  const { searchParams } = new URL(request.url);
  const params: any = {};
  
  // Extract all query parameters
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }
  
  return validateInput(params, schema);
}

/**
 * Validate JSON body from request
 */
export async function validateRequestBody(request: NextRequest, schema: ValidationSchema): Promise<ValidationResult> {
  try {
    const body = await request.json();
    return validateInput(body, schema);
  } catch (error) {
    return {
      isValid: false,
      errors: ['Invalid JSON body']
    };
  }
}

/**
 * Sanitize search term for database queries
 */
export function sanitizeSearchTerm(searchTerm: string): string {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return '';
  }
  
  // Check for dangerous patterns
  if (containsDangerousPatterns(searchTerm)) {
    return '';
  }
  
  // Sanitize and limit length
  let sanitized = sanitizeString(searchTerm);
  
  // Limit search term length for performance
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }
  
  return sanitized;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(limit?: string, offset?: string): { limit: number; offset: number; errors: string[] } {
  const errors: string[] = [];
  let validatedLimit = 10; // Default limit
  let validatedOffset = 0; // Default offset
  
  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      errors.push('Limit must be a positive number');
    } else if (limitNum > 100) {
      errors.push('Limit cannot exceed 100');
    } else {
      validatedLimit = limitNum;
    }
  }
  
  if (offset) {
    const offsetNum = parseInt(offset, 10);
    if (isNaN(offsetNum) || offsetNum < 0) {
      errors.push('Offset must be a non-negative number');
    } else {
      validatedOffset = offsetNum;
    }
  }
  
  return { limit: validatedLimit, offset: validatedOffset, errors };
}

/**
 * Create validation error response
 */
export function createValidationErrorResponse(errors: string[]) {
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      details: errors
    }),
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}
