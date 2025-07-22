# Authentication Architecture

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

```typescript
const testAccounts = [
  { email: 'jamie@wewrite.app', password: 'TestPassword123!', isAdmin: true },
  { email: 'test@wewrite.app', password: 'TestPassword123!', isAdmin: false },
  { email: 'getwewrite@gmail.com', password: 'TestPassword123!', isAdmin: false },
  { email: 'test@local.dev', password: 'TestPassword123!', isAdmin: false }
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
- **Login**: `app/api/auth/login/route.ts`
- **Session**: `app/api/auth/session/route.ts`
- **Client**: `app/providers/AuthProvider.tsx`

### Environment Detection
- **Server**: `app/utils/environmentConfig.ts`
- **Debug**: `app/api/debug/auth-environment/route.ts`

## Summary

**Remember: Preview environments are for testing with production data using real credentials, NOT for using test accounts with production data.**

- **Local**: Dev auth + dev data + test credentials
- **Preview**: Firebase auth + production data + real credentials  
- **Production**: Firebase auth + production data + real credentials
