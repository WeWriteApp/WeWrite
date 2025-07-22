# WeWrite Authentication Architecture

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

**Purpose**: Simple session cookies for middleware compatibility.

**Key Features**:
- HTTP-only session cookies
- Automatic cookie management
- Middleware authentication
- Server-side session validation

**Cookie Structure**:
```typescript
interface SessionCookie {
  uid: string;
  email: string;
  username: string;
  emailVerified: boolean;
}
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

  return <div>Welcome, {user.displayName}!</div>;
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
2. SimpleAuthProvider manages auth state
3. Session cookies created for middleware compatibility
4. Components access auth state via `useAuth()` hook

## Conclusion

The simplified authentication system provides:
- ✅ **Reliability** - Standard Firebase Auth implementation
- ✅ **Maintainability** - Single authentication provider
- ✅ **Performance** - Reduced complexity and overhead
- ✅ **Security** - Firebase Auth security features
- ✅ **Simplicity** - Easy to understand and debug

This architecture replaces the complex multi-auth system with a simple, reliable solution that meets all authentication needs while being much easier to maintain and debug.

1. **Firebase Auth** triggers authentication state changes
2. **SimpleAuthProvider** receives auth changes and updates user state
3. **Components** consume auth data via `useAuth()`
4. **Session cookies** provide middleware compatibility

## User Data Structure

```typescript
interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
  username?: string;
}
```

---

**Last Updated**: 2025-01-22
**Maintainer**: WeWrite Development Team
**Status**: ACTIVE - This is the current simplified authentication system
