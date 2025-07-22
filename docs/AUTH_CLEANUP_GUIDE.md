# Authentication System Cleanup Guide

**⚠️ CRITICAL REFERENCE DOCUMENT ⚠️**

This guide helps identify and clean up old authentication systems in favor of the new simplified auth system.

## Current Simplified Auth System (KEEP THESE)

### ✅ Core Components to Keep
- `app/providers/AuthProvider.tsx` - Main auth provider
- `app/hooks/useAuth.ts` - Auth hook (if exists)
- `app/api/auth/session/route.ts` - Session management
- `app/api/create-user-cookie/route.ts` - Cookie creation
- `middleware.ts` - Route protection

### ✅ Correct Usage Patterns
```typescript
// ✅ CORRECT: Use simplified auth
import { useAuth } from '../providers/AuthProvider';

const { user, isAuthenticated, isEmailVerified, isLoading } = useAuth();

// ✅ CORRECT: Check auth state
if (!isAuthenticated) {
  // Handle unauthenticated state
}

// ✅ CORRECT: Use user data
const userId = user?.uid;
const userEmail = user?.email;
```

## Old Systems to Remove (DELETE THESE)

### ❌ Multi-Auth System (DELETE)
- `MultiAuthProvider` - Complex multi-account system
- `CurrentAccountProvider` - Account switching
- `SessionStore` - Complex session management
- `useCurrentAccount()` - Multi-account hook
- `useSession()` - Complex session hook

### ❌ Development Auth Wrapper (DELETE)
- `DevelopmentAuthProvider` - Development-only auth wrapper
- `useDevelopmentAuth()` - Development auth hook
- Test user management systems
- Mock authentication systems

### ❌ Legacy Session Systems (DELETE)
- `SessionProvider` - Old session provider
- `useSessionStore()` - Session store hook
- Complex session management utilities
- Account switching utilities

## Identification Patterns

### 🔍 How to Find Old Auth Code

#### 1. Search for Old Imports
```bash
# Find old auth imports
grep -r "useCurrentAccount\|useSession\|MultiAuth\|DevelopmentAuth" app/
grep -r "from.*CurrentAccount\|from.*MultiAuth" app/
grep -r "SessionStore\|SessionProvider" app/
```

#### 2. Search for Old Patterns
```bash
# Find old auth patterns
grep -r "session\?\." app/ | grep -v "useAuth"
grep -r "currentAccount\|switchAccount" app/
grep -r "accounts\[\]" app/
```

#### 3. Search for Complex Auth Logic
```bash
# Find complex auth logic
grep -r "accountId\|accountUid" app/
grep -r "selectedAccount\|activeAccount" app/
grep -r "authState\." app/
```

#### 4. Search for Firebase Auth Issues
```bash
# Find endpoints that might break with development users
grep -r "admin\.auth()\.getUser" app/api/
grep -r "getUser(.*userId" app/api/
grep -r "verifyIdToken\|verifySessionCookie" app/api/
```

### 🔍 How to Find Old Session Code

#### 1. Search for Session Patterns
```bash
# Find old session patterns
grep -r "sessionData\|sessionState" app/
grep -r "getSession\|setSession" app/
grep -r "sessionToken\|sessionId" app/
```

#### 2. Search for Cookie Management
```bash
# Find complex cookie management
grep -r "document.cookie" app/
grep -r "setCookie\|getCookie" app/
grep -r "cookieStore" app/
```

## Migration Patterns

### 🔄 Replace Old Auth Hooks

#### Before (OLD - DELETE):
```typescript
// ❌ OLD: Multi-auth system
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
const { currentAccount, switchAccount } = useCurrentAccount();

// ❌ OLD: Complex session
import { useSession } from '../providers/SessionProvider';
const { session, sessionData } = useSession();

// ❌ OLD: Development auth
import { useDevelopmentAuth } from '../providers/DevelopmentAuthProvider';
const { testUser, switchTestUser } = useDevelopmentAuth();
```

#### After (NEW - KEEP):
```typescript
// ✅ NEW: Simplified auth
import { useAuth } from '../providers/AuthProvider';
const { user, isAuthenticated, isLoading } = useAuth();
const isEmailVerified = user?.emailVerified ?? false;
```

### 🔄 Replace Auth State Checks

