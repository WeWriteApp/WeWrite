# WeWrite Session Management Architecture

**⚠️ SOURCE OF TRUTH DOCUMENT ⚠️**

This document describes the **ONLY** session management system that should be used in WeWrite. Any other session management implementations should be deleted to maintain single sources of truth.

## Overview

WeWrite uses a **hybrid session management architecture** that combines:

1. **MultiAuthProvider** - Manages multiple user accounts
2. **CurrentAccountProvider** - Manages the currently active account
3. **Zustand Session Store** - Global state management for session data

This architecture provides:
- Multi-account support
- Seamless account switching
- Persistent session state
- Type-safe session management
- Single source of truth for authentication state

## Architecture Components

### 1. MultiAuthProvider (`app/providers/MultiAuthProvider.tsx`)

**Purpose**: Manages a collection of user accounts and handles Firebase authentication.

**Key Features**:
- Maintains multiple authenticated sessions
- Handles Firebase auth state changes
- Provides session CRUD operations
- Manages session persistence

**Exports**:
```typescript
export const useMultiAuth = (): SessionBagContextValue
```

**Context Value**:
```typescript
interface SessionBagContextValue {
  sessions: UserAccount[];
  addSession: (session: UserAccount) => void;
  removeSession: (sessionId: string) => void;
  updateSession: (sessionId: string, updates: Partial<UserAccount>) => void;
  getSession: (sessionId: string) => UserAccount | null;
  isLoading: boolean;
  error: string | null;
}
```

### 2. CurrentAccountProvider (`app/providers/CurrentAccountProvider.tsx`)

**Purpose**: Manages the currently active account from the multi-auth.

**Key Features**:
- Tracks which session is currently active
- Provides authentication state derived from current account
- Handles session switching
- Manages loading states

**Exports**:
```typescript
export const useCurrentAccount = (): CurrentAccountContextValue
```

**Context Value**:
```typescript
interface CurrentAccountContextValue {
  currentAccount: UserAccount | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
  switchAccount: (sessionId: string) => void;
  clearCurrentSession: () => void;
}
```

### 3. Zustand Session Store (`app/store/sessionStore.ts`)

**Purpose**: Global state management for session-related data and UI state.

**Key Features**:
- Persisted session preferences
- UI state management
- Performance optimizations
- Type-safe state updates

## Provider Hierarchy

```tsx
// app/layout.tsx
<MultiAuthProvider>
  <CurrentAccountProvider>
    {/* Rest of app */}
  </CurrentAccountProvider>
</MultiAuthProvider>
```

**Critical**: This is the ONLY provider hierarchy that should be used. Do not add additional auth providers.

## Usage Patterns

### Getting Current user account

```typescript
import { useCurrentAccount } from '../providers/CurrentAccountProvider';

function MyComponent() {
  const { currentAccount, isAuthenticated, isLoading } = useCurrentAccount();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <LoginPrompt />;

  return <div>Welcome, {currentAccount.displayName}!</div>;
}
```

### Managing Multiple Sessions

```typescript
import { useMultiAuth } from '../providers/MultiAuthProvider';

function AccountSwitcher() {
  const { sessions, addSession, removeSession } = useMultiAuth();
  const { switchAccount } = useCurrentAccount();

  return (
    <div>
      {sessions.map(account => (
        <button
          key={account.uid}
          onClick={() => switchAccount(account.uid)}
        >
          {account.displayName}
        </button>
      ))}
    </div>
  );
}
```

### Session Store Usage

```typescript
import { useSessionStore } from '../store/sessionStore';

function SessionSettings() {
  const { preferences, updatePreferences } = useSessionStore();
  
  return (
    <div>
      <input 
        value={preferences.theme}
        onChange={(e) => updatePreferences({ theme: e.target.value })}
      />
    </div>
  );
}
```

## Data Flow

```
Firebase Auth → MultiAuthProvider → CurrentAccountProvider → Components
                      ↓
                Zustand Session Store
```

1. **Firebase Auth** triggers authentication state changes
2. **MultiAuthProvider** receives auth changes and updates session collection
3. **CurrentAccountProvider** tracks active account from the bag
4. **Components** consume session data via `useCurrentAccount()`
5. **Session Store** provides additional state management and persistence

## Session Data Structure

