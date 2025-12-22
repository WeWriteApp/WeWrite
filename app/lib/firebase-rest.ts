/**
 * Firebase REST API Helpers
 * 
 * Provides Firebase functionality using REST APIs instead of firebase-admin SDK.
 * This avoids the jwks-rsa/jose dependency chain that fails in Vercel serverless.
 * 
 * Use these helpers for all server-side Firebase operations in API routes.
 */

// Firebase project configuration
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82';
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// =============================================================================
// Firebase Auth REST API
// =============================================================================

export interface FirebaseUser {
  localId: string;  // This is the UID
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoUrl?: string;
  disabled?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  passwordHash?: string;
  providerUserInfo?: Array<{
    providerId: string;
    federatedId: string;
    email?: string;
  }>;
}

/**
 * Verify an ID token and return the user info
 */
export async function verifyIdToken(idToken: string): Promise<{ success: boolean; uid?: string; email?: string; emailVerified?: boolean; error?: string }> {
  try {
    if (!FIREBASE_API_KEY) {
      return { success: false, error: 'API key not configured' };
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `Token verification failed: ${response.status}` };
    }

    const data = await response.json();
    if (data.users && data.users.length > 0) {
      const user = data.users[0];
      return {
        success: true,
        uid: user.localId,
        email: user.email,
        emailVerified: user.emailVerified || false,
      };
    }
    return { success: false, error: 'No user found' };
  } catch (error) {
    return { success: false, error: 'Token verification error' };
  }
}

/**
 * Get user by UID using Admin SDK REST API
 * Note: This requires a service account for authentication
 */
export async function getUserById(uid: string): Promise<{ success: boolean; user?: FirebaseUser; error?: string }> {
  try {
    // Use Google's Identity Toolkit with service account
    // For now, we'll use the accounts:lookup with a local ID
    const accessToken = await getServiceAccountToken();
    
    if (!accessToken) {
      return { success: false, error: 'Could not get service account token' };
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts:lookup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ localId: [uid] }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `Failed to get user: ${response.status}` };
    }

    const data = await response.json();
    if (data.users && data.users.length > 0) {
      const user = data.users[0];
      return {
        success: true,
        user: {
          localId: user.localId,
          email: user.email || '',
          emailVerified: user.emailVerified || false,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
          disabled: user.disabled || false,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        },
      };
    }
    return { success: false, error: 'User not found' };
  } catch (error) {
    return { success: false, error: 'Failed to get user' };
  }
}

/**
 * Get user by email using Admin SDK REST API
 */
export async function getUserByEmail(email: string): Promise<{ success: boolean; user?: FirebaseUser; error?: string }> {
  try {
    const accessToken = await getServiceAccountToken();
    
    if (!accessToken) {
      return { success: false, error: 'Could not get service account token' };
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts:lookup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: [email] }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `Failed to get user: ${response.status}` };
    }

    const data = await response.json();
    if (data.users && data.users.length > 0) {
      const user = data.users[0];
      return {
        success: true,
        user: {
          localId: user.localId,
          email: user.email || '',
          emailVerified: user.emailVerified || false,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
          disabled: user.disabled || false,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        },
      };
    }
    return { success: false, error: 'User not found' };
  } catch (error) {
    return { success: false, error: 'Failed to get user' };
  }
}

// Cache for service account token
let serviceAccountTokenCache: { token: string; expires: number } | null = null;

/**
 * Get a service account access token for Admin API calls
 */
async function getServiceAccountToken(): Promise<string | null> {
  try {
    // Check cache
    if (serviceAccountTokenCache && serviceAccountTokenCache.expires > Date.now()) {
      return serviceAccountTokenCache.token;
    }

    // Try to get service account credentials from environment
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      return null;
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountKey);
    } catch {
      return null;
    }

    // Create JWT for Google OAuth
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    // Sign the JWT
    const token = await signJwt(header, payload, serviceAccount.private_key);
    
    if (!token) {
      return null;
    }

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // Cache the token
    serviceAccountTokenCache = {
      token: data.access_token,
      expires: Date.now() + (data.expires_in - 60) * 1000, // Subtract 60s for safety
    };

    return data.access_token;
  } catch (error) {
    return null;
  }
}