#### Before (OLD - DELETE):
```typescript
// ❌ OLD: Complex auth checks
if (currentAccount?.uid && session?.isValid) {
  // Do something
}

// ❌ OLD: Account switching
if (accounts.length > 1) {
  // Show account switcher
}
```

#### After (NEW - KEEP):
```typescript
// ✅ NEW: Simple auth checks
if (isAuthenticated && user?.uid) {
  // Do something
}

// ✅ NEW: Email verification check
if (isAuthenticated && user?.emailVerified) {
  // User is verified
}

// ✅ NEW: No account switching needed
// Single user authentication only
```

### 🔄 Replace User Data Access

#### Before (OLD - DELETE):
```typescript
// ❌ OLD: Complex user data
const userId = currentAccount?.uid || session?.userId;
const userEmail = sessionData?.email || currentAccount?.email;
```

#### After (NEW - KEEP):
```typescript
// ✅ NEW: Simple user data
const userId = user?.uid;
const userEmail = user?.email;
```

## Cleanup Checklist

### Phase 1: Identify Old Code
- [ ] Search for old auth imports
- [ ] Search for old session patterns
- [ ] Search for complex auth logic
- [ ] Search for account switching code
- [ ] Search for development auth wrappers

### Phase 2: Replace with New System
- [ ] Replace `useCurrentAccount()` with `useAuth()`
- [ ] Replace `useSession()` with `useAuth()`
- [ ] Replace complex auth checks with simple ones
- [ ] Replace account switching with single user
- [ ] Update user data access patterns

### Phase 3: Delete Old Files
- [ ] Delete old provider files
- [ ] Delete old hook files
- [ ] Delete old utility files
- [ ] Delete old test files
- [ ] Delete old documentation

### Phase 4: Update Documentation
- [ ] Update component documentation
- [ ] Update API documentation
- [ ] Update development guides
- [ ] Update deployment guides

## Common Gotchas

### 🚨 Watch Out For These Issues

1. **Session vs User Confusion**
   - Old: `session?.uid`
   - New: `user?.uid`

2. **Loading State Handling**
   - Old: Multiple loading states
   - New: Single `isLoading` state

3. **Email Verification Access**
   - ❌ Wrong: `const { isEmailVerified } = useAuth()`
   - ✅ Correct: `const isEmailVerified = user?.emailVerified ?? false`

4. **Auth Context Properties**
   - Available: `user`, `isAuthenticated`, `isLoading`, `error`
   - Not available: `isEmailVerified` (use `user.emailVerified` instead)

5. **Middleware Compatibility**
   - Old: Complex session cookies
   - New: Simple `simpleUserSession` cookie

6. **Development vs Production**
   - Development: Uses `USE_DEV_AUTH=true` with test accounts
   - Production: Uses Firebase Auth with real accounts

7. **Firebase Auth vs Development Users**
   - ❌ Problem: API endpoints calling `admin.auth().getUser()` for development users
   - ✅ Solution: Check development mode and handle dev users separately
   ```typescript
   // ❌ WRONG: Always tries Firebase Auth
   const userRecord = await admin.auth().getUser(userId);

   // ✅ CORRECT: Handle development vs production
   const isDevelopment = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
   let username = 'Anonymous';

   if (isDevelopment) {
     // Handle development users (they don't exist in Firebase Auth)
     username = userId === 'dev_test_user_1' ? 'testuser' : 'dev_user';
   } else {
     // Production: use Firebase Auth
     const userRecord = await admin.auth().getUser(userId);
     username = userRecord.email?.split('@')[0] || 'Anonymous';
   }
   ```

## Testing After Cleanup

### ✅ Verify These Work
- [ ] Login/logout flow
- [ ] Page creation (`/new`)
- [ ] Protected routes
- [ ] User profiles
- [ ] API authentication
- [ ] Middleware protection

### ✅ Verify These Are Gone
- [ ] No account switching UI
- [ ] No complex session management
- [ ] No development auth wrappers
- [ ] No multi-auth providers
- [ ] No old session stores

## Emergency Rollback

If cleanup breaks something:

1. **Identify the broken component**
2. **Check what old auth pattern it was using**
3. **Temporarily restore the old pattern**
4. **Plan proper migration for that component**
5. **Test thoroughly before re-attempting cleanup**

---

**Last Updated**: 2025-01-22
**Status**: ACTIVE - Use this guide for ongoing auth cleanup
