/**
 * PWA Debug Helper Utilities
 * Utilities for debugging account switcher and PWA-specific issues
 */

export interface DebugInfo {
  isPWA: boolean;
  isStandalone: boolean;
  savedAccounts: any[];
  loggedOutAccounts: string[];
  authState: string | null;
  storageInfo: {
    localStorage: { [key: string]: string };
    sessionStorage: { [key: string]: string };
  };
  firebaseAuth: {
    currentUser: any;
    persistence: string;
  };
}

/**
 * Check if the app is running in PWA mode
 */
export function isPWAMode(): boolean {
  // Check for standalone display mode (most PWAs)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Check for iOS PWA
  const isIOSPWA = (window.navigator as any).standalone === true;
  
  // Check for minimal-ui or fullscreen (some PWAs)
  const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  
  return isStandalone || isIOSPWA || isMinimalUI || isFullscreen;
}

/**
 * Get comprehensive debug information about the current state
 */
export function getDebugInfo(): DebugInfo {
  const debugInfo: DebugInfo = {
    isPWA: isPWAMode(),
    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
    savedAccounts: [],
    loggedOutAccounts: [],
    authState: null,
    storageInfo: {
      localStorage: {},
      sessionStorage: {}
    },
    firebaseAuth: {
      currentUser: null,
      persistence: 'unknown'
    }
  };

  // Get saved accounts
  try {
    const savedAccountsStr = localStorage.getItem('savedAccounts');
    debugInfo.savedAccounts = savedAccountsStr ? JSON.parse(savedAccountsStr) : [];
  } catch (error) {
    console.error('Error parsing saved accounts:', error);
  }

  // Get logged-out accounts
  try {
    const loggedOutAccountsStr = localStorage.getItem('loggedOutAccounts');
    debugInfo.loggedOutAccounts = loggedOutAccountsStr ? JSON.parse(loggedOutAccountsStr) : [];
  } catch (error) {
    console.error('Error parsing logged-out accounts:', error);
  }

  // Get auth state
  debugInfo.authState = localStorage.getItem('authState');

  // Get all localStorage items
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      debugInfo.storageInfo.localStorage[key] = localStorage.getItem(key) || '';
    }
  }

  // Get all sessionStorage items
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key) {
      debugInfo.storageInfo.sessionStorage[key] = sessionStorage.getItem(key) || '';
    }
  }

  // Get Firebase auth info (if available)
  try {
    // This would need to be imported from the actual Firebase config
    // For now, we'll just check for auth-related localStorage items
    const firebaseAuthKeys = Object.keys(debugInfo.storageInfo.localStorage)
      .filter(key => key.includes('firebase') && key.includes('auth'));
    
    if (firebaseAuthKeys.length > 0) {
      debugInfo.firebaseAuth.persistence = 'local';
    }
  } catch (error) {
    console.error('Error getting Firebase auth info:', error);
  }

  return debugInfo;
}

/**
 * Print debug information to console in a readable format
 */
export function printDebugInfo(): void {
  const info = getDebugInfo();
  
  console.group('🔍 PWA Account Switcher Debug Info');
  
  console.log('📱 PWA Status:');
  console.log(`  - Is PWA Mode: ${info.isPWA}`);
  console.log(`  - Is Standalone: ${info.isStandalone}`);
  console.log(`  - User Agent: ${navigator.userAgent}`);
  
  console.log('\n👥 Account Information:');
  console.log(`  - Saved Accounts (${info.savedAccounts.length}):`);
  info.savedAccounts.forEach((account, index) => {
    console.log(`    ${index + 1}. ${account.email} (${account.uid}) ${account.isCurrent ? '← Current' : ''}`);
  });
  
  console.log(`  - Logged-out Accounts (${info.loggedOutAccounts.length}):`);
  info.loggedOutAccounts.forEach((uid, index) => {
    console.log(`    ${index + 1}. ${uid}`);
  });
  
  console.log('\n🔐 Auth State:');
  console.log(`  - Auth State: ${info.authState}`);
  console.log(`  - Firebase Persistence: ${info.firebaseAuth.persistence}`);
  
  console.log('\n💾 Storage Contents:');
  console.log('  - localStorage:');
  Object.entries(info.storageInfo.localStorage)
    .filter(([key]) => key.includes('wewrite') || key.includes('firebase') || key.includes('auth'))
    .forEach(([key, value]) => {
      const truncatedValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
      console.log(`    ${key}: ${truncatedValue}`);
    });
  
  console.log('  - sessionStorage:');
  Object.entries(info.storageInfo.sessionStorage)
    .filter(([key]) => key.includes('wewrite') || key.includes('firebase') || key.includes('auth'))
    .forEach(([key, value]) => {
      const truncatedValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
      console.log(`    ${key}: ${truncatedValue}`);
    });
  
  console.groupEnd();
}