/**
 * Sign a JWT using RS256 algorithm
 * Uses Web Crypto API which is available in all modern environments
 */
async function signJwt(header: object, payload: object, privateKeyPem: string): Promise<string | null> {
  try {
    // Base64URL encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Import the private key
    const privateKey = await importPrivateKey(privateKeyPem);
    if (!privateKey) {
      return null;
    }

    // Sign
    const signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      privateKey,
      new TextEncoder().encode(signingInput)
    );

    const encodedSignature = base64UrlEncode(new Uint8Array(signature));
    return `${signingInput}.${encodedSignature}`;
  } catch (error) {
    return null;
  }
}

/**
 * Import a PEM private key for Web Crypto
 */
async function importPrivateKey(pem: string): Promise<CryptoKey | null> {
  try {
    // Remove PEM headers and decode
    const pemContents = pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '');

    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    return await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
  } catch (error) {
    return null;
  }
}

/**
 * Base64URL encode
 */
function base64UrlEncode(input: string | Uint8Array): string {
  let base64: string;
  if (typeof input === 'string') {
    base64 = btoa(input);
  } else {
    base64 = btoa(String.fromCharCode(...input));
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Get user by ID token (returns full user info)
 */
export async function getUserFromToken(idToken: string): Promise<FirebaseUser | null> {
  try {
    if (!FIREBASE_API_KEY) {
      return null;
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.users && data.users.length > 0) {
      return data.users[0];
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Create a new user with email and password
 */
export async function createUser(
  email: string,
  password: string
): Promise<{ uid: string; idToken: string; refreshToken: string } | { error: string }> {
  try {
    if (!FIREBASE_API_KEY) {
      return { error: 'Firebase API key not configured' };
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorCode = data.error?.message || 'UNKNOWN_ERROR';
      return { error: errorCode };
    }

    return {
      uid: data.localId,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
    };
  } catch (error: any) {
    return { error: error?.message || 'Failed to create user' };
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<{ uid: string; idToken: string; refreshToken: string; emailVerified: boolean } | { error: string }> {
  try {
    if (!FIREBASE_API_KEY) {
      return { error: 'Firebase API key not configured' };
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorCode = data.error?.message || 'UNKNOWN_ERROR';
      return { error: errorCode };
    }

    return {
      uid: data.localId,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      emailVerified: data.emailVerified || false,
    };
  } catch (error: any) {
    return { error: error?.message || 'Failed to sign in' };
  }
}

/**
 * Delete a user account
 */
export async function deleteUser(idToken: string): Promise<boolean> {
  try {
    if (!FIREBASE_API_KEY) {
      return false;
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Delete a user account by UID using Admin API (service account auth)
 * This is the admin-level deletion that works even when jose fails
 */
export async function deleteUserByUid(uid: string): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getServiceAccountToken();
    
    if (!accessToken) {
      return { success: false, error: 'Could not get service account token' };
    }

    // Use Identity Toolkit Admin API to delete user
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts:delete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ localId: uid }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Failed to delete user: ${response.status} - ${errorText}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to delete user' };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!FIREBASE_API_KEY) {
      return { success: false, error: 'Firebase API key not configured' };
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Unknown error' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to send reset email' };
  }
}

/**
 * Send email verification
 */
export async function sendEmailVerification(idToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!FIREBASE_API_KEY) {
      return { success: false, error: 'Firebase API key not configured' };
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'VERIFY_EMAIL',
          idToken,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Unknown error' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to send verification email' };
  }
}

// =============================================================================
// Firestore REST API
// =============================================================================

/**
 * Convert a JavaScript value to Firestore REST API format
 */
export function toFirestoreValue(value: any): any {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: value.toString() };
    }
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (typeof value === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

/**
 * Convert Firestore REST API format to JavaScript value
 */
export function fromFirestoreValue(value: any): any {
  if (!value) return null;
  
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in value) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      result[k] = fromFirestoreValue(v);
    }
    return result;
  }
  return null;
}

/**
 * Convert a Firestore document to a plain object
 */
export function fromFirestoreDoc(doc: any): Record<string, any> | null {
  if (!doc || !doc.fields) return null;
  
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(doc.fields)) {
    result[key] = fromFirestoreValue(value);
  }
  return result;
}

