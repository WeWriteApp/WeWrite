# WeWrite Authentication Architecture

**Last Updated**: December 4, 2025  
**Status**: ACTIVE

> ⚠️ **IMPORTANT**: For the Firebase REST API implementation that handles token verification in production (solving the jose dependency issue), see [Firebase REST API Architecture](./FIREBASE_REST_API_ARCHITECTURE.md).

**⚠️ SOURCE OF TRUTH DOCUMENT ⚠️**

This document describes the **ONLY** authentication system that should be used in WeWrite. The complex multi-auth system has been replaced with a clean, reliable Firebase Auth implementation.

## Overview

WeWrite uses a **clean authentication architecture** that provides:

1. **AuthProvider** - Single authentication provider using Firebase Auth
2. **Firebase Auth** - Standard Firebase authentication
3. **Session Cookies** - Session management for middleware compatibility

This architecture provides:
- Clean, reliable authentication
- Standard Firebase Auth features
- Easy maintenance and debugging
- Single source of truth for authentication state
- Better performance and reliability

## Architecture Components

### 1. AuthProvider (`app/providers/AuthProvider.tsx`)

**Purpose**: Manages user authentication using standard Firebase Auth.

**Key Features**:
- Single user authentication
- Firebase Auth integration
- Session state management
- Automatic token refresh

**Exports**:
```typescript
export const useAuth = (): AuthContextValue
```

**Context Value**:
```typescript
interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
}
```

**Usage Examples**:
```typescript
// Basic auth check
const { user, isAuthenticated, isLoading } = useAuth();

// Email verification check
const isEmailVerified = user?.emailVerified ?? false;

// User data access
const userId = user?.uid;
const userEmail = user?.email;
```

### 2. Firebase Auth Integration

**Purpose**: Standard Firebase Authentication integration.

**Key Features**:
- Email/password authentication
- User registration and login
- Password reset functionality
- Automatic session management

**Firebase Auth Methods**:
```typescript
// Registration
createUserWithEmailAndPassword(auth, email, password)

// Login
signInWithEmailAndPassword(auth, email, password)

// Logout
signOut(auth)

// Password Reset
sendPasswordResetEmail(auth, email)
```

### 3. Session Cookie Management

**Purpose**: Simple session cookies for middleware compatibility with device tracking.

**Key Features**:
- HTTP-only session cookies
- Automatic cookie management
- Middleware authentication
- Server-side session validation
- Device tracking and management
- Multi-device session support

**Cookie Structure**:
```typescript
interface SessionCookie {
  uid: string;
  email: string;
  username: string;
  emailVerified: boolean;
}
```

### 4. Session Management

**Purpose**: Manage user authentication sessions with Firebase Auth integration.

**Key Features**:
- **Session Persistence**: Automatic session persistence via Firebase Auth
- **Cookie Management**: HTTP-only session cookies for middleware compatibility
- **Session Validation**: Server-side session validation for protected routes
- **Automatic Cleanup**: Session expiration and cleanup handling

**Device Information Structure**:
```typescript
interface DeviceInfo {
  userAgent: string;
  platform: string;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  location?: string;
}

interface UserSession {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  createdAt: string;
  lastActiveAt: string;
  ipAddress: string;
  isCurrentSession: boolean;
}
```

**API Endpoints**:
- `GET /api/auth/sessions` - List all active sessions for current user
- `DELETE /api/auth/sessions/[sessionId]` - Revoke specific session/device
```

## Provider Hierarchy

```tsx
// app/layout.tsx
<AuthProvider>
  {/* Rest of app */}
</AuthProvider>
```

**Critical**: This is the ONLY authentication provider that should be used. The complex multi-auth system has been removed.

## Usage Patterns

### Getting Current User

```typescript
import { useAuth } from '../providers/AuthProvider';

function MyComponent() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <LoginPrompt />;

  return <div>Welcome, {user.username}!</div>;
}
```

### Authentication Actions

```typescript
import { useAuth } from '../providers/AuthProvider';

function AuthComponent() {
  const { login, register, logout, resetPassword } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleRegister = async (email: string, password: string) => {
    try {
      await register(email, password);
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div>
      {/* Login/Register/Logout UI */}
    </div>
  );
}
```

### Admin Access Check

```typescript
import { useAuth } from '../providers/SimpleAuthProvider';

function AdminComponent() {
  const { user } = useAuth();
  const isAdmin = user?.email === 'jamiegray2234@gmail.com';

  if (!isAdmin) {
    return <div>Access denied</div>;
  }

  return <div>Admin panel content</div>;
}
```

## Session Management Usage

### 1. Authentication State

Access authentication state through the `useAuth` hook:

```typescript
import { useAuth } from '../providers/AuthProvider';

function MyComponent() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please log in</div>;

  return <div>Welcome, {user.username}!</div>;
}
```

### 2. Protected Routes

Protect routes by checking authentication status:

```typescript
import { useAuth } from '../providers/AuthProvider';
import { useRouter } from 'next/navigation';

function ProtectedPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return null;

  return <div>Protected content</div>;
}
```

**Security Benefits**:
- Users can see if unknown devices are logged in
- Ability to remotely log out compromised devices
- Clear visibility into account access patterns
- Enhanced security through session monitoring

### 3. Implementation Details

**Session Creation**: Sessions are automatically created when users log in
**Session Updates**: Last activity is updated on each authenticated request
**Session Cleanup**: Expired sessions are automatically cleaned up
**Current Session Detection**: Uses session cookies to identify current device

## Best Practices

### 1. Authentication State Management
- Use `useAuth()` hook for all authentication needs
- Check `isLoading` before rendering auth-dependent content
- Handle authentication errors gracefully

### 2. Protected Routes
- Check `isAuthenticated` before rendering protected content
- Redirect to login page for unauthenticated users
- Show loading states during authentication checks

### 3. Error Handling
- Wrap auth operations in try-catch blocks
- Display user-friendly error messages
- Log errors for debugging

### 4. Session Persistence
- Firebase Auth handles session persistence automatically
- Session cookies provide middleware compatibility
- No manual session management required

### 5. Session Security
- Implement proper session timeout handling
- Use secure HTTP-only cookies
- Validate sessions on protected routes
- Handle session expiration gracefully

## Migration from Complex Auth

The complex multi-auth system has been replaced with clean Firebase Auth:

### Removed Components
- ❌ `MultiAuthProvider` - No longer needed
- ❌ `CurrentAccountProvider` - Replaced with `AuthProvider`
- ❌ `SessionStore` - No longer needed
- ❌ Account switching - Single user authentication only

### Updated Components
- ✅ `AuthProvider` - Single authentication provider
- ✅ `useAuth()` - Authentication hook
- ✅ Firebase Auth - Standard Firebase authentication
- ✅ Session cookies - Session management

### Migration Steps
1. Replace `useCurrentAccount()` with `useAuth()`
2. Update component props from `session` to `user`
3. Remove account switching functionality
4. Clean authentication logic
5. Update documentation and tests

## Data Flow

```
Firebase Auth → SimpleAuthProvider → Components
                      ↓
                Session Cookies (for middleware)
```

### Authentication Flow
1. User logs in through Firebase Auth
2. AuthProvider manages auth state
3. Session cookies created for middleware compatibility
4. Device information is captured and stored
5. Session tracking begins for the new device
6. Components access auth state via `useAuth()` hook

### Session Management Flow
1. User logs in through Firebase Auth
2. Session cookie is created for middleware compatibility
3. Session is validated on protected routes
4. Session expires automatically or on logout
5. Expired sessions redirect to login page

## Conclusion

The simplified authentication system provides:
- ✅ **Reliability** - Standard Firebase Auth implementation
- ✅ **Maintainability** - Single authentication provider
- ✅ **Performance** - Reduced complexity and overhead
- ✅ **Security** - Firebase Auth security features
- ✅ **Simplicity** - Easy to understand and debug
- ✅ **Session Management** - Proper session handling with cookies
- ✅ **Middleware Compatibility** - Works with Next.js middleware

This architecture replaces the complex multi-auth system with a simple, reliable solution that meets all authentication needs with clean session management.

1. **Firebase Auth** triggers authentication state changes
2. **SimpleAuthProvider** receives auth changes and updates user state
3. **Components** consume auth data via `useAuth()`
4. **Session cookies** provide middleware compatibility

## User Data Structure

```typescript
interface User {
  uid: string;
  email: string;
  username: string;
  photoURL?: string;
  emailVerified: boolean;
  username?: string;
}
```

---

**Last Updated**: December 4, 2025
**Maintainer**: WeWrite Development Team
**Status**: ACTIVE - This is the current simplified authentication system

## Production Token Verification

In production (Vercel serverless), token verification uses the **Firebase REST API** instead of Firebase Admin Auth to avoid jose dependency issues:

```typescript
// Server-side session creation (api/auth/session/route.ts)
import { verifyIdToken } from '../../../lib/firebase-rest';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

// 1. Verify token with REST API (avoids jose error)
const verifyResult = await verifyIdToken(idToken);
if (!verifyResult.success) {
  return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
}

// 2. Get user data with Admin Firestore (works fine)
const admin = getFirebaseAdmin();
const userDoc = await admin.firestore()
  .collection('users')
  .doc(verifyResult.uid)
  .get();

// 3. Create session cookie
const sessionData = {
  uid: verifyResult.uid,
  email: verifyResult.email,
  username: userDoc.data()?.username
};
response.cookies.set('simpleUserSession', JSON.stringify(sessionData), {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 14 // 14 days
});
```

See [Firebase REST API Architecture](./FIREBASE_REST_API_ARCHITECTURE.md) for full details.

## Related Documentation

- [Firebase REST API Architecture](./FIREBASE_REST_API_ARCHITECTURE.md) - **START HERE** for production auth implementation
- [Authentication Architecture](./AUTHENTICATION_ARCHITECTURE.md) - Auth system overview
- [Environment Quick Reference](./ENVIRONMENT_QUICK_REFERENCE.md) - Environment behavior