/**
 * Clear all account switcher data (for testing)
 */
export function clearAccountSwitcherData(): void {
  console.log('🧹 Clearing account switcher data...');
  
  // Clear account-related localStorage
  localStorage.removeItem('savedAccounts');
  localStorage.removeItem('loggedOutAccounts');
  localStorage.removeItem('authState');
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('addingNewAccount');
  localStorage.removeItem('previousUserSession');
  localStorage.removeItem('accountSwitchInProgress');
  localStorage.removeItem('switchToAccount');
  
  // Clear account-related sessionStorage
  sessionStorage.removeItem('wewrite_accounts');
  sessionStorage.removeItem('wewrite_switch_to');
  sessionStorage.removeItem('wewrite_adding_account');
  sessionStorage.removeItem('wewrite_previous_user');
  
  console.log('✅ Account switcher data cleared');
}

/**
 * Simulate account logout for testing
 */
export function simulateAccountLogout(accountUid: string): void {
  console.log(`🚪 Simulating logout for account: ${accountUid}`);
  
  // Add to logged-out accounts
  const loggedOutAccounts = localStorage.getItem('loggedOutAccounts');
  const loggedOutAccountsSet = new Set(loggedOutAccounts ? JSON.parse(loggedOutAccounts) : []);
  loggedOutAccountsSet.add(accountUid);
  localStorage.setItem('loggedOutAccounts', JSON.stringify([...loggedOutAccountsSet]));
  
  // Remove from saved accounts
  const savedAccounts = localStorage.getItem('savedAccounts');
  if (savedAccounts) {
    const accounts = JSON.parse(savedAccounts);
    const filteredAccounts = accounts.filter((acc: any) => acc.uid !== accountUid);
    localStorage.setItem('savedAccounts', JSON.stringify(filteredAccounts));
  }
  
  console.log(`✅ Account ${accountUid} marked as logged out`);
}

/**
 * Check for potential issues with account switcher state
 */
export function validateAccountSwitcherState(): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  try {
    // Check saved accounts format
    const savedAccountsStr = localStorage.getItem('savedAccounts');
    if (savedAccountsStr) {
      const savedAccounts = JSON.parse(savedAccountsStr);
      if (!Array.isArray(savedAccounts)) {
        issues.push('savedAccounts is not an array');
      } else {
        // Check for multiple current accounts
        const currentAccounts = savedAccounts.filter((acc: any) => acc.isCurrent);
        if (currentAccounts.length > 1) {
          issues.push(`Multiple accounts marked as current: ${currentAccounts.length}`);
        }
        
        // Check for required fields
        savedAccounts.forEach((acc: any, index: number) => {
          if (!acc.uid) issues.push(`Account ${index} missing uid`);
          if (!acc.email) issues.push(`Account ${index} missing email`);
        });
      }
    }
    
    // Check logged-out accounts format
    const loggedOutAccountsStr = localStorage.getItem('loggedOutAccounts');
    if (loggedOutAccountsStr) {
      const loggedOutAccounts = JSON.parse(loggedOutAccountsStr);
      if (!Array.isArray(loggedOutAccounts)) {
        issues.push('loggedOutAccounts is not an array');
      }
    }
    
    // Check for conflicts between saved and logged-out accounts
    if (savedAccountsStr && loggedOutAccountsStr) {
      const savedAccounts = JSON.parse(savedAccountsStr);
      const loggedOutAccounts = JSON.parse(loggedOutAccountsStr);
      
      savedAccounts.forEach((acc: any) => {
        if (loggedOutAccounts.includes(acc.uid)) {
          issues.push(`Account ${acc.email} (${acc.uid}) is both saved and logged out`);
        }
      });
    }
    
  } catch (error) {
    issues.push(`Error validating state: ${error}`);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Add debug utilities to window object for easy console access
 */
export function enableDebugMode(): void {
  (window as any).pwaDebug = {
    getInfo: getDebugInfo,
    printInfo: printDebugInfo,
    clearData: clearAccountSwitcherData,
    simulateLogout: simulateAccountLogout,
    validate: validateAccountSwitcherState,
    isPWA: isPWAMode
  };
  
  console.log('🔧 PWA Debug mode enabled. Use window.pwaDebug for debugging utilities.');
  console.log('Available methods:');
  console.log('  - window.pwaDebug.getInfo() - Get debug information');
  console.log('  - window.pwaDebug.printInfo() - Print debug info to console');
  console.log('  - window.pwaDebug.clearData() - Clear all account switcher data');
  console.log('  - window.pwaDebug.simulateLogout(uid) - Simulate account logout');
  console.log('  - window.pwaDebug.validate() - Validate account switcher state');
  console.log('  - window.pwaDebug.isPWA() - Check if running in PWA mode');
}