/**
 * Get a Firestore document by path
 */
export async function getFirestoreDoc(
  collection: string,
  docId: string,
  idToken?: string
): Promise<Record<string, any> | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    
    const headers: Record<string, string> = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      return null;
    }

    const doc = await response.json();
    return fromFirestoreDoc(doc);
  } catch (error) {
    return null;
  }
}

/**
 * Create or update a Firestore document
 */
export async function setFirestoreDoc(
  collection: string,
  docId: string,
  data: Record<string, any>,
  idToken: string,
  merge: boolean = false
): Promise<boolean> {
  try {
    const fields: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = toFirestoreValue(value);
    }

    let url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${docId}`;
    
    if (merge) {
      // For merge, use PATCH with updateMask
      url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
      const updateMask = Object.keys(data).map(f => `updateMask.fieldPaths=${f}`).join('&');
      url += `?${updateMask}`;
    }

    const response = await fetch(url, {
      method: merge ? 'PATCH' : 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a document exists
 */
export async function firestoreDocExists(
  collection: string,
  docId: string,
  idToken?: string
): Promise<boolean> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    
    const headers: Record<string, string> = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch(url, { method: 'GET', headers });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Query Firestore documents
 */
export async function queryFirestore(
  collection: string,
  field: string,
  op: 'EQUAL' | 'NOT_EQUAL' | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL',
  value: any,
  idToken?: string,
  limit?: number
): Promise<Array<{ id: string; data: Record<string, any> }>> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const query: any = {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op,
            value: toFirestoreValue(value),
          },
        },
      },
    };

    if (limit) {
      query.structuredQuery.limit = limit;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      return [];
    }

    const results = await response.json();

    return results
      .filter((r: any) => r.document)
      .map((r: any) => {
        const docPath = r.document.name.split('/');
        const docId = docPath[docPath.length - 1];
        return {
          id: docId,
          data: fromFirestoreDoc(r.document),
        };
      });
  } catch (error) {
    return [];
  }
}

// =============================================================================
// Error Code Mapping
// =============================================================================

/**
 * Map Firebase REST API error codes to user-friendly messages
 */
export function getFirebaseErrorMessage(errorCode: string): string {
  const errorMap: Record<string, string> = {
    'EMAIL_EXISTS': 'An account with this email already exists',
    'EMAIL_NOT_FOUND': 'No account found with this email address',
    'INVALID_PASSWORD': 'Incorrect password',
    'INVALID_EMAIL': 'Invalid email address',
    'WEAK_PASSWORD': 'Password is too weak. Please use at least 6 characters.',
    'USER_DISABLED': 'This account has been disabled',
    'OPERATION_NOT_ALLOWED': 'This operation is not allowed',
    'TOO_MANY_ATTEMPTS_TRY_LATER': 'Too many attempts. Please try again later.',
    'EXPIRED_OOB_CODE': 'This link has expired. Please request a new one.',
    'INVALID_OOB_CODE': 'This link is invalid or has already been used.',
    'INVALID_ID_TOKEN': 'Your session has expired. Please sign in again.',
    'USER_NOT_FOUND': 'No account found with these credentials',
    'CREDENTIAL_TOO_OLD_LOGIN_AGAIN': 'Please sign in again to complete this action',
  };

  // Check for partial matches (for error codes with additional info)
  for (const [key, message] of Object.entries(errorMap)) {
    if (errorCode.includes(key)) {
      return message;
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

// =============================================================================
// Firestore Document Helpers (with service account auth)
// =============================================================================

/**
 * Get a Firestore document (using service account for server-side access)
 */
export async function getFirestoreDocument(
  collection: string,
  docId: string
): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
  try {
    const accessToken = await getServiceAccountToken();
    
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Document not found' };
      }
      return { success: false, error: `Failed to get document: ${response.status}` };
    }

    const doc = await response.json();
    return { success: true, data: fromFirestoreDoc(doc) || {} };
  } catch (error) {
    return { success: false, error: 'Failed to get document' };
  }
}

/**
 * Set a Firestore document (using service account for server-side access)
 */
export async function setFirestoreDocument(
  collection: string,
  docId: string,
  data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getServiceAccountToken();
    
    if (!accessToken) {
      return { success: false, error: 'Could not get service account token' };
    }

    const fields: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = toFirestoreValue(value);
    }

    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${docId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      return { success: false, error: `Failed to set document: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to set document' };
  }
}

