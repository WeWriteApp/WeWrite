# Firebase REST API Architecture

**Last Updated**: December 4, 2025  
**Status**: ACTIVE - Current Production Architecture

## Overview

WeWrite uses a hybrid approach to Firebase services to work around dependency issues in Vercel serverless environments:

- **Firebase REST API** - For Authentication token verification
- **Firebase Admin SDK** - For Firestore and Realtime Database operations

This architecture was implemented to resolve the `Cannot find package 'jose'` error that occurs when firebase-admin's Auth module (which uses jwks-rsa → jose) runs in Vercel's serverless environment.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                          │
├─────────────────────────────────────────────────────────────────┤
│  Firebase Client SDK                                             │
│  - createUserWithEmailAndPassword()                              │
│  - signInWithEmailAndPassword()                                  │
│  - sendEmailVerification()                                       │
│  - getIdToken()                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Routes (Server)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │   Firebase REST API     │  │   Firebase Admin SDK        │   │
│  │   (Auth Operations)     │  │   (Database Operations)     │   │
│  ├─────────────────────────┤  ├─────────────────────────────┤   │
│  │ • verifyIdToken()       │  │ • Firestore reads/writes    │   │
│  │ • getUserByEmail()      │  │ • Realtime DB reads/writes  │   │
│  │ • getUserById()         │  │ • Collection queries        │   │
│  │ • createUser()          │  │                             │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
│                                                                  │
│  Uses: identitytoolkit.googleapis.com    Uses: firebase-admin    │
│        (No jose dependency)              (Firestore works fine)  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files

### `/app/lib/firebase-rest.ts`

Centralized Firebase REST API helper library. Provides:

#### Authentication Functions
```typescript
// Verify ID token and get user info
verifyIdToken(idToken: string): Promise<{
  success: boolean;
  uid?: string;
  email?: string;
  emailVerified?: boolean;
  error?: string;
}>

// Get user by UID (requires service account)
getUserById(uid: string): Promise<{
  success: boolean;
  user?: FirebaseUser;
  error?: string;
}>

// Get user by email (requires service account)
getUserByEmail(email: string): Promise<{
  success: boolean;
  user?: FirebaseUser;
  error?: string;
}>

// Create a new user
createUser(email: string, password: string, displayName?: string): Promise<{
  success: boolean;
  uid?: string;
  idToken?: string;
  error?: string;
}>

// Sign in with email/password
signInWithEmailPassword(email: string, password: string): Promise<{
  success: boolean;
  uid?: string;
  idToken?: string;
  error?: string;
}>
```

#### Firestore Functions (Service Account Auth)
```typescript
// Get document
getFirestoreDocument(collection: string, docId: string): Promise<{
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}>

// Set document
setFirestoreDocument(collection: string, docId: string, data: Record<string, any>): Promise<{
  success: boolean;
  error?: string;
}>

// Update document
updateFirestoreDocument(collection: string, docId: string, data: Record<string, any>): Promise<{
  success: boolean;
  error?: string;
}>

// Query documents
queryFirestoreDocuments(
  collection: string,
  field: string,
  op: 'EQUAL' | 'NOT_EQUAL' | ...,
  value: any,
  limit?: number
): Promise<{
  success: boolean;
  documents?: Array<{ id: string; data: Record<string, any> }>;
  error?: string;
}>
```

#### Realtime Database Functions
```typescript
// Get data
getRtdbData(path: string): Promise<{ success: boolean; data?: any; error?: string }>

// Set data
setRtdbData(path: string, data: any): Promise<{ success: boolean; error?: string }>

// Update data
updateRtdbData(path: string, data: Record<string, any>): Promise<{ success: boolean; error?: string }>
```

## Auth Route Architecture

### `/api/auth/login`
- **Purpose**: Username lookup and dev auth login
- **Uses**: Firebase Admin Firestore for username→email lookup
- **NOT used for**: Password verification (handled client-side)

### `/api/auth/session`
- **GET**: Read session from cookie, enrich from Firestore
- **POST**: Verify ID token (REST API), create session cookie, store in Firestore
- **Uses**: 
  - REST API for `verifyIdToken()` (avoids jose)
  - Firebase Admin for Firestore operations

### `/api/auth/register`
- **Purpose**: Legacy registration endpoint
- **Uses**: Firebase REST API for user creation

### `/api/auth/register-user`
- **Purpose**: New registration completion endpoint
- **Uses**: REST API for token verification, Firestore for user document creation

### `/api/auth/validate-session`
- **Purpose**: Check if session cookie is valid
- **Uses**: Cookie parsing only (trusts server-created cookies)

