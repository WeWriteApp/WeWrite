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
 * Helper function to get user email, handling development vs production users
 * @param userId - The user ID from authentication
 * @returns The user email or null if not found
 */
export async function getUserEmailFromId(userId: string): Promise<string | null> {
  try {
    // Handle development users
    if (userId === 'dev_admin_user') {
      return 'jamie@wewrite.app';
    }
    if (userId === 'dev_test_user_1') {
      return 'test@local.dev';
    }

    // Production: get from Firebase Auth
    if (!auth) {
      console.warn('Firebase Auth not available');
      return null;
    }

    const userRecord = await auth.getUser(userId);
    return userRecord.email || null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
}

/**
 * Helper function to get the user ID from a request
 * Updated for auth system using simpleUserSession cookie
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

  const shouldLogAuthDebug = process.env.AUTH_DEBUG === 'true' || process.env.NODE_ENV === 'development';

  // SIMPLIFIED: Only use the new auth system cookie
  const simpleSessionUserId = await trySimpleUserSessionCookie(request);
  if (simpleSessionUserId) {
    if (shouldLogAuthDebug) {
      console.log('[AUTH DEBUG] Using userId from simpleUserSession:', simpleSessionUserId);
    }
    return simpleSessionUserId;
  }

  // Fallback: Try Authorization header (Bearer token) for API calls
  const authHeaderUserId = await tryAuthorizationHeader(request);
  if (authHeaderUserId) {
    if (shouldLogAuthDebug) {
      console.log('[AUTH DEBUG] Using userId from Authorization header:', authHeaderUserId);
    }
    return authHeaderUserId;
  }

  // No user ID found
  if (shouldLogAuthDebug) {
    console.log('[AUTH DEBUG] No valid authentication found, returning null');
  }
  return null;
}

/**
 * Try to authenticate using simpleUserSession cookie (auth system)
 */
async function trySimpleUserSessionCookie(request: NextRequest): Promise<string | null> {
  const simpleSessionCookie = request.cookies.get('simpleUserSession')?.value;
  if (!simpleSessionCookie) {
    return null;
  }

  try {
    // Try parsing as JSON first (new format)
    const sessionData = JSON.parse(simpleSessionCookie);
    if (sessionData && sessionData.uid) {
      return sessionData.uid;
    } else {
      console.log('[AUTH DEBUG] simpleUserSession cookie missing uid:', sessionData);
      return null;
    }
  } catch (error: any) {
    // If JSON parsing fails, treat as plain string (legacy format for dev)
    if (simpleSessionCookie === 'dev_admin_user' || simpleSessionCookie === 'dev_test_user_1') {
      console.log('[AUTH DEBUG] Using legacy session format:', simpleSessionCookie);
      return simpleSessionCookie;
    }

    console.error('[AUTH DEBUG] Error parsing simpleUserSession cookie:', error);
    return null;
  }
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
    console.log('[AUTH DEBUG] Session error code:', sessionError.code);
    console.log('[AUTH DEBUG] Session error details:', {
      name: sessionError.name,
      code: sessionError.code,
      message: sessionError.message
    });

    try {
      // If session cookie fails, try as ID token
      const decodedToken = await auth.verifyIdToken(sessionCookie);
      console.log('[AUTH DEBUG] Session cookie verified as ID token, userId:', decodedToken.uid);
      return decodedToken.uid;
    } catch (tokenError: any) {
      console.error('[AUTH DEBUG] Error verifying session cookie as ID token:', tokenError.message);
      console.error('[AUTH DEBUG] Token error code:', tokenError.code);
      console.error('[AUTH DEBUG] Token error details:', {
        name: tokenError.name,
        code: tokenError.code,
        message: tokenError.message
      });
      return null;
    }
  }
}

/**
 * Try to authenticate using userSession cookie (WeWrite format)
 */
async function tryUserSessionCookie(request: NextRequest): Promise<string | null> {
  const shouldLogAuthDebug = process.env.AUTH_DEBUG === 'true' || (process.env.NODE_ENV === 'development' && Math.random() < 0.01);

  const userSessionCookie = request.cookies.get('userSession')?.value;
  if (!userSessionCookie) {
    if (shouldLogAuthDebug) {
      console.log('[AUTH DEBUG] No userSession cookie found');
    }
    return null;
  }

  // Only log userSession details when debugging
  if (shouldLogAuthDebug) {
    console.log('[AUTH DEBUG] Found userSession cookie, length:', userSessionCookie.length);
  }

  try {
    // Try parsing as JSON first (new format)
    const userSession: UserSession = JSON.parse(userSessionCookie);
    if (userSession && userSession.uid) {
      if (shouldLogAuthDebug) {
        console.log('[AUTH DEBUG] Using userId from userSession cookie (JSON format):', userSession.uid);
        console.log('[AUTH DEBUG] UserSession details:', {
          uid: userSession.uid,
          email: userSession.email,
          username: userSession.username,
          isDevelopment: userSession.isDevelopment
        });
      }
      return userSession.uid;
    } else {
      console.log('[AUTH DEBUG] userSession cookie missing uid:', userSession);
      return null;
    }
  } catch (error: any) {
    // If JSON parsing fails, treat as plain string (legacy format)
    console.log('[AUTH DEBUG] JSON parsing failed, treating as plain string:', userSessionCookie);
    console.log('[AUTH DEBUG] Parse error details:', {
      name: error.name,
      message: error.message,
      cookieLength: userSessionCookie.length,
      cookiePreview: userSessionCookie.substring(0, 100)
    });

    if (userSessionCookie && typeof userSessionCookie === 'string' && userSessionCookie.trim()) {
      if (shouldLogAuthDebug) {
        console.log('[AUTH DEBUG] Using userId from userSession cookie (string format):', userSessionCookie);
      }
      return userSessionCookie.trim();
    }
    if (shouldLogAuthDebug) {
      console.error('[AUTH DEBUG] Error parsing userSession cookie:', error);
    }
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

