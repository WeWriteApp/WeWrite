import { getAuth, type Auth } from 'firebase-admin/auth';
import { initAdmin } from "../firebase/admin";
import type { NextRequest } from 'next/server';

// Type definitions
interface ApiResponse<T = any> {
  success: boolean;
  timestamp: string;
  data?: T;
  error?: string;
}

interface ApiError {
  message: string;
  status: number;
}

interface UserSession {
  uid?: string;
  email?: string;
  emailVerified?: boolean;
  [key: string]: any;
}

type ApiErrorType = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'INTERNAL_ERROR' | 'FEATURE_DISABLED';

// Initialize Firebase Admin only if not during build time
let auth: Auth | null = null;
try {
  const app = initAdmin();
  if (app) {
    auth = getAuth();
  }
} catch (error) {
  console.warn('Firebase Admin initialization skipped during build time');
}

/**
 * Standard API response format for consistent error handling
 */
export const createApiResponse = <T = any>(
  data: T | null = null,
  error: string | Error | null = null,
  status: number = 200
): Response => {
  const response: ApiResponse<T> = {
    success: !error,
    timestamp: new Date().toISOString(),
    ...(data && { data }),
    ...(error && { error: typeof error === 'string' ? error : error.message })
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

/**
 * Standard error responses
 */
export const ApiErrors: Record<ApiErrorType, ApiError> = {
  UNAUTHORIZED: { message: 'Authentication required', status: 401 },
  FORBIDDEN: { message: 'Insufficient permissions', status: 403 },
  NOT_FOUND: { message: 'Resource not found', status: 404 },
  BAD_REQUEST: { message: 'Invalid request parameters', status: 400 },
  INTERNAL_ERROR: { message: 'Internal server error', status: 500 },
  FEATURE_DISABLED: { message: 'Feature is currently disabled', status: 404 }
};

/**
 * Create standardized error response
 */
export const createErrorResponse = (
  errorType: ApiErrorType,
  customMessage: string | null = null
): Response => {
  const error = ApiErrors[errorType] || ApiErrors.INTERNAL_ERROR;
  return createApiResponse(null, customMessage || error.message, error.status);
};

/**
 * Helper function to get the user ID from a request
 * Tries multiple authentication methods:
 * 1. Session cookie (Firebase session)
 * 2. userSession cookie (WeWrite session)
 * 3. Authorization header (Bearer token)
 *
 * @param request - The Next.js request object
 * @returns The user ID or null if not authenticated
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  // Return null if auth is not available (during build time)
  if (!auth) {
    console.warn('Firebase Auth not available, returning null');
    return null;
  }

  // Debug: Log all available cookies
  const allCookies: Record<string, string> = {};
  try {
    // Next.js App Router: request.cookies is a RequestCookies object
    // Handle different cookie implementations between environments
    if (request.cookies && typeof request.cookies.entries === 'function') {
      for (const [name, value] of request.cookies.entries()) {
        allCookies[name] = value;
      }
    } else if (request.cookies && typeof request.cookies.getAll === 'function') {
      // Alternative method for some environments
      const cookieArray = request.cookies.getAll();
      for (const cookie of cookieArray) {
        allCookies[cookie.name] = cookie.value;
      }
    } else {
      console.log('[AUTH DEBUG] Unable to enumerate cookies, using direct access only');
    }
  } catch (cookieError: any) {
    console.warn('[AUTH DEBUG] Error enumerating cookies:', cookieError.message);
  }

  console.log('[AUTH DEBUG] Available cookies:', Object.keys(allCookies));
  console.log('[AUTH DEBUG] Session cookie exists:', !!request.cookies.get('session')?.value);
  console.log('[AUTH DEBUG] UserSession cookie exists:', !!request.cookies.get('userSession')?.value);

  // SECURITY: Query parameter authentication has been permanently removed
  // to prevent authentication bypass vulnerabilities

  // Check for development mode
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Try to get from session cookie (Firebase session)
  const userId = await trySessionCookie(request);
  if (userId) {
    return userId;
  }

  // If still no userId, try userSession cookie (standard WeWrite auth)
  const userSessionUserId = await tryUserSessionCookie(request);
  if (userSessionUserId) {
    return userSessionUserId;
  }

  // Try to get from Authorization header (Bearer token)
  const authHeaderUserId = await tryAuthorizationHeader(request);
  if (authHeaderUserId) {
    return authHeaderUserId;
  }

  // No user ID found
  console.log('[AUTH DEBUG] No valid authentication found, returning null');
  return null;
}

/**
 * Try to authenticate using Firebase session cookie
 */
async function trySessionCookie(request: NextRequest): Promise<string | null> {
  if (!auth) return null;

  const sessionCookie = request.cookies.get('session')?.value;
  if (!sessionCookie) return null;

  console.log('[AUTH DEBUG] Found session cookie, length:', sessionCookie.length);

  try {
    // Try to verify as session cookie first
    const decodedClaims = await auth.verifySessionCookie(sessionCookie);
    console.log('[AUTH DEBUG] Session cookie verified successfully, userId:', decodedClaims.uid);
    return decodedClaims.uid;
  } catch (sessionError: any) {
    console.log('[AUTH DEBUG] Session cookie verification failed:', sessionError.message);

    try {
      // If session cookie fails, try as ID token
      const decodedToken = await auth.verifyIdToken(sessionCookie);
      console.log('[AUTH DEBUG] Session cookie verified as ID token, userId:', decodedToken.uid);
      return decodedToken.uid;
    } catch (tokenError: any) {
      console.error('[AUTH DEBUG] Error verifying session cookie as ID token:', tokenError.message);
      return null;
    }
  }
}

/**
 * Try to authenticate using userSession cookie (WeWrite format)
 */
async function tryUserSessionCookie(request: NextRequest): Promise<string | null> {
  const userSessionCookie = request.cookies.get('userSession')?.value;
  if (!userSessionCookie) {
    console.log('[AUTH DEBUG] No userSession cookie found');
    return null;
  }

  console.log('[AUTH DEBUG] Found userSession cookie, length:', userSessionCookie.length);

  try {
    // Try parsing as JSON first (new format)
    const userSession: UserSession = JSON.parse(userSessionCookie);
    if (userSession && userSession.uid) {
      console.log('[AUTH DEBUG] Using userId from userSession cookie (JSON format):', userSession.uid);
      return userSession.uid;
    } else {
      console.log('[AUTH DEBUG] userSession cookie missing uid:', userSession);
      return null;
    }
  } catch (error: any) {
    // If JSON parsing fails, treat as plain string (legacy format)
    console.log('[AUTH DEBUG] JSON parsing failed, treating as plain string:', userSessionCookie);
    if (userSessionCookie && typeof userSessionCookie === 'string' && userSessionCookie.trim()) {
      console.log('[AUTH DEBUG] Using userId from userSession cookie (string format):', userSessionCookie);
      return userSessionCookie.trim();
    }
    console.error('[AUTH DEBUG] Error parsing userSession cookie:', error);
    return null;
  }
}

/**
 * Try to authenticate using Authorization header
 */
async function tryAuthorizationHeader(request: NextRequest): Promise<string | null> {
  if (!auth) return null;

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decodedToken = await auth.verifyIdToken(token);
    console.log('Using userId from Authorization header:', decodedToken.uid);
    return decodedToken.uid;
  } catch (error: any) {
    console.error('Error verifying ID token:', error);
    return null;
  }
}

