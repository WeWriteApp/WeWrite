# Authentication Architecture

**Last Updated**: December 4, 2025  
**Status**: ACTIVE

> ⚠️ **IMPORTANT**: This document covers environment-specific auth rules. For the **Firebase REST API architecture** that handles token verification in production (solving the jose dependency issue), see [Firebase REST API Architecture](./FIREBASE_REST_API_ARCHITECTURE.md).

## 🚨 CRITICAL: Environment-Specific Authentication Rules

**This document defines the EXACT authentication behavior for each environment. Never deviate from these rules.**

## Authentication by Environment

### 🏠 **Local Development**
- **Auth System**: Dev Auth (test accounts)
- **Data Access**: DEV_ prefixed collections (isolated dev data)
- **Credentials**: Test accounts only (jamie@wewrite.app, test@wewrite.app, etc.)
- **Trigger**: `NODE_ENV=development` AND `USE_DEV_AUTH=true`

### 🔍 **Vercel Preview**
- **Auth System**: Firebase Auth (production auth)
- **Data Access**: Production collections (no DEV_ prefix)
- **Credentials**: Real Firebase Auth accounts (jamiegray2234@gmail.com, etc.)
- **Purpose**: Test with production data using real credentials

### 🚀 **Vercel Production**
- **Auth System**: Firebase Auth (production auth)
- **Data Access**: Production collections (no DEV_ prefix)
- **Credentials**: Real Firebase Auth accounts (jamiegray2234@gmail.com, etc.)
- **Purpose**: Live production environment

## Environment Detection Logic

### Server-Side (API Routes)
```typescript
// ONLY use dev auth for local development
const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';

if (useDevAuth) {
  // Use test accounts and dev auth system
} else {
  // Use Firebase Auth with real credentials
}
```

### Client-Side (AuthProvider)
```typescript
// ONLY use dev auth for local development
const useDevAuth = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_DEV_AUTH === 'true';

if (useDevAuth) {
  // Call /api/auth/login with test credentials
} else {
  // Use Firebase Auth SDK with real credentials
}
```

## Data Access Patterns

### Local Development
- Collections: `DEV_users`, `DEV_pages`, `DEV_subscriptions`
- Purpose: Isolated development data
- Safety: Cannot affect production data

### Preview & Production
- Collections: `users`, `pages`, `subscriptions` (base names)
- Purpose: Real production data
- Safety: Use real credentials, real data

## Test Credentials (Local Development Only)

All test accounts are defined in `/app/utils/testUsers.ts` as the single source of truth:

```typescript
// From DEV_TEST_USERS in /app/utils/testUsers.ts
const testAccounts = [
  { email: 'jamie@wewrite.app', username: 'jamie', password: 'TestPassword123!', isAdmin: true },
  { email: 'test@wewrite.app', username: 'testuser', password: 'TestPassword123!', isAdmin: false },
  { email: 'getwewrite@gmail.com', username: 'getwewrite', password: 'TestPassword123!', isAdmin: false }
];
```

**⚠️ These test credentials ONLY work in local development with dev auth enabled.**

## Production Credentials (Preview & Production)

Use real Firebase Auth accounts:
- `jamiegray2234@gmail.com` (admin account)
- Any other real Firebase Auth user accounts

## Common Mistakes to Avoid

### ❌ **WRONG: Using dev auth in preview**
```typescript
// DON'T DO THIS
const isPreviewEnv = environmentType === 'preview';
const useDevAuth = isLocalDev || isPreviewEnv; // WRONG!
```

### ✅ **CORRECT: Only dev auth in local development**
```typescript
// DO THIS
const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
```

### ❌ **WRONG: Expecting test credentials in preview**
Preview environments should NOT accept `jamie@wewrite.app` or other test credentials.

### ✅ **CORRECT: Use real credentials in preview**
Preview environments should accept `jamiegray2234@gmail.com` and other real Firebase Auth accounts.

## Debugging Authentication Issues

### Check Environment Detection
Visit: `/api/debug/auth-environment`

Expected responses:

**Local Development:**
```json
{
  "environment": { "type": "development" },
  "authConfiguration": { "useDevAuth": true, "authSystem": "dev-auth" },
  "testCredentials": { "available": ["jamie@wewrite.app / TestPassword123!"] }
}
```

