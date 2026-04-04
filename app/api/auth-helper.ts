import type { NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { DEV_TEST_USERS } from '../utils/testUsers';
import { getCollectionName } from '../utils/environmentConfig';
import { parseSignedCookieValue, type SessionCookieData } from '../utils/cookieUtils';
import { verifyIdToken } from '../lib/firebase-rest';

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

// Removed Firebase Admin initialization - using simple cookie-based auth

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
 * @param errorType - The type of error (maps to status code)
 * @param customMessage - Custom error message to display
 * @param extraData - Additional data to include in response (e.g., errorCode, errorId)
 */
export const createErrorResponse = (
  errorType: ApiErrorType,
  customMessage: string | null = null,
  extraData: Record<string, any> | null = null
): Response => {
  const error = ApiErrors[errorType] || ApiErrors.INTERNAL_ERROR;
  return createApiResponse(extraData, customMessage || error.message, error.status);
};

/**
 * Create standardized success response
 */
export const createSuccessResponse = <T>(
  data: T,
  message: string | null = null
): Response => {
  return createApiResponse(data, message, 200);
};

/**
 * Helper function to get user email, handling development vs production users
 * @param userId - The user ID from authentication
 * @returns The user email or null if not found
 */
export async function getUserEmailFromId(userId: string): Promise<string | null> {
  try {
    // Handle development users from DEV_TEST_USERS
    const testUser = Object.values(DEV_TEST_USERS).find(user => user.uid === userId);
    if (testUser) {
      return testUser.email;
    }

    // Handle legacy development user IDs
    if (userId === 'dev_admin_user') {
      return 'jamie@wewrite.app';
    }
    if (userId === 'dev_test_user_1') {
      return 'test@local.dev';
    }

    // Production: get from Firestore (avoids admin.auth() jose issues in Vercel)
    const admin = getFirebaseAdmin();
    if (!admin) {
      console.warn('Firebase Admin not available');
      return null;
    }

    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    return userDoc.data()?.email || null;
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
  // Only log auth debug when explicitly enabled (not just in development, to reduce console spam)
  const shouldLogAuthDebug = process.env.AUTH_DEBUG === 'true';

  // 1. Try session cookie first (web app)
  const simpleSessionUserId = await trySimpleUserSessionCookie(request);
  if (simpleSessionUserId) {
    if (shouldLogAuthDebug) {
      console.log('[AUTH DEBUG] Using userId from simpleUserSession:', simpleSessionUserId);
    }
    return simpleSessionUserId;
  }

  // 2. Try Bearer token (mobile app / API clients)
  const bearerUserId = await tryBearerToken(request);
  if (bearerUserId) {
    if (shouldLogAuthDebug) {
      console.log('[AUTH DEBUG] Using userId from Bearer token:', bearerUserId);
    }
    return bearerUserId;
  }

  // No user ID found
  if (shouldLogAuthDebug) {
    console.log('[AUTH DEBUG] No valid authentication found, returning null');
  }
  return null;
}

/**
 * Try to authenticate using simpleUserSession cookie (auth system)
 * Now uses HMAC signature verification for tamper protection
 */
async function trySimpleUserSessionCookie(request: NextRequest): Promise<string | null> {
  const simpleSessionCookie = request.cookies.get('simpleUserSession')?.value;
  if (!simpleSessionCookie) {
    return null;
  }

  // Use the signed cookie parser which:
  // 1. Verifies HMAC signature (new format)
  // 2. Falls back to parsing legacy unsigned JSON (for migration)
  const sessionData = await parseSignedCookieValue<SessionCookieData>(simpleSessionCookie);

  if (sessionData && sessionData.uid) {
    return sessionData.uid;
  }

  // Handle legacy dev user format (plain UID string)
  if (simpleSessionCookie === 'dev_admin_user') {
    return 'mP9yRa3nO6gS8wD4xE2hF5jK7m9N';
  } else if (simpleSessionCookie === 'dev_test_user_1') {
    return 'dev_test_user_1';
  }

  return null;
}

/**
 * Try to authenticate using Authorization Bearer token (mobile app / API clients)
 * Accepts Firebase ID tokens passed as: Authorization: Bearer <idToken>
 */
async function tryBearerToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  try {
    const result = await verifyIdToken(token);
    if (result.success && result.uid) {
      return result.uid;
    }
  } catch (error) {
    console.warn('[AUTH] Bearer token verification failed:', error);
  }

  return null;
}

// Simplified authentication - only using simple session cookie

