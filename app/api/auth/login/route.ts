/**
 * Login API Endpoint
 * 
 * Handles:
 * - Development mode login (with test users)
 * - Username to email lookup (using firebase-admin Firestore - NOT Auth)
 * - Setting session cookies
 * 
 * Note: Firebase Admin Auth operations are avoided due to jose dependency issues in Vercel.
 * Only Firestore operations are used here, which work fine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { secureLogger, maskEmail } from '../../../utils/secureLogging';
import { DEV_TEST_USERS, validateDevTestPassword, verifyDevPassword } from '../../../utils/testUsers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { authRateLimiter } from '../../../utils/rateLimiter';
import { createSignedCookieValue, type SessionCookieData } from '../../../utils/cookieUtils';
import { verifyTurnstileToken, isTurnstileConfigured } from '../../../services/TurnstileVerificationService';

// Dev mode cookie options (only used when USE_DEV_AUTH=true in development)
const DEV_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false, // Dev mode only - HTTP is fine for localhost
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
};

interface LoginRequest {
  emailOrUsername: string;
  password: string;
  turnstileToken?: string;
}

interface LoginResponse {
  success: boolean;
  user?: {
    uid: string;
    email: string;
    username?: string;
    emailVerified: boolean;
  };
  error?: string;
}

// Helper function to create error responses
function createErrorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// Helper function to create success responses
function createSuccessResponse(user: LoginResponse['user']): NextResponse {
  return NextResponse.json({ success: true, user });
}

// Helper to get client IP from request
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

// POST endpoint - User login
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting to prevent brute force attacks
  const clientIp = getClientIp(request);
  const rateLimitResult = await authRateLimiter.checkLimit(clientIp);

  if (!rateLimitResult.allowed) {
    secureLogger.warn('[Auth] Rate limit exceeded', { ip: clientIp });
    return NextResponse.json({
      success: false,
      error: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
    }, {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
      }
    });
  }

  try {
    const body = await request.json() as LoginRequest;
    const { emailOrUsername, password, turnstileToken } = body;

    // SECURITY: Verify Turnstile token if configured
    if (isTurnstileConfigured()) {
      if (!turnstileToken) {
        secureLogger.warn('[Auth] Login attempt without Turnstile token', { ip: clientIp });
        return createErrorResponse('Security verification required. Please complete the CAPTCHA.', 400);
      }

      const turnstileResult = await verifyTurnstileToken({
        token: turnstileToken,
        remoteIp: clientIp,
      });

      if (!turnstileResult.success) {
        secureLogger.warn('[Auth] Turnstile verification failed', {
          ip: clientIp,
          errors: turnstileResult.error_codes,
        });
        return createErrorResponse('Security verification failed. Please try again.', 400);
      }
    }

    // SECURITY: Use secure logging to prevent email exposure
    secureLogger.info('[Auth] Login attempt', {
      emailOrUsername: emailOrUsername?.includes('@') ? maskEmail(emailOrUsername) : emailOrUsername,
      hasPassword: password ? 'YES' : 'NO',
      inputType: emailOrUsername?.includes('@') ? 'email' : 'username',
      environment: getEnvironmentType()
    });

    // Check if we should use dev auth system
    const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
    const isQuickLogin = useDevAuth && (body as any).quickLogin === true;

    // Validate required fields (skip password check for dev quick login)
    if (!emailOrUsername || (!password && !isQuickLogin)) {
      return createErrorResponse('Email/username and password are required');
    }

    if (useDevAuth) {
      console.log('[Auth] Using dev auth system (local development only)');

      // In development mode, first check against known test accounts
      const testAccountsArray = Object.values(DEV_TEST_USERS);

      // Find account by email or username
      const account = testAccountsArray.find(acc =>
        (acc.email === emailOrUsername || acc.username === emailOrUsername)
      );

      // Quick login: skip password for predefined test accounts in dev mode
      const passwordValid = isQuickLogin ? true : (account && validateDevTestPassword(password));

      if (account && passwordValid) {
        // Create signed session cookie for predefined test account
        const cookieStore = await cookies();
        const sessionData: SessionCookieData = {
          uid: account.uid,
          email: account.email,
          username: account.username,
          emailVerified: true,
          isAdmin: account.isAdmin || false
        };

        const signedValue = await createSignedCookieValue(sessionData);
        cookieStore.set('simpleUserSession', signedValue, DEV_SESSION_COOKIE_OPTIONS);

        secureLogger.info('[Auth] Dev auth login successful (predefined user)', {
          email: maskEmail(account.email),
          username: account.username
        });

        return createSuccessResponse({
          uid: account.uid,
          email: account.email,
          username: account.username,
          emailVerified: true
        });
      }

      // Check for dynamically registered dev users in DEV_users collection
      console.log('[Auth] Checking for dev-registered user...');
      const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82';
      const usersCollection = getCollectionName('users');
      const usernamesCollection = getCollectionName('usernames');
      
      // Look up user by email or username
      let userDoc: { fields?: Record<string, any>; name?: string } | null = null;
      const isEmail = emailOrUsername.includes('@');
      
      if (isEmail) {
        // Query by email
        const queryUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
        const queryResponse = await fetch(queryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: usersCollection }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'email' },
                  op: 'EQUAL',
                  value: { stringValue: emailOrUsername }
                }
              },
              limit: 1
            }
          })
        });
        
        const queryResult = await queryResponse.json();
        if (queryResult[0]?.document) {
          userDoc = queryResult[0].document;
        }
      } else {
        // Look up by username first
        const usernameUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${usernamesCollection}/${emailOrUsername.toLowerCase()}`;
        const usernameResponse = await fetch(usernameUrl);
        
        if (usernameResponse.ok) {
          const usernameData = await usernameResponse.json();
          const uid = usernameData.fields?.uid?.stringValue;
          
          if (uid) {
            const userUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${usersCollection}/${uid}`;
            const userResponse = await fetch(userUrl);
            if (userResponse.ok) {
              userDoc = await userResponse.json();
            }
          }
        }
      }
      
      if (userDoc) {
        const fields = userDoc.fields || {};
        const storedPasswordHash = fields.passwordHash?.stringValue;

        // Use verifyDevPassword which supports both SHA-256 (new) and base64 (legacy) formats
        const passwordValid = storedPasswordHash && await verifyDevPassword(password, storedPasswordHash);

        if (passwordValid) {
          // Extract uid from document path
          const docPath = userDoc.name || '';
          const uid = docPath.split('/').pop() || '';
          
          const userData: SessionCookieData = {
            uid,
            email: fields.email?.stringValue || '',
            username: fields.username?.stringValue || '',
            emailVerified: fields.emailVerified?.booleanValue || false,
            isAdmin: fields.isAdmin?.booleanValue || false
          };

          // Create signed session cookie
          const cookieStore = await cookies();
          const signedValue = await createSignedCookieValue(userData);
          cookieStore.set('simpleUserSession', signedValue, DEV_SESSION_COOKIE_OPTIONS);
          
          secureLogger.info('[Auth] Dev auth login successful (registered user)', {
            email: maskEmail(userData.email),
            username: userData.username
          });
          
          return createSuccessResponse({
            uid: userData.uid,
            email: userData.email,
            username: userData.username,
            emailVerified: userData.emailVerified
          });
        }
      }

      return createErrorResponse('Incorrect username/email or password. Please try again.');
    }

    // Production mode: use Firebase Admin Firestore for username lookup
    // Note: We use firebase-admin for Firestore only (NOT Auth) to avoid jose issues
    const isEmail = emailOrUsername.includes('@');
    let email = emailOrUsername;
    let username: string | undefined;

    // If username provided, look up email from usernames collection
    if (!isEmail) {
      console.log('[Auth] Looking up email for username:', emailOrUsername);
      
      const admin = getFirebaseAdmin();
      if (!admin) {
        console.error('[Auth] Firebase Admin not initialized');
        return createErrorResponse('Server configuration error', 500);
      }

      const db = admin.firestore();
      
      // Try direct document lookup first (usernames are stored as doc ID)
      const usernameDocRef = db.collection(getCollectionName('usernames')).doc(emailOrUsername.toLowerCase());
      const usernameDoc = await usernameDocRef.get();

      if (usernameDoc.exists) {
        const data = usernameDoc.data();
        email = data?.email;
        username = data?.username || emailOrUsername;
        console.log('[Auth] Found username doc, resolved email');
      } else {
        // Fallback: query users collection by username field
        console.log('[Auth] Username doc not found, querying users collection');
        const usersQuery = await db.collection(getCollectionName('users'))
          .where('username', '==', emailOrUsername)
          .limit(1)
          .get();

        if (!usersQuery.empty) {
          const userData = usersQuery.docs[0].data();
          email = userData?.email;
          username = userData?.username || emailOrUsername;
          console.log('[Auth] Found user by username query');
        } else {
          // Try case-insensitive search
          const lowerUsername = emailOrUsername.toLowerCase();
          const usersQueryLower = await db.collection(getCollectionName('users'))
            .where('usernameLower', '==', lowerUsername)
            .limit(1)
            .get();

          if (!usersQueryLower.empty) {
            const userData = usersQueryLower.docs[0].data();
            email = userData?.email;
            username = userData?.username || emailOrUsername;
            console.log('[Auth] Found user by lowercase username query');
          } else {
            console.log('[Auth] Username not found in any collection:', emailOrUsername);
            return createErrorResponse('No account found with this username or email');
          }
        }
      }

      if (!email) {
        return createErrorResponse('No account found with this username or email');
      }
    }

    // Note: Actual password verification happens client-side via Firebase Auth
    // This endpoint is mainly for username lookup
    // Return the email so client can use it for Firebase signInWithEmailAndPassword

    return NextResponse.json({
      success: true,
      email,
      username,
      message: 'Use this email with Firebase Auth to complete login'
    });

  } catch (error) {
    console.error('[Auth] Login error:', error);
    return createErrorResponse('Unable to sign in. Please check your credentials and try again.', 500);
  }
}