**Preview/Production:**
```json
{
  "environment": { "type": "preview" },
  "authConfiguration": { "useDevAuth": false, "authSystem": "firebase-auth" },
  "testCredentials": { "note": "Using Firebase Auth - use your production credentials" }
}
```

## Environment Variables

### Local Development
```bash
NODE_ENV=development
USE_DEV_AUTH=true
NEXT_PUBLIC_USE_DEV_AUTH=true
```

### Preview/Production
```bash
NODE_ENV=production
# USE_DEV_AUTH should be undefined or false
# NEXT_PUBLIC_USE_DEV_AUTH should be undefined or false
```

## File Locations

### Authentication Logic
- **Login**: `app/api/auth/login/route.ts` - Username lookup (uses Firebase Admin Firestore)
- **Session**: `app/api/auth/session/route.ts` - Session creation/validation (uses REST API for token verification)
- **Register**: `app/api/auth/register-user/route.ts` - User registration completion
- **Client**: `app/providers/AuthProvider.tsx` - Client-side auth state

### Firebase REST API
- **REST Helpers**: `app/lib/firebase-rest.ts` - All REST API functions
- **Firebase Admin**: `app/firebase/firebaseAdmin.ts` - Admin SDK for Firestore

### Environment Detection
- **Server**: `app/utils/environmentConfig.ts`
- **Debug**: `app/api/debug/auth-environment/route.ts`

## Production Auth Architecture (December 2025)

In production (Vercel serverless), we use a **hybrid approach**:

### Why Hybrid?
Firebase Admin SDK's Auth module causes `Cannot find package 'jose'` errors in Vercel serverless due to:
- `firebase-admin` → `jwks-rsa` → `jose` dependency chain

### Solution
- **Auth token verification** → Firebase REST API (`identitytoolkit.googleapis.com`)
- **Firestore/RTDB operations** → Firebase Admin SDK (works fine - jose issue only affects Auth)

### Code Pattern
```typescript
// ✅ Auth verification - use REST API
import { verifyIdToken } from '../../../lib/firebase-rest';
const result = await verifyIdToken(idToken);

// ✅ Firestore operations - use Firebase Admin (works fine)
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
const admin = getFirebaseAdmin();
const userDoc = await admin.firestore().collection('users').doc(uid).get();
```

See [Firebase REST API Architecture](./FIREBASE_REST_API_ARCHITECTURE.md) for full details.

## Development Guide

### Firebase Auth Features
- **Provider**: Firebase Authentication
- **Features**: Email/password, user registration, password reset
- **Session Management**: Firebase Auth tokens with session cookies
- **Environment**: Uses standard Firebase project configuration

### Recent Simplifications
- **Payment Feature Flags Removed** (2025-01-24): All payment functionality is now always available to authenticated users
- **Authentication Simplified**: Removed complex auth patterns in favor of simple Firebase Auth
- **Dev Auth Wrapper Removed**: Now uses standard Firebase Auth for better maintainability

### Authentication Flow
1. **User Registration**: Email/password via Firebase Auth
2. **Login**: Email/password authentication
3. **Session**: Managed via Firebase Auth tokens
4. **Logout**: Clear Firebase session and redirect

### Best Practices
- Use `useAuth()` hook from `AuthProvider` for authentication state
- Always check `isAuthenticated` before accessing protected features
- Handle loading states with `isLoading` from auth context
- Use environment-appropriate collections after authentication

## Summary

**Remember: Preview environments are for testing with production data using real credentials, NOT for using test accounts with production data.**

- **Local**: Dev auth + dev data + test credentials
- **Preview**: Firebase auth + production data + real credentials
- **Production**: Firebase auth + production data + real credentials

## Related Documentation

- [Firebase REST API Architecture](./FIREBASE_REST_API_ARCHITECTURE.md) - **START HERE** for production auth implementation
- [Session Management Architecture](./SESSION_MANAGEMENT_ARCHITECTURE.md) - Session handling details
- [LOGGED_OUT_USER_PRODUCTION_DATA.md](./LANDING_PAGE_PRODUCTION_DATA.md) - Production data for logged-out users
- [ENVIRONMENT_QUICK_REFERENCE.md](./ENVIRONMENT_QUICK_REFERENCE.md) - Environment behavior matrix
