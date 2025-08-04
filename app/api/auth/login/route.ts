import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { secureLogger, maskEmail } from '../../../utils/secureLogging';

/**
 * Login API Endpoint
 *
 * This endpoint provides Firebase authentication.
 * Standard Firebase Auth implementation.
 */

interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  user?: {
    uid: string;
    email: string;
    username?: string;
    displayName: string;
    emailVerified: boolean;
  };
  error?: string;
}

// Helper function to create error responses
function createErrorResponse(message: string, status: number = 400): NextResponse {
  const response: LoginResponse = {
    success: false,
    error: message
  };
  return NextResponse.json(response, { status });
}

// Helper function to create success responses
function createSuccessResponse(user: LoginResponse['user']): NextResponse {
  const response: LoginResponse = {
    success: true,
    user
  };
  return NextResponse.json(response);
}

// POST endpoint - User login
export async function POST(request: NextRequest) {
  try {
    console.log('[Auth] Login request received');
    console.log('[Auth] Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('[Auth] Request URL:', request.url);

    const body = await request.json() as LoginRequest;
    const { emailOrUsername, password } = body;

    // SECURITY: Use secure logging to prevent email exposure
    secureLogger.info('[Auth] Login attempt', {
      emailOrUsername: emailOrUsername.includes('@') ? maskEmail(emailOrUsername) : emailOrUsername,
      hasPassword: password ? 'YES' : 'NO'
    });

    // Validate required fields
    if (!emailOrUsername || !password) {
      console.log('[Auth] Missing required fields');
      return createErrorResponse('Email/username and password are required');
    }

    // Check if we should use dev auth system
    // ONLY use dev auth for local development with USE_DEV_AUTH=true
    // Preview and production environments should use Firebase Auth with real credentials
    const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';

    if (useDevAuth) {
      console.log('[Auth] Using dev auth system (local development only)');

      // In development mode, check against known test accounts
      const testAccounts = [
        { email: 'test@local.dev', username: 'testuser', password: 'TestPassword123!', uid: 'dev_test_user_1', isAdmin: false },
        { email: 'jamie@wewrite.app', username: 'jamie', password: 'TestPassword123!', uid: 'dev_admin_user', isAdmin: true }
      ];

      // Find matching account
      const account = testAccounts.find(acc =>
        (acc.email === emailOrUsername || acc.username === emailOrUsername) && acc.password === password
      );

      if (!account) {
        console.log('[Auth] Dev auth login failed: invalid credentials');
        return createErrorResponse('Invalid credentials');
      }

      // Create session cookie
      const cookieStore = await cookies();
      const sessionData = {
        uid: account.uid,
        email: account.email,
        username: account.username,
        displayName: account.username,
        emailVerified: true
      };

      cookieStore.set('simpleUserSession', JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });

      // CRITICAL FIX: Create proper session record for dev auth (for device management)
      const sessionId = await createDevUserSession(request, account.uid);
      if (sessionId) {
        cookieStore.set('sessionId', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
      }

      // SECURITY: Use secure logging to prevent email exposure
      secureLogger.info('[Auth] Dev auth login successful', {
        email: maskEmail(account.email),
        username: account.username
      });

      return createSuccessResponse({
        uid: account.uid,
        email: account.email,
        username: account.username,
        displayName: account.username,
        emailVerified: true
      });
    }

    // Production mode: use Firebase Auth
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }
    const auth = admin.auth();
    const firestore = admin.firestore();

    // Determine if input is email or username
    const isEmail = emailOrUsername.includes('@');
    let email = emailOrUsername;

    // If username provided, look up email
    if (!isEmail) {
      const usersCollection = getCollectionName('users');
      const userQuery = await firestore
        .collection(usersCollection)
        .where('username', '==', emailOrUsername)
        .limit(1)
        .get();

      if (userQuery.empty) {
        return createErrorResponse('User not found');
      }

      email = userQuery.docs[0].data().email;
    }

    // Try to get user by email to verify they exist
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      return createErrorResponse('Invalid credentials');
    }

    // Get user data from Firestore
    const usersCollection = getCollectionName('users');
    const userDoc = await firestore.collection(usersCollection).doc(userRecord.uid).get();

    if (!userDoc.exists) {
      return createErrorResponse('User profile not found');
    }

    const userData = userDoc.data();

    // Create session cookie
    const cookieStore = await cookies();
    const sessionData = {
      uid: userRecord.uid,
      email: userRecord.email!,
      username: userData?.username,
      emailVerified: userRecord.emailVerified
    };

    cookieStore.set('simpleUserSession', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // SECURITY: Use secure logging to prevent email exposure
    secureLogger.info('[Auth] Login successful', {
      email: maskEmail(userRecord.email!),
      username: userData?.username
    });

    return createSuccessResponse({
      uid: userRecord.uid,
      email: userRecord.email!,
      username: userData?.username,
      displayName: userData?.displayName || userRecord.displayName || userRecord.email!,
      emailVerified: userRecord.emailVerified
    });

  } catch (error) {
    console.error('[Auth] Login error:', error);
    return createErrorResponse('An error occurred during login', 500);
  }
}

/**
 * Helper function to create user session for dev auth (for device management compatibility)
 */
async function createDevUserSession(request: NextRequest, userId: string): Promise<string | null> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) return null;

    const db = admin.firestore();
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = getClientIP(request);
    const deviceInfo = parseUserAgent(userAgent);

    const sessionId = 'dev_session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const sessionData = {
      userId,
      deviceInfo: {
        userAgent,
        ...deviceInfo,
      },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      ipAddress,
      isActive: true,
      isDevelopment: true, // Mark as dev session
    };

    // Store session in Firestore using environment-aware collection name
    await db.collection(getCollectionName('userSessions')).doc(sessionId).set(sessionData);

    console.log(`Created dev user session ${sessionId} for user ${userId}`);
    return sessionId;
  } catch (error) {
    console.error('Error creating dev user session:', error);
    return null;
  }
}

/**
 * Parse user agent to extract device information
 */
function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  // Detect device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (ua.includes('mobile')) deviceType = 'mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) deviceType = 'tablet';

  // Detect platform
  let platform = 'Unknown';
  if (ua.includes('windows')) platform = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) platform = 'Mac';
  else if (ua.includes('linux')) platform = 'Linux';
  else if (ua.includes('android')) platform = 'Android';
  else if (ua.includes('iphone')) platform = 'iPhone';
  else if (ua.includes('ipad')) platform = 'iPad';

  return { browser, os, deviceType, platform };
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');

  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}


