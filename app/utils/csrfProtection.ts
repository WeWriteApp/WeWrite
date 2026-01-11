/**
 * CSRF Protection Utilities
 *
 * Implements Double-Submit Cookie pattern for CSRF protection:
 * 1. Server sets a signed CSRF token in an httpOnly cookie
 * 2. Client must include the same token in a custom header (X-CSRF-Token)
 * 3. Server verifies both match and are valid
 *
 * This works with SameSite=Lax cookies to provide defense-in-depth:
 * - SameSite=Lax prevents CSRF on cross-site POST/PUT/DELETE
 * - CSRF tokens protect against same-site attacks and provide additional security
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// Configuration
// =============================================================================

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_MAX_AGE = 60 * 60 * 4; // 4 hours

/**
 * Get the CSRF signing secret
 * Uses the same secret as cookie signing for consistency
 */
function getCsrfSecret(): string {
  const secret = process.env.COOKIE_SIGNING_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'development') {
      return 'dev-csrf-secret-not-for-production';
    }
    // Use derived secret in production if main secret not set
    const fallback = process.env.STRIPE_WEBHOOK_SECRET || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
    if (fallback) {
      return `csrf-derived-${fallback.slice(0, 32)}`;
    }
    throw new Error('COOKIE_SIGNING_SECRET must be set for CSRF protection');
  }

  return secret;
}

// =============================================================================
// Token Generation and Verification
// =============================================================================

/**
 * Generate a cryptographically secure random token
 */
function generateRandomToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create HMAC signature for a token
 */
async function signToken(token: string): Promise<string> {
  const secret = getCsrfSecret();
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(token)
  );

  const hashArray = Array.from(new Uint8Array(signature));
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Verify a token's signature
 */
async function verifyTokenSignature(token: string, signature: string): Promise<boolean> {
  try {
    const expectedSignature = await signToken(token);

    // Constant-time comparison
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }

    return result === 0;
  } catch {
    return false;
  }
}

/**
 * Create a signed CSRF token
 * Format: token.signature
 */
async function createSignedCsrfToken(): Promise<string> {
  const token = generateRandomToken();
  const signature = await signToken(token);
  return `${token}.${signature}`;
}

/**
 * Parse and verify a signed CSRF token
 */
async function parseSignedCsrfToken(signedToken: string): Promise<string | null> {
  const [token, signature] = signedToken.split('.');

  if (!token || !signature) {
    return null;
  }

  const isValid = await verifyTokenSignature(token, signature);
  if (!isValid) {
    return null;
  }

  return token;
}

// =============================================================================
// Cookie Management
// =============================================================================

/**
 * Set CSRF token cookie
 * Called when a user authenticates or when token is missing
 */
export async function setCsrfTokenCookie(): Promise<string> {
  const cookieStore = await cookies();
  const signedToken = await createSignedCsrfToken();

  cookieStore.set(CSRF_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: true, // Always secure (browsers exempt localhost)
    sameSite: 'strict', // Strict for CSRF cookie
    maxAge: CSRF_TOKEN_MAX_AGE,
    path: '/',
  });

  return signedToken;
}

/**
 * Get the current CSRF token from cookie
 * Returns the raw token (without signature) for comparison
 */
export async function getCsrfTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(CSRF_COOKIE_NAME);

  if (!cookie?.value) {
    return null;
  }

  return parseSignedCsrfToken(cookie.value);
}

/**
 * Clear CSRF token cookie (on logout)
 */
export async function clearCsrfTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CSRF_COOKIE_NAME);
}

// =============================================================================
// Request Verification
// =============================================================================

/**
 * Verify CSRF token from request header matches cookie
 * Returns true if valid, false if invalid
 */
export async function verifyCsrfToken(request: NextRequest): Promise<boolean> {
  // GET requests don't need CSRF protection (they should be idempotent)
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return true;
  }

  // Get token from header
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!headerToken) {
    console.warn('[CSRF] Missing X-CSRF-Token header');
    return false;
  }

  // Parse the header token (it should be the full signed token)
  const headerTokenParsed = await parseSignedCsrfToken(headerToken);
  if (!headerTokenParsed) {
    console.warn('[CSRF] Invalid token signature in header');
    return false;
  }

  // Get token from cookie
  const cookieToken = await getCsrfTokenFromCookie();
  if (!cookieToken) {
    console.warn('[CSRF] Missing or invalid CSRF cookie');
    return false;
  }

  // Compare tokens (constant-time)
  if (headerTokenParsed.length !== cookieToken.length) {
    console.warn('[CSRF] Token length mismatch');
    return false;
  }

  let result = 0;
  for (let i = 0; i < headerTokenParsed.length; i++) {
    result |= headerTokenParsed.charCodeAt(i) ^ cookieToken.charCodeAt(i);
  }

  if (result !== 0) {
    console.warn('[CSRF] Token mismatch');
    return false;
  }

  return true;
}

/**
 * Create a CSRF error response
 */
export function createCsrfErrorResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'CSRF validation failed',
      message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
      code: 'CSRF_VALIDATION_FAILED'
    },
    { status: 403 }
  );
}

// =============================================================================
// Middleware Helper
// =============================================================================

/**
 * CSRF protection middleware wrapper for admin routes
 * Use this to wrap admin route handlers
 *
 * @example
 * export const POST = withCsrfProtection(async (request) => {
 *   // Your handler code
 * });
 */
export function withCsrfProtection<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>
): (request: T) => Promise<NextResponse> {
  return async (request: T): Promise<NextResponse> => {
    const isValid = await verifyCsrfToken(request);

    if (!isValid) {
      return createCsrfErrorResponse();
    }

    return handler(request);
  };
}

// =============================================================================
// API Endpoint for Getting Token
// =============================================================================

/**
 * Get or create CSRF token for client
 * This should be called by the client to get a token for subsequent requests
 *
 * Returns the full signed token that the client should send in the X-CSRF-Token header
 */
export async function getOrCreateCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(CSRF_COOKIE_NAME);

  if (existingCookie?.value) {
    // Verify the existing token is still valid
    const parsed = await parseSignedCsrfToken(existingCookie.value);
    if (parsed) {
      return existingCookie.value;
    }
  }

  // Create new token
  return setCsrfTokenCookie();
}
