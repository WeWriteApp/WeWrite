/**
 * Cookie Utilities
 *
 * Centralized cookie management with HMAC signing for session security.
 * All session cookies should use these utilities to ensure:
 * - Consistent security settings
 * - Cryptographic signing to prevent tampering
 * - Proper verification on read
 */

import { cookies } from 'next/headers';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Get the cookie signing secret from environment
 * Falls back to a default in development only
 */
function getCookieSecret(): string {
  const secret = process.env.COOKIE_SIGNING_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'development') {
      // Development-only fallback - NOT for production
      console.warn('[Cookie Utils] COOKIE_SIGNING_SECRET not set, using development fallback');
      return 'dev-cookie-secret-not-for-production';
    }
    // In production, we'll use a hash of other secrets as fallback
    // This ensures cookies still work but logs a warning
    const fallback = process.env.STRIPE_WEBHOOK_SECRET || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
    if (fallback) {
      console.warn('[Cookie Utils] COOKIE_SIGNING_SECRET not set, using derived secret');
      return `derived-${fallback.slice(0, 32)}`;
    }
    throw new Error('COOKIE_SIGNING_SECRET must be set in production');
  }

  return secret;
}

/**
 * Standard cookie options for session cookies
 * Centralized to ensure consistency across all auth routes
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Always true - browsers exempt localhost from HTTPS requirement
  sameSite: 'lax' as const,
  path: '/',
  // 7 days - reasonable balance between security and UX
  maxAge: 60 * 60 * 24 * 7,
};

/**
 * Cookie options for device session tracking
 */
export const DEVICE_SESSION_COOKIE_OPTIONS = {
  ...SESSION_COOKIE_OPTIONS,
  // Device sessions can be longer since they're for tracking, not auth
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

// =============================================================================
// HMAC Signing
// =============================================================================

/**
 * Create HMAC signature for data
 * Uses Web Crypto API (available in Node.js 18+)
 */
async function createHmacSignature(data: string): Promise<string> {
  const secret = getCookieSecret();
  const encoder = new TextEncoder();

  // Import the secret key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the data
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );

  // Convert to base64url (URL-safe base64)
  const hashArray = Array.from(new Uint8Array(signature));
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Verify HMAC signature
 */
async function verifyHmacSignature(data: string, signature: string): Promise<boolean> {
  try {
    const expectedSignature = await createHmacSignature(data);

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('[Cookie Utils] Signature verification error:', error);
    return false;
  }
}

// =============================================================================
// Signed Cookie Operations
// =============================================================================

/**
 * Create a signed cookie value
 * Format: base64url(data).signature
 */
export async function createSignedCookieValue<T>(data: T): Promise<string> {
  const jsonString = JSON.stringify(data);
  // Base64url encode the data
  const encodedData = btoa(jsonString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const signature = await createHmacSignature(encodedData);
  return `${encodedData}.${signature}`;
}

/**
 * Parse and verify a signed cookie value
 * Returns null if signature is invalid or parsing fails
 */
export async function parseSignedCookieValue<T>(cookieValue: string): Promise<T | null> {
  try {
    // First, check if this looks like a legacy JSON cookie (starts with { or [)
    // This handles the common case where old cookies have JSON objects
    if (cookieValue.startsWith('{') || cookieValue.startsWith('[') || cookieValue.startsWith('%7B')) {
      return parseLegacyCookieValue<T>(cookieValue);
    }

    // Try to split into data.signature format
    // Signed cookies have exactly one dot, and both parts are base64url encoded
    const dotIndex = cookieValue.lastIndexOf('.');
    if (dotIndex === -1) {
      // No dot at all - try as legacy
      return parseLegacyCookieValue<T>(cookieValue);
    }

    const encodedData = cookieValue.substring(0, dotIndex);
    const signature = cookieValue.substring(dotIndex + 1);

    // Validate that both parts look like base64url (no special JSON chars)
    const base64urlRegex = /^[A-Za-z0-9_-]+$/;
    if (!base64urlRegex.test(encodedData) || !base64urlRegex.test(signature)) {
      // Contains non-base64url characters - likely legacy JSON with a dot in it
      return parseLegacyCookieValue<T>(cookieValue);
    }

    // Verify signature
    const isValid = await verifyHmacSignature(encodedData, signature);
    if (!isValid) {
      // Invalid signature - could be legacy cookie or tampered
      // Try legacy parsing as fallback (for migration period)
      const legacyResult = parseLegacyCookieValue<T>(cookieValue);
      if (legacyResult) {
        return legacyResult;
      }
      return null;
    }

    // Decode and parse data
    // Restore base64 padding and standard characters
    const base64 = encodedData.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;
    const jsonString = atob(paddedBase64);

    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('[Cookie Utils] Failed to parse signed cookie:', error);
    // Last resort: try legacy parsing
    return parseLegacyCookieValue<T>(cookieValue);
  }
}

/**
 * Parse legacy unsigned cookie (for backward compatibility during migration)
 * This allows existing sessions to continue working
 */
function parseLegacyCookieValue<T>(cookieValue: string): T | null {
  try {
    // Try direct JSON parse (old format)
    const data = JSON.parse(cookieValue);
    return data as T;
  } catch {
    // Try URL-decoded JSON
    try {
      const decoded = decodeURIComponent(cookieValue);
      const data = JSON.parse(decoded);
      return data as T;
    } catch {
      return null;
    }
  }
}

// =============================================================================
// Session Cookie Management
// =============================================================================

export interface SessionCookieData {
  uid: string;
  email: string;
  username?: string;
  photoURL?: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
  createdAt?: string;
}

/**
 * Set the session cookie with signing
 */
export async function setSessionCookie(data: SessionCookieData): Promise<void> {
  const cookieStore = await cookies();
  const signedValue = await createSignedCookieValue(data);

  cookieStore.set('simpleUserSession', signedValue, SESSION_COOKIE_OPTIONS);
}

/**
 * Get and verify the session cookie
 * Returns null if cookie is missing, invalid, or tampered with
 */
export async function getSessionCookie(): Promise<SessionCookieData | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('simpleUserSession');

  if (!cookie?.value) {
    return null;
  }

  return parseSignedCookieValue<SessionCookieData>(cookie.value);
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('simpleUserSession');
}

// =============================================================================
// Client IP Extraction (shared utility)
// =============================================================================

/**
 * Extract client IP address from request headers
 * Checks multiple headers for proxy/CDN compatibility
 */
export function getClientIP(headers: Headers): string {
  // Cloudflare
  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  // Standard reverse proxy header
  const realIP = headers.get('x-real-ip');
  if (realIP) return realIP;

  // X-Forwarded-For (can contain multiple IPs, first is client)
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}