```typescript
interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
  username?: string;
  createdAt: number;
  lastLoginAt: number;
  isAnonymous: boolean;
}
```

## Migration Guide

### ❌ OLD NAMING CONVENTIONS (Find and Exterminate These)

**CRITICAL**: The following old naming patterns MUST be found and replaced throughout the codebase:

#### 1. Old Variable Names
```typescript
// ❌ DELETE - Old session naming
const { session } = useCurrentAccount();
const userId = session?.uid;
const userEmail = session?.email;
const userName = session?.displayName;

// ❌ DELETE - Old destructuring patterns
const { session, isAuthenticated } = useCurrentAccount();
const { user } = useCurrentAccount();
const { authUser } = useCurrentAccount();
```

#### 2. Old Import Patterns
```typescript
// ❌ DELETE - Old global store
import { useAuth } from '../store/globalStore';

// ❌ DELETE - Old auth providers
import { useAuth } from '../providers/AuthProvider';

// ❌ DELETE - Old context providers
import { useAuth } from '../contexts/AuthContext';

// ❌ DELETE - Old session patterns
import { useSession } from '../providers/SessionProvider';
import { useUser } from '../providers/UserProvider';
```

#### 3. Old Component Props
```typescript
// ❌ DELETE - Old prop naming
<Component user={session} />
<Component session={session} />
<Component authUser={session} />
<Component currentUser={session} />
```

#### 4. Old Function Parameters
```typescript
// ❌ DELETE - Old parameter naming
function handleSave(session) { ... }
function checkPermissions(user) { ... }
function recordActivity(authUser) { ... }
```

#### 5. Old State Variables
```typescript
// ❌ DELETE - Old state naming
const [session, setSession] = useState(null);
const [user, setUser] = useState(null);
const [authUser, setAuthUser] = useState(null);
const [currentUser, setCurrentUser] = useState(null);
```

### ✅ NEW NAMING CONVENTIONS (Use These)

#### 1. Correct Variable Names
```typescript
// ✅ CORRECT - New currentAccount naming
const { currentAccount } = useCurrentAccount();
const userId = currentAccount?.uid;
const userEmail = currentAccount?.email;
const userName = currentAccount?.displayName;

// ✅ CORRECT - Proper destructuring
const { currentAccount, isAuthenticated } = useCurrentAccount();
```

#### 2. Correct Import Patterns
```typescript
// ✅ CORRECT - current account
import { useCurrentAccount } from '../providers/CurrentAccountProvider';

// ✅ CORRECT - multi-auth management
import { useMultiAuth } from '../providers/MultiAuthProvider';

// ✅ CORRECT - Session store
import { useSessionStore } from '../store/sessionStore';
```

#### 3. Correct Component Props
```typescript
// ✅ CORRECT - New prop naming
<Component currentAccount={currentAccount} />
<Component user={currentAccount} /> // Only when prop name is 'user'
```

#### 4. Correct Function Parameters
```typescript
// ✅ CORRECT - New parameter naming
function handleSave(currentAccount) { ... }
function checkPermissions(currentAccount) { ... }
function recordActivity(currentAccount) { ... }
```

#### 5. Correct State Variables
```typescript
// ✅ CORRECT - New state naming (rarely needed due to provider)
const [currentAccount, setCurrentAccount] = useState(null);
```

### 🔍 SEARCH AND DESTROY PATTERNS

Use these regex patterns to find old naming conventions:

```bash
# Find old session destructuring
grep -r "const.*session.*=.*useCurrentAccount" .

# Find old user destructuring
grep -r "const.*user.*=.*useCurrentAccount" .

# Find old session props
grep -r "session\s*:" .
grep -r "user\s*:" .

# Find old session parameters
grep -r "function.*session\)" .
grep -r "function.*user\)" .

# Find old session state
grep -r "useState.*session" .
grep -r "useState.*user" .
```

## File Locations

### Core Files (DO NOT DELETE)
- `app/providers/MultiAuthProvider.tsx`
- `app/providers/CurrentAccountProvider.tsx`
- `app/store/sessionStore.ts`
- `app/types/session.ts`

### Integration Files
- `app/layout.tsx` - Provider setup
- `app/components/auth/SessionAuthInitializer.tsx` - Auth initialization

## Common Patterns

