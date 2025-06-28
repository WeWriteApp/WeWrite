# PWA Account Switcher Logout Persistence Testing Guide

## Overview
This guide provides step-by-step instructions for testing the account switcher logout persistence fix in PWA mode.

## Prerequisites
1. WeWrite app running locally or on staging
2. At least 2 test accounts available
3. Browser that supports PWA installation (Chrome, Edge, Safari)
4. Device with PWA capabilities (desktop or mobile)

## Test Environment Setup

### 1. Install PWA
1. Open WeWrite in Chrome/Edge
2. Look for "Install" button in address bar or use browser menu
3. Install the PWA to desktop/home screen
4. Verify PWA is running in standalone mode (no browser UI)

### 2. Prepare Test Accounts
- **Account A**: Primary test account (e.g., test1@example.com)
- **Account B**: Secondary test account (e.g., test2@example.com)

## Test Scenarios

### Scenario 1: Basic Logout Persistence Test

#### Steps:
1. **Initial Setup**
   - Open PWA
   - Log in with Account A
   - Add Account B to account switcher (use "Add Account" option)
   - Verify both accounts appear in account switcher dropdown

2. **Logout Test**
   - Click account switcher dropdown
   - Verify both accounts are visible
   - Click logout button for Account A (the currently active account)
   - Verify Account A is removed from switcher
   - Verify Account B becomes the active account
   - Verify only Account B appears in account switcher

3. **PWA Close/Reopen Test**
   - **CRITICAL**: Completely close the PWA (not just minimize)
     - On desktop: Close the PWA window completely
     - On mobile: Swipe away the PWA from recent apps
   - Wait 5-10 seconds
   - Reopen the PWA from desktop/home screen
   - **VERIFY**: Only Account B appears in account switcher
   - **VERIFY**: Account A does NOT reappear (this was the bug)

4. **Expected Results**
   - ✅ Account A remains logged out after PWA reopen
   - ✅ Account B remains logged in and active
   - ✅ Account switcher shows only Account B

### Scenario 2: Multiple Account Logout Test

#### Steps:
1. **Setup with 3 accounts**
   - Log in with Account A
   - Add Account B and Account C to switcher
   - Verify all 3 accounts appear in switcher

2. **Logout middle account**
   - Switch to Account B (make it active)
   - Logout Account B via account switcher
   - Verify Account B is removed
   - Verify Account A or C becomes active

3. **PWA persistence test**
   - Close PWA completely
   - Reopen PWA
   - **VERIFY**: Only Account A and C appear in switcher
   - **VERIFY**: Account B does NOT reappear

### Scenario 3: Re-login After Logout Test

#### Steps:
1. **Logout Account A** (following Scenario 1)
2. **Verify Account A is gone** after PWA reopen
3. **Re-login with Account A**
   - Use "Add Account" or logout completely and login
   - Login with Account A credentials
4. **Verify Account A reappears** in account switcher
5. **Test persistence again**
   - Close and reopen PWA
   - **VERIFY**: Account A remains in switcher (logout status cleared)

### Scenario 4: Browser vs PWA Comparison Test

#### Steps:
1. **Test in regular browser**
   - Open WeWrite in regular Chrome/Safari (not PWA)
   - Perform logout test from Scenario 1
   - Note behavior

2. **Test in PWA**
   - Perform same test in PWA mode
   - Compare results
   - **VERIFY**: Both behave consistently

## Debugging and Verification

### Browser Developer Tools Checks

#### 1. localStorage Inspection
```javascript
// Check saved accounts
console.log('Saved accounts:', localStorage.getItem('savedAccounts'));

// Check logged-out accounts tracking
console.log('Logged-out accounts:', localStorage.getItem('loggedOutAccounts'));

// Check auth state
console.log('Auth state:', localStorage.getItem('authState'));
```

#### 2. IndexedDB Inspection (PWA-specific)
1. Open DevTools → Application → Storage → IndexedDB
2. Look for `firebaseLocalStorageDb`
3. Check for entries related to logged-out accounts
4. Verify entries are cleaned up after logout

#### 3. Console Logs to Monitor
Look for these console messages:
- `"AccountSwitcher: Marked account as logged out: [email] [uid]"`
- `"PWA detected: Clearing IndexedDB auth state for account: [uid]"`
- `"Cleared logged-out status for account: [uid]"`
- `"AccountSwitcher: Current user was previously logged out, not adding to accounts list"`

### Common Issues and Troubleshooting

#### Issue: Account still reappears after logout
**Check:**
- Verify `loggedOutAccounts` in localStorage contains the account UID
- Check console for error messages during logout
- Verify PWA is actually in standalone mode
- Clear browser cache and try again

#### Issue: PWA not behaving differently from browser
**Check:**
- Verify PWA installation was successful
- Check `window.matchMedia('(display-mode: standalone)').matches` returns `true`
- On iOS, check `window.navigator.standalone === true`

#### Issue: Account switcher not loading properly
**Check:**
- Verify `savedAccounts` in localStorage is valid JSON
- Check for JavaScript errors in console
- Verify Firebase auth state is properly initialized

## Test Data Cleanup

After testing, clean up test data:

```javascript
// Clear all account switcher data
localStorage.removeItem('savedAccounts');
localStorage.removeItem('loggedOutAccounts');
sessionStorage.removeItem('wewrite_accounts');

// Clear auth state
localStorage.removeItem('authState');
localStorage.removeItem('isAuthenticated');
```

## Success Criteria

The fix is successful if:

1. ✅ Logged-out accounts do NOT reappear after PWA close/reopen
2. ✅ Remaining accounts stay logged in and functional
3. ✅ Re-login works properly and clears logged-out status
4. ✅ Behavior is consistent between browser and PWA modes
5. ✅ No JavaScript errors in console during logout/reopen cycle
6. ✅ localStorage and IndexedDB are properly cleaned up

## Failure Criteria

The fix has failed if:

1. ❌ Logged-out accounts reappear after PWA reopen (original bug)
2. ❌ Account switcher becomes non-functional
3. ❌ Users cannot log back in with previously logged-out accounts
4. ❌ JavaScript errors occur during logout process
5. ❌ Authentication state becomes corrupted

## Reporting Issues

When reporting issues, include:
1. Browser and OS version
2. PWA installation method
3. Console logs during the issue
4. localStorage/sessionStorage contents
5. Steps to reproduce
6. Expected vs actual behavior

## Additional Notes

- Test on multiple browsers (Chrome, Safari, Edge)
- Test on both desktop and mobile PWAs
- Test with slow network conditions
- Test with browser cache disabled
- Consider testing with multiple tabs/windows open