/**
 * Update a Firestore document (using service account for server-side access)
 */
export async function updateFirestoreDocument(
  collection: string,
  docId: string,
  data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getServiceAccountToken();
    
    if (!accessToken) {
      return { success: false, error: 'Could not get service account token' };
    }

    const fields: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = toFirestoreValue(value);
    }

    const updateMask = Object.keys(data).map(f => `updateMask.fieldPaths=${f}`).join('&');
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?${updateMask}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      return { success: false, error: `Failed to update document: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to update document' };
  }
}

/**
 * Query Firestore with server-side auth
 */
export async function queryFirestoreDocuments(
  collection: string,
  field: string,
  op: 'EQUAL' | 'NOT_EQUAL' | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL',
  value: any,
  limit?: number
): Promise<{ success: boolean; documents?: Array<{ id: string; data: Record<string, any> }>; error?: string }> {
  try {
    const accessToken = await getServiceAccountToken();
    
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const query: any = {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op,
            value: toFirestoreValue(value),
          },
        },
      },
    };

    if (limit) {
      query.structuredQuery.limit = limit;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      return { success: false, error: `Query failed: ${response.status}` };
    }

    const results = await response.json();

    const documents = results
      .filter((r: any) => r.document)
      .map((r: any) => {
        const docPath = r.document.name.split('/');
        const docId = docPath[docPath.length - 1];
        return {
          id: docId,
          data: fromFirestoreDoc(r.document) || {},
        };
      });

    return { success: true, documents };
  } catch (error) {
    return { success: false, error: 'Query failed' };
  }
}

// =============================================================================
// Realtime Database REST API
// =============================================================================

const RTDB_URL = `https://${FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`;

/**
 * Get data from Realtime Database
 */
export async function getRtdbData(
  path: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const accessToken = await getServiceAccountToken();
    
    if (!accessToken) {
      return { success: false, error: 'Could not get service account token' };
    }

    const response = await fetch(`${RTDB_URL}/${path}.json?access_token=${accessToken}`);

    if (!response.ok) {
      return { success: false, error: `Failed to get data: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Failed to get data' };
  }
}

/**
 * Set data in Realtime Database
 */
export async function setRtdbData(
  path: string,
  data: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getServiceAccountToken();
    
    if (!accessToken) {
      return { success: false, error: 'Could not get service account token' };
    }

    const response = await fetch(`${RTDB_URL}/${path}.json?access_token=${accessToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      return { success: false, error: `Failed to set data: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to set data' };
  }
}

/**
 * Update data in Realtime Database (partial update)
 */
export async function updateRtdbData(
  path: string,
  data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getServiceAccountToken();
    
    if (!accessToken) {
      return { success: false, error: 'Could not get service account token' };
    }

    const response = await fetch(`${RTDB_URL}/${path}.json?access_token=${accessToken}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      return { success: false, error: `Failed to update data: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to update data' };
  }
}