### `/api/auth/verify-email`
- **Purpose**: Email verification status
- **Uses**: REST API for token verification

### `/api/auth/username`
- **Purpose**: Username availability check and updates
- **Uses**: Firebase Admin Firestore for queries

## Why This Architecture?

### The Problem

Firebase Admin SDK's Auth module imports `jwks-rsa` which imports `jose`. In Vercel's serverless environment, this dependency chain fails with:

```
Error: Cannot find package 'jose' imported from 
/var/task/node_modules/.bun/jwks-rsa@...
```

### The Solution

1. **Auth operations** → Use Firebase REST API (`identitytoolkit.googleapis.com`)
2. **Firestore/RTDB operations** → Use Firebase Admin SDK (works fine)

This hybrid approach gives us:
- ✅ Full auth functionality without jose dependency
- ✅ Full Firestore/RTDB functionality with Admin SDK
- ✅ Works in Vercel serverless environment
- ✅ Works in local development

## Environment Variables

### Required for REST API
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...     # Firebase Web API key
NEXT_PUBLIC_FIREBASE_PID=...         # Firebase Project ID
```

### Required for Admin SDK (Firestore)
```bash
GOOGLE_CLOUD_KEY_JSON=...            # Base64 encoded service account JSON
```

### Optional (for advanced REST operations)
```bash
FIREBASE_SERVICE_ACCOUNT_KEY=...     # JSON service account for REST API auth
```

## Usage Examples

### Verifying a Token (Server-side)
```typescript
import { verifyIdToken } from '../../../lib/firebase-rest';

export async function POST(request: NextRequest) {
  const { idToken } = await request.json();
  
  const result = await verifyIdToken(idToken);
  
  if (!result.success || !result.uid) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  
  // Token is valid, result.uid contains the user ID
}
```

### Looking Up Username (Server-side)
```typescript
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

const admin = getFirebaseAdmin();
const db = admin.firestore();

// Direct document lookup
const usernameDoc = await db
  .collection(getCollectionName('usernames'))
  .doc(username.toLowerCase())
  .get();

if (usernameDoc.exists) {
  const email = usernameDoc.data()?.email;
}
```

### Creating Session (Server-side)
```typescript
import { verifyIdToken } from '../../../lib/firebase-rest';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

// 1. Verify token with REST API
const verifyResult = await verifyIdToken(idToken);
if (!verifyResult.success) {
  return error;
}

// 2. Get user data with Admin Firestore
const admin = getFirebaseAdmin();
const db = admin.firestore();
const userDoc = await db.collection('users').doc(verifyResult.uid).get();

// 3. Create session cookie
const sessionData = {
  uid: verifyResult.uid,
  email: verifyResult.email,
  username: userDoc.data()?.username
};
cookies().set('simpleUserSession', JSON.stringify(sessionData), ...);
```

## Migration Notes

### From Pure firebase-admin
If you're migrating from pure firebase-admin auth:

```typescript
// ❌ OLD (causes jose error in Vercel)
import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
const admin = getFirebaseAdmin();
const decodedToken = await admin.auth().verifyIdToken(idToken);

// ✅ NEW (works in Vercel)
import { verifyIdToken } from '../lib/firebase-rest';
const result = await verifyIdToken(idToken);
if (result.success) {
  const uid = result.uid;
}
```

### Keep Using Admin SDK For
- Firestore read/write operations
- Realtime Database operations
- Any non-Auth admin operations

## Troubleshooting

### "Cannot find package 'jose'" Error
This means firebase-admin's Auth is being imported. Check:
1. Are you using `admin.auth().verifyIdToken()`? → Use `verifyIdToken()` from firebase-rest
2. Are you using `admin.auth().getUser()`? → Use `getUserById()` from firebase-rest
3. Are you importing from `firebase/firebaseAdmin` and calling `.auth()`?

### "Token verification failed" Error
Check:
1. Is `NEXT_PUBLIC_FIREBASE_API_KEY` set correctly?
2. Is `NEXT_PUBLIC_FIREBASE_PID` set correctly?
3. Is the ID token valid and not expired?

### "User not found" on Username Login
Check:
1. Is `GOOGLE_CLOUD_KEY_JSON` set for Firebase Admin?
2. Does the username exist in the `usernames` collection?
3. Try querying the `users` collection by username field

## Related Documentation

- [Authentication Architecture](./AUTHENTICATION_ARCHITECTURE.md) - Environment-specific auth rules
- [Session Management Architecture](./SESSION_MANAGEMENT_ARCHITECTURE.md) - Session handling
- [Environment Quick Reference](./ENVIRONMENT_QUICK_REFERENCE.md) - Environment configuration
