# WeWrite Session Management System

## Overview

WeWrite uses a multi-session authentication system that allows users to maintain multiple authenticated sessions simultaneously. This system is built on top of Firebase Auth and provides seamless account switching capabilities.

## Architecture

### Core Components

1. **MultiAuthProvider** (`app/providers/MultiAuthProvider.tsx`)
   - Manages multiple user sessions in localStorage
   - Provides session CRUD operations
   - Handles session persistence and cleanup

2. **ApiSessionInitializer** (`app/components/auth/ApiSessionInitializer.tsx`)
   - Initializes sessions from API authentication
   - Creates session cookies for server-side authentication
   - Handles session switching and validation

3. **CurrentAccountProvider** (`app/providers/CurrentAccountProvider.tsx`)
   - Manages the currently active session
   - Provides current user context throughout the app

## Session Lifecycle

### 1. Session Creation

```typescript
// Create a new session
const sessionData = {
  uid: userData.uid,
  email: userData.email,
  username: userData.username,
  displayName: userData.displayName,
  emailVerified: userData.emailVerified,
  lastLoginAt: new Date().toISOString()
};

// Add to session store (waits for completion)
const newSession = await addSession(sessionData);
```

### 2. Session Storage

Sessions are stored in:
- **localStorage**: For client-side persistence (`wewrite_sessions` key)
- **Cookies**: For server-side authentication (HTTP-only cookies)
- **React State**: For real-time access during app usage

### 3. Session Switching

```typescript
// Switch to a different session by UID
await switchAccountByUid(targetUid);
```

### 4. Session Cleanup

```typescript
// Remove expired sessions automatically
await cleanupExpiredSessions();

// Remove specific session
await removeSession(sessionId);

// Clear all sessions (logout all)
await clearAllSessions();
```

## Session Data Structure

```typescript
interface UserAccount {
  sessionId: string;           // Unique session identifier
  uid: string;                 // Firebase UID
  email: string;               // User email
  username?: string;           // WeWrite username
  displayName?: string;        // Display name
  emailVerified: boolean;      // Email verification status
  createdAt: string;          // Session creation timestamp
  lastActiveAt: string;       // Last activity timestamp
  lastLoginAt: string;        // Last login timestamp
  isActive: boolean;          // Currently active session
  isPersistent: boolean;      // Should persist across browser sessions
}
```

## Key Features

### Automatic Session Availability

The `addSession` function now properly waits for the session to be available in the store:

```typescript
const addSession = async (sessionData) => {
  return new Promise((resolve) => {
    setSessions(prev => {
      const updated = [...prev, newSession];
      saveToStorage(updated);
      
      // Ensure state update completes before resolving
      setTimeout(() => {
        resolve(newSession);
      }, 50);
      
      return updated;
    });
  });
};
```

### Error Handling

- **Session Not Found**: Throws descriptive errors when sessions can't be located
- **Storage Errors**: Handles localStorage failures gracefully
- **Network Errors**: Manages API authentication failures
- **Validation Errors**: Ensures session data integrity

### Performance Optimizations

- **Lazy Loading**: Sessions loaded only when needed
- **Caching**: Session data cached in memory and localStorage
- **Batch Operations**: Multiple session operations batched together
- **Cleanup**: Automatic removal of expired sessions

## Usage Examples

### Basic Session Management

```typescript
import { useMultiAuth } from '../providers/MultiAuthProvider';

const MyComponent = () => {
  const { 
    sessions, 
    addSession, 
    removeSession, 
    switchAccountByUid,
    getSessionByUid 
  } = useMultiAuth();

  // Get current sessions
  const allSessions = sessions;

  // Find specific session
  const userSession = getSessionByUid('user-uid-here');

  // Switch accounts
  const handleSwitchAccount = async (uid) => {
    await switchAccountByUid(uid);
  };

  // Remove session
  const handleLogout = async (sessionId) => {
    await removeSession(sessionId);
  };
};
```

### Session Initialization from API

```typescript
import { ApiSessionInitializer } from '../components/auth/ApiSessionInitializer';

// Component automatically handles session creation from API auth
<ApiSessionInitializer />
```

## Troubleshooting

### Common Issues

1. **"Session not found in store after creation"**
   - **Cause**: Race condition between session creation and retrieval
   - **Solution**: Fixed by making `addSession` wait for state update completion

2. **Sessions not persisting**
   - **Cause**: localStorage access issues or quota exceeded
   - **Solution**: Check browser storage settings and clear old data

3. **Multiple active sessions**
   - **Cause**: Session switching not properly deactivating previous session
   - **Solution**: Ensure `switchAccountByUid` properly manages active states

### Debug Commands

```typescript
// Check all sessions
console.log('All sessions:', sessions);

// Check current session
console.log('Current session:', getSessionByUid(currentUid));

// Test session creation
const testSession = await addSession({
  uid: 'test-uid',
  email: 'test@example.com',
  emailVerified: true
});
```

## Security Considerations

- **Session IDs**: Generated with timestamp + random string for uniqueness
- **HTTP-Only Cookies**: Server-side authentication uses secure cookies
- **Automatic Cleanup**: Expired sessions removed automatically
- **Validation**: All session data validated before storage
- **Encryption**: Sensitive data encrypted in storage (future enhancement)

## Migration Notes

### Recent Changes (2024)

- **Fixed Session Availability**: `addSession` now properly waits for session to be available
- **Removed Retry Logic**: Eliminated unnecessary retry loops in ApiSessionInitializer
- **Improved Error Messages**: More descriptive error messages for debugging
- **Performance Improvements**: Reduced unnecessary state updates and re-renders

### Breaking Changes

- `addSession` now returns a Promise that resolves when session is fully available
- Session creation is now synchronous from the caller's perspective
- Error handling has been standardized across all session operations

## Future Enhancements

- **Session Encryption**: Encrypt sensitive session data in localStorage
- **Session Sharing**: Share sessions across browser tabs
- **Session Analytics**: Track session usage patterns
- **Advanced Cleanup**: More sophisticated session expiration policies