### Authentication Check
```typescript
const { isAuthenticated, isLoading } = useCurrentAccount();

if (isLoading) return <LoadingState />;
if (!isAuthenticated) return <UnauthenticatedState />;
```

### User Data Access
```typescript
const { currentAccount } = useCurrentAccount();
const userId = currentAccount?.uid;
const userEmail = currentAccount?.email;
const displayName = currentAccount?.displayName;
```

### Account Switching
```typescript
const { sessions } = useMultiAuth();
const { switchAccount } = useCurrentAccount();

const handleAccountSwitch = (sessionId: string) => {
  switchAccount(sessionId);
};
```

## Error Handling

The system provides comprehensive error handling:

```typescript
const { error } = useCurrentAccount();

if (error) {
  // Handle session errors
  console.error('Session error:', error);
}
```

## Performance Considerations

- Sessions are persisted to localStorage
- Context values are memoized to prevent unnecessary re-renders
- Loading states prevent UI flashing
- Hydration safety prevents SSR mismatches

## Testing

When writing tests, mock the providers:

```typescript
const mockCurrentAccount = {
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  // ... other required fields
};

const TestWrapper = ({ children }) => (
  <MultiAuthProvider>
    <CurrentAccountProvider>
      {children}
    </CurrentAccountProvider>
  </MultiAuthProvider>
);
```

## Troubleshooting

### Common Issues

1. **"useCurrentAccount must be used within a CurrentAccountProvider"**
   - Ensure component is wrapped in CurrentAccountProvider
   - Check provider hierarchy in layout.tsx

2. **CurrentAccount not persisting**
   - Check localStorage permissions
   - Verify currentAccount data structure

3. **Multiple auth systems conflict**
   - Delete old auth providers/hooks
   - Use only the hybrid system

4. **PERMISSION_DENIED errors in Firebase**
   - Verify `currentAccount?.uid` is properly set
   - Check Firebase Auth state is initialized
   - Ensure user is authenticated before Firestore operations

5. **Missing delete buttons or edit permissions**
   - Verify `currentAccount?.uid === page?.userId` checks
   - Ensure `currentAccount` is used instead of `session`
   - Check component prop naming consistency

### 🚨 CRITICAL NAMING MISTAKES TO AVOID

1. **Using `session` instead of `currentAccount`**
   ```typescript
   // ❌ WRONG
   const { session } = useCurrentAccount();
   const canEdit = session?.uid === page?.userId;

   // ✅ CORRECT
   const { currentAccount } = useCurrentAccount();
   const canEdit = currentAccount?.uid === page?.userId;
   ```

2. **Mixing old and new naming in same component**
   ```typescript
   // ❌ WRONG - Inconsistent naming
   const { currentAccount } = useCurrentAccount();
   const userId = session?.uid; // Using old 'session'

   // ✅ CORRECT - Consistent naming
   const { currentAccount } = useCurrentAccount();
   const userId = currentAccount?.uid;
   ```

3. **Passing wrong prop names to components**
   ```typescript
   // ❌ WRONG
   <Component session={currentAccount} />

   // ✅ CORRECT
   <Component currentAccount={currentAccount} />
   // OR if component expects 'user' prop:
   <Component user={currentAccount} />
   ```

### Debug Tools

```typescript
// Enable debug logging
const { currentAccount, isLoading, error } = useCurrentAccount();
console.log('CurrentAccount Debug:', { currentAccount, isLoading, error });
```

## Maintenance Rules

1. **NEVER** create additional auth providers
2. **ALWAYS** use `useCurrentAccount()` for auth state
3. **ALWAYS** use `currentAccount` variable naming (never `session`, `user`, `authUser`)
4. **DELETE** any old auth implementations immediately
5. **DELETE** any old naming patterns immediately when found
6. **MAINTAIN** single source of truth
7. **ENFORCE** consistent `currentAccount` naming in all PRs
8. **UPDATE** this document when making changes
9. **SEARCH** for old patterns before merging any PR
10. **REJECT** PRs that use old naming conventions

### 🔒 NAMING ENFORCEMENT POLICY

- **All new code** MUST use `currentAccount` naming
- **All refactored code** MUST be updated to `currentAccount` naming
- **All PR reviews** MUST check for old naming patterns
- **All old patterns** MUST be eliminated when encountered
- **No exceptions** - consistency is critical for maintainability

