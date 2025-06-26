# PWA Account Switcher Logout Persistence Fix

## Problem Summary
**Issue**: When users logged out of an account via the account switcher in PWA mode, the logged-out account would reappear after closing and reopening the PWA, even though it should remain logged out.

**Root Cause**: The account loading logic in `AccountSwitcher.tsx` was not properly tracking which accounts had been explicitly logged out. When the PWA reopened, Firebase Auth's IndexedDB persistence would restore authentication state, and the account switcher would re-add the "logged-out" account back to the list.

## Solution Overview
Implemented a comprehensive tracking system for logged-out accounts that persists across PWA close/reopen cycles, with proper cleanup of Firebase Auth state in PWA environments.

## Files Modified

### 1. `app/components/auth/AccountSwitcher.tsx`
**Key Changes:**
- **Enhanced account loading logic** to filter out explicitly logged-out accounts
- **Added `loggedOutAccounts` tracking** in localStorage to persist logout state
- **Improved logout handling** with proper Firebase Auth cleanup for PWAs
- **Added helper functions** for managing logged-out account state

**New Functions Added:**
- `clearFirebaseAuthForAccount()` - Clears Firebase Auth state for specific accounts in PWA mode
- `clearLoggedOutAccount()` - Removes account from logged-out list when they log back in
- `isAccountLoggedOut()` - Checks if an account was explicitly logged out

**Logic Changes:**
- Account loading now checks `loggedOutAccounts` list and filters them out
- Logout process now tracks the logged-out account UID in localStorage
- PWA-specific IndexedDB cleanup to prevent auth state restoration
- Proper handling of current user who was previously logged out

### 2. `app/providers/AuthProvider.tsx`
**Key Changes:**
- **Added import** for `clearLoggedOutAccount` function
- **Enhanced auth state change handler** to clear logged-out status when user logs back in
- **Automatic cleanup** of logged-out tracking when user successfully authenticates

### 3. `app/layout.tsx`
**Key Changes:**
- **Added PWADebugInitializer component** for development debugging
- **Integrated debug utilities** to help with testing and troubleshooting

## New Files Created

### 4. `app/components/utils/PWADebugInitializer.tsx`
**Purpose**: Initializes debugging utilities in development mode
**Features:**
- Enables debug mode only in development
- Provides helpful console messages for PWA testing
- Detects and logs PWA mode status

### 5. `app/utils/pwa-debug-helper.ts`
**Purpose**: Comprehensive debugging utilities for PWA account switcher issues
**Features:**
- PWA mode detection
- Debug information collection
- Storage state validation
- Testing utilities (simulate logout, clear data)
- Console debugging interface

### 6. `app/tests/account-switcher-pwa.test.ts`
**Purpose**: Comprehensive test suite for PWA logout persistence
**Features:**
- Tests logged-out account tracking
- Tests account loading with logout persistence
- Tests PWA-specific storage clearing
- End-to-end logout persistence scenarios
- Error handling tests

### 7. `app/tests/pwa-logout-testing-guide.md`
**Purpose**: Manual testing guide for PWA logout persistence
**Features:**
- Step-by-step testing scenarios
- Browser developer tools debugging
- Troubleshooting common issues
- Success/failure criteria

### 8. `jest.config.js` & `jest.setup.js`
**Purpose**: Jest testing configuration for PWA-specific tests
**Features:**
- Next.js integration
- PWA environment mocking
- Firebase mocking
- Coverage configuration

### 9. `package.json`
**Changes:**
- Added Jest and testing dependencies
- Added test scripts for PWA testing

## Technical Implementation Details

### Logout Persistence Mechanism
1. **Track Logged-out Accounts**: When user logs out via account switcher, their UID is added to `loggedOutAccounts` array in localStorage
2. **Filter on Load**: When accounts are loaded, the list is filtered to exclude any UIDs in the `loggedOutAccounts` array
3. **PWA Auth Cleanup**: In PWA mode, Firebase Auth state is cleared from IndexedDB to prevent automatic restoration
4. **Re-login Cleanup**: When a user logs back in, their UID is removed from `loggedOutAccounts` array

### PWA-Specific Handling
- **PWA Detection**: Uses `window.matchMedia('(display-mode: standalone)')` and `navigator.standalone`
- **IndexedDB Cleanup**: Clears Firebase Auth entries from IndexedDB for logged-out accounts
- **Storage Cleanup**: Removes localStorage and sessionStorage entries related to logged-out accounts

### Data Flow
```
User Logout → Add UID to loggedOutAccounts → Clear Firebase Auth → Update saved accounts
PWA Close/Reopen → Load accounts → Filter out logged-out UIDs → Display remaining accounts
User Re-login → Remove UID from loggedOutAccounts → Normal account loading
```

## Testing

### Automated Tests
- Unit tests for logged-out account tracking
- Integration tests for account loading logic
- PWA-specific storage tests
- End-to-end logout persistence scenarios

### Manual Testing
- Complete testing guide provided
- PWA installation and testing procedures
- Browser developer tools debugging
- Multiple account scenarios

### Debug Utilities
- `window.pwaDebug` object available in development
- Real-time state inspection
- Storage validation
- Simulation utilities

## Verification Steps

1. **Install PWA** and add multiple accounts to account switcher
2. **Logout one account** via account switcher dropdown
3. **Close PWA completely** (not just minimize)
4. **Reopen PWA** from desktop/home screen
5. **Verify** logged-out account does NOT reappear
6. **Test re-login** with previously logged-out account
7. **Verify** account reappears after successful re-login

## Browser Compatibility
- **Chrome/Edge**: Full PWA support with IndexedDB cleanup
- **Safari**: iOS PWA support with `navigator.standalone` detection
- **Firefox**: Basic PWA support (limited IndexedDB cleanup)

## Development Tools
- Use `window.pwaDebug.printInfo()` to inspect current state
- Use `window.pwaDebug.validate()` to check for issues
- Use `window.pwaDebug.clearData()` to reset for testing

## Rollback Plan
If issues arise, the fix can be rolled back by:
1. Reverting changes to `AccountSwitcher.tsx`
2. Removing the `loggedOutAccounts` localStorage tracking
3. Removing PWA-specific auth cleanup code
4. The app will return to previous behavior (accounts reappearing after PWA reopen)

## Future Improvements
- Consider using IndexedDB instead of localStorage for better PWA integration
- Add server-side logout tracking for cross-device consistency
- Implement automatic cleanup of old logged-out account entries
- Add analytics to track logout persistence effectiveness