## API Reference

### useCurrentAccount() Hook

```typescript
const {
  currentAccount,    // UserAccount | null - Current active account
  isAuthenticated,   // boolean - True if user is logged in
  isLoading,         // boolean - True during auth state changes
  isHydrated,        // boolean - True after client-side hydration
  error,             // string | null - Any currentAccount errors
  switchAccount,     // (sessionId: string) => void
  clearCurrentSession // () => void
} = useCurrentAccount();
```

### useMultiAuth() Hook

```typescript
const {
  sessions,          // UserAccount[] - All available sessions
  addSession,        // (session: UserAccount) => void
  removeSession,     // (sessionId: string) => void
  updateSession,     // (sessionId: string, updates: Partial<UserAccount>) => void
  getSession,        // (sessionId: string) => UserAccount | null
  isLoading,         // boolean - True during session operations
  error              // string | null - Any bag operation errors
} = useMultiAuth();
```

### useSessionStore() Hook

```typescript
const {
  preferences,       // SessionPreferences - User preferences
  updatePreferences, // (updates: Partial<SessionPreferences>) => void
  clearPreferences,  // () => void
  uiState,          // SessionUIState - UI-specific state
  setUIState        // (updates: Partial<SessionUIState>) => void
} = useSessionStore();
```

## Implementation Checklist

### ✅ When implementing session management in a new component:

- [ ] Import `useCurrentAccount` from `../providers/CurrentAccountProvider`
- [ ] Handle `isLoading` state appropriately
- [ ] Check `isAuthenticated` before accessing user data
- [ ] Use `currentAccount?.uid` for user ID (with optional chaining)
- [ ] Use `currentAccount?.email` for user email
- [ ] Use `currentAccount?.displayName` for display name
- [ ] Handle `error` state if needed
- [ ] Do NOT import from old auth systems

### 🔍 When refactoring existing components:

- [ ] Search for `const { session }` and replace with `const { currentAccount }`
- [ ] Search for `session?.` and replace with `currentAccount?.`
- [ ] Search for `user?.` and replace with `currentAccount?.` (if from useCurrentAccount)
- [ ] Search for `authUser?.` and replace with `currentAccount?.`
- [ ] Update all function parameters from `session` to `currentAccount`
- [ ] Update all component props from `session` to `currentAccount`
- [ ] Update all state variables from `session` to `currentAccount`
- [ ] Remove old auth provider imports
- [ ] Test authentication flows thoroughly

### 🚨 MANDATORY CLEANUP CHECKLIST

Before any PR is merged, verify these patterns are eliminated:

- [ ] No `const { session } = useCurrentAccount()` patterns exist
- [ ] No `const { user } = useCurrentAccount()` patterns exist
- [ ] No `const { authUser } = useCurrentAccount()` patterns exist
- [ ] No old auth provider imports remain
- [ ] No old session state variables remain
- [ ] All components use `currentAccount` consistently
- [ ] All function parameters use `currentAccount` consistently
- [ ] All component props use `currentAccount` consistently

## Code Examples

### Complete Authentication Flow

```typescript
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function ProtectedPage() {
  const { currentAccount, isAuthenticated, isLoading } = useCurrentAccount();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div>
      <h1>Welcome, {currentAccount.displayName}!</h1>
      <p>Email: {currentAccount.email}</p>
      <p>User ID: {currentAccount.uid}</p>
    </div>
  );
}
```

### Multi-Account Component

```typescript
import { useMultiAuth } from '../providers/MultiAuthProvider';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';

function AccountManager() {
  const { sessions, removeSession } = useMultiAuth();
  const { session: currentAccount, switchAccount } = useCurrentAccount();

  return (
    <div>
      <h2>Available Accounts</h2>
      {sessions.map(session => (
        <div key={session.uid} className="account-item">
          <span>{session.displayName} ({session.email})</span>
          {currentAccount?.uid === session.uid && <span>ACTIVE</span>}
          <button onClick={() => switchAccount(session.uid)}>
            Switch
          </button>
          <button onClick={() => removeSession(session.uid)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

**Last Updated**: 2025-01-01
**Maintainer**: WeWrite Development Team
**Status**: ACTIVE - This is the current and only session management system
