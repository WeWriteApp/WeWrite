"use client";

import React, { useState, useEffect } from 'react';
import { ChevronRight, Settings, LogOut, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
// import { AccountSwitcherModal } from './AccountSwitcherModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { useAuth } from '../../providers/AuthProvider';
import { logoutUser } from '../../firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';

interface Account {
  uid: string;
  email: string;
  username?: string;
  isCurrent?: boolean;
}

export function AccountSwitcher() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // State for storing multiple accounts
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [switchingAccount, setSwitchingAccount] = useState<string | null>(null);

  // Helper function to validate and refresh account data from Firestore
  const validateAccountData = async (account: Account): Promise<Account | null> => {
    try {
      const userDoc = await getDoc(doc(db, "users", account.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          uid: account.uid,
          email: userData.email || account.email,
          username: userData.username || account.username,
          isCurrent: account.isCurrent
        };
      }
      return null;
    } catch (error) {
      console.error('Error validating account data:', error);
      return null;
    }
  };

  // Load accounts from localStorage on component mount
  useEffect(() => {
    const loadAccounts = async () => {
      const accountsList: Account[] = [];

      // Try to load saved accounts from localStorage first
      try {
        const savedAccounts = localStorage.getItem('savedAccounts');
        const loggedOutAccounts = localStorage.getItem('loggedOutAccounts');
        const loggedOutAccountsSet = new Set(loggedOutAccounts ? JSON.parse(loggedOutAccounts) : []);

        if (savedAccounts) {
          const parsedAccounts: Account[] = JSON.parse(savedAccounts);

          // Filter out accounts that have been explicitly logged out
          const validAccounts = parsedAccounts.filter(account => !loggedOutAccountsSet.has(account.uid));

          // If we have a current user, ensure they are marked as current in the saved accounts
          if (user) {
            // Check if current user was explicitly logged out
            if (loggedOutAccountsSet.has(user.uid)) {
              console.log('AccountSwitcher: Current user was previously logged out, not adding to accounts list');
              // Don't add the current user to accounts if they were explicitly logged out
              const updatedAccounts = validAccounts.map(account => ({
                ...account,
                isCurrent: false
              }));
              accountsList.push(...updatedAccounts);
            } else {
              const updatedAccounts = validAccounts.map(account => ({
                ...account,
                isCurrent: account.uid === user.uid
              }));

              // Check if current user exists in valid saved accounts
              const currentUserExists = updatedAccounts.some(account => account.uid === user.uid);

              if (!currentUserExists) {
                // Add current user to the list if not already present and not logged out
                updatedAccounts.unshift({
                  uid: user.uid,
                  email: user.email || '',
                  username: user.username || '',
                  isCurrent: true
                });
              }

              accountsList.push(...updatedAccounts);

              // Update localStorage with corrected current user status
              localStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
            }
          } else {
            // No current user, mark all valid accounts as not current
            const updatedAccounts = validAccounts.map(account => ({
              ...account,
              isCurrent: false
            }));
            accountsList.push(...updatedAccounts);
          }
        } else if (user && !loggedOutAccountsSet.has(user.uid)) {
          // No saved accounts, but we have a current user who wasn't logged out
          const currentUserAccount = {
            uid: user.uid,
            email: user.email || '',
            username: user.username || '',
            isCurrent: true
          };
          accountsList.push(currentUserAccount);

          // Save to localStorage
          localStorage.setItem('savedAccounts', JSON.stringify([currentUserAccount]));
        }
      } catch (error) {
        console.error('Error loading saved accounts:', error);

        // Fallback: if there's an error and we have a current user, just show them
        if (user) {
          accountsList.push({
            uid: user.uid,
            email: user.email || '',
            username: user.username || '',
            isCurrent: true
          });
        }
      }

      setAccounts(accountsList);
    };

    loadAccounts();
  }, [user]);

  const handleAccountClick = async (account: Account) => {
    setIsOpen(false);

    if (account.isCurrent) {
      // If it's the current account, just go to settings
      router.push('/settings');
      return;
    }

    // If it's a different account, switch to it
    console.log('AccountSwitcher: Switching to account:', account.email);
    setSwitchingAccount(account.uid);

    try {
      // Validate the account data from Firestore
      const validatedAccount = await validateAccountData(account);

      if (!validatedAccount) {
        console.error('AccountSwitcher: Account validation failed, removing invalid account');
        // Remove invalid account from saved accounts
        const filteredAccounts = accounts.filter(acc => acc.uid !== account.uid);
        setAccounts(filteredAccounts);
        localStorage.setItem('savedAccounts', JSON.stringify(filteredAccounts));
        setSwitchingAccount(null);
        return;
      }

      // Update the accounts list to mark the clicked account as current
      const updatedAccounts = accounts.map(acc => ({
        ...acc,
        isCurrent: acc.uid === account.uid,
        // Update with validated data
        email: acc.uid === account.uid ? validatedAccount.email : acc.email,
        username: acc.uid === account.uid ? validatedAccount.username : acc.username
      }));

      // Save updated accounts to localStorage
      localStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
      setAccounts(updatedAccounts);

      // Prepare the validated account data for switching
      const accountData = {
        uid: validatedAccount.uid,
        email: validatedAccount.email,
        username: validatedAccount.username,
        isCurrent: true
      };

      // Store the account data for the switch
      localStorage.setItem('switchToAccount', JSON.stringify(accountData));
      sessionStorage.setItem('wewrite_switch_to', JSON.stringify(accountData));

      // Emit account switch event to update authentication context
      const accountSwitchEvent = new CustomEvent('accountSwitch', {
        detail: { newUser: accountData }
      });
      window.dispatchEvent(accountSwitchEvent);

      console.log('AccountSwitcher: Account switch complete, context updated');

      // Small delay to ensure the context is updated before navigation
      setTimeout(() => {
        router.push('/');
      }, 100);

    } catch (error) {
      console.error('Error switching account:', error);
      setSwitchingAccount(null);
      // Could show a toast notification here
    }
  };

  // Helper function to save accounts to localStorage
  const saveAccountsToLocalStorage = () => {
    if (accounts.length > 0) {
      localStorage.setItem('savedAccounts', JSON.stringify(accounts));
    }
  };

  const handleLogout = async () => {
    setIsOpen(false);

    const currentAccount = accounts.find(acc => acc.isCurrent);
    if (!currentAccount) {
      console.error('AccountSwitcher: No current account found for logout');
      return;
    }

    // Track this account as logged out to prevent it from reappearing
    const loggedOutAccounts = localStorage.getItem('loggedOutAccounts');
    const loggedOutAccountsSet = new Set(loggedOutAccounts ? JSON.parse(loggedOutAccounts) : []);
    loggedOutAccountsSet.add(currentAccount.uid);
    localStorage.setItem('loggedOutAccounts', JSON.stringify([...loggedOutAccountsSet]));

    console.log('AccountSwitcher: Marked account as logged out:', currentAccount.email, currentAccount.uid);

    if (accounts.length > 1) {
      // If there are multiple accounts, remove only the current account
      const remainingAccounts = accounts.filter(acc => !acc.isCurrent);

      if (remainingAccounts.length > 0) {
        // Set the first remaining account as current
        const nextAccount = { ...remainingAccounts[0], isCurrent: true };
        const updatedAccounts = [nextAccount, ...remainingAccounts.slice(1)];

        // Update localStorage
        localStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
        sessionStorage.setItem('wewrite_accounts', JSON.stringify(updatedAccounts));

        // Clear Firebase Auth state for the logged-out account
        try {
          await clearFirebaseAuthForAccount(currentAccount.uid);
        } catch (error) {
          console.error('Error clearing Firebase auth for account:', error);
        }

        // Emit account switch event to update authentication context
        const accountSwitchEvent = new CustomEvent('accountSwitch', {
          detail: { newUser: nextAccount }
        });
        window.dispatchEvent(accountSwitchEvent);

        console.log('AccountSwitcher: Logged out current account, switched to:', nextAccount.email);

        // Stay on current page - user is still logged in as another account
        return;
      }
    }

    // If this is the only account or no remaining accounts, perform full logout
    console.log('AccountSwitcher: Performing full logout - no remaining accounts');

    // Clear all account data
    localStorage.removeItem('savedAccounts');
    sessionStorage.removeItem('wewrite_accounts');
    sessionStorage.removeItem('wewrite_switch_to');

    // Clear Firebase Auth state for the logged-out account
    try {
      await clearFirebaseAuthForAccount(currentAccount.uid);
    } catch (error) {
      console.error('Error clearing Firebase auth for account:', error);
    }

    // Log out the user completely
    logoutUser().then(() => {
      router.push('/');
    });
  };

  const handleAddAccount = () => {
    // Navigate to the login page
    setIsOpen(false);

    // Save current accounts to localStorage with proper current user marking
    if (accounts.length > 0) {
      localStorage.setItem('savedAccounts', JSON.stringify(accounts));
    }

    // Store the current URL to return to after login
    sessionStorage.setItem('wewrite_return_url', window.location.pathname);

    // Use localStorage to remember the current user is still logged in
    if (user) {
      // Store user data for restoration after adding new account
      const currentUserData = {
        uid: user.uid,
        email: user.email,
        username: user.username,
        isCurrent: true
      };

      localStorage.setItem('previousUserSession', JSON.stringify(currentUserData));
      sessionStorage.setItem('wewrite_previous_user', JSON.stringify(currentUserData));

      // Mark that we're adding a new account
      localStorage.setItem('addingNewAccount', 'true');
      sessionStorage.setItem('wewrite_adding_account', 'true');

      // Log out the current user before navigating to auth flow
      // This is necessary to allow adding a new account
      logoutUser(true).then(() => {
        // Navigate to login page after logout
        window.location.href = '/auth/login';
      }).catch(error => {
        console.error('Error logging out:', error);
        // If logout fails, still try to navigate to login page
        window.location.href = '/auth/login';
      });
    } else {
      // If no user is logged in, just navigate to login page
      window.location.href = '/auth/login';
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-neutral-alpha-2 dark:hover:bg-accent transition-colors overflow-hidden"
      >
        <div className="flex flex-col items-start min-w-0 flex-1 mr-2">
          <span className="font-medium truncate w-full">{user?.username || 'Missing username'}</span>
          <span className="text-sm text-muted-foreground truncate w-full">{user?.email || 'Not signed in'}</span>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch Account</DialogTitle>
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </DialogHeader>

          <div className="space-y-2">
            {accounts.map((account) => (
              <button
                key={account.uid}
                onClick={() => handleAccountClick(account)}
                disabled={switchingAccount === account.uid}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                  account.isCurrent
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-accent border border-transparent'
                } ${switchingAccount === account.uid ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{account.username || 'No username'}</span>
                  <span className="text-sm text-muted-foreground">{account.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  {switchingAccount === account.uid && (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {account.isCurrent && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded font-medium">
                      Current
                    </span>
                  )}
                </div>
              </button>
            ))}

            <div className="border-t pt-2 mt-4">
              <Button
                variant="outline"
                onClick={handleAddAccount}
                className="w-full justify-start"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  router.push('/settings');
                }}
                className="w-full justify-start mt-2"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>

              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full justify-start mt-2 text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {accounts.length > 1 ? 'Log out of this account' : 'Log out'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Clear Firebase Auth state for a specific account in PWA
 * This helps prevent the logged-out account from reappearing
 */
async function clearFirebaseAuthForAccount(accountUid: string): Promise<void> {
  try {
    // In PWAs, Firebase uses IndexedDB for persistence
    // We need to clear the specific account's auth state

    // Check if we're in a PWA environment
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true;

    if (isPWA) {
      console.log('PWA detected: Clearing IndexedDB auth state for account:', accountUid);

      // Clear IndexedDB entries for this specific account
      try {
        // Open the Firebase Auth IndexedDB
        const dbRequest = indexedDB.open('firebaseLocalStorageDb');

        dbRequest.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (db.objectStoreNames.contains('firebaseLocalStorage')) {
            const transaction = db.transaction(['firebaseLocalStorage'], 'readwrite');
            const store = transaction.objectStore('firebaseLocalStorage');

            // Get all keys and remove entries related to this account
            const getAllRequest = store.getAllKeys();

            getAllRequest.onsuccess = () => {
              const keys = getAllRequest.result;
              keys.forEach((key) => {
                if (typeof key === 'string' && key.includes(accountUid)) {
                  store.delete(key);
                  console.log('Cleared IndexedDB entry for logged-out account:', key);
                }
              });
            };
          }
        };
      } catch (indexedDBError) {
        console.warn('Could not clear IndexedDB auth state:', indexedDBError);
      }
    }

    // Also clear any localStorage entries related to this account
    const keysToCheck = [
      `firebase:authUser:${auth.app.options.apiKey}:[DEFAULT]`,
      `firebase:host:${auth.app.options.authDomain}`,
      `wewrite_user_${accountUid}`,
      `wewrite_session_${accountUid}`
    ];

    keysToCheck.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value && value.includes(accountUid)) {
          localStorage.removeItem(key);
          console.log('Cleared localStorage entry for logged-out account:', key);
        }
      } catch (error) {
        console.warn('Could not clear localStorage entry:', key, error);
      }
    });

    // Clear sessionStorage entries
    keysToCheck.forEach(key => {
      try {
        const value = sessionStorage.getItem(key);
        if (value && value.includes(accountUid)) {
          sessionStorage.removeItem(key);
          console.log('Cleared sessionStorage entry for logged-out account:', key);
        }
      } catch (error) {
        console.warn('Could not clear sessionStorage entry:', key, error);
      }
    });

  } catch (error) {
    console.error('Error clearing Firebase auth state for account:', accountUid, error);
  }
}

/**
 * Clear a user from the logged-out accounts list when they log back in
 * This should be called when a user successfully logs in
 */
export function clearLoggedOutAccount(accountUid: string): void {
  try {
    const loggedOutAccounts = localStorage.getItem('loggedOutAccounts');
    if (loggedOutAccounts) {
      const loggedOutAccountsSet = new Set(JSON.parse(loggedOutAccounts));
      if (loggedOutAccountsSet.has(accountUid)) {
        loggedOutAccountsSet.delete(accountUid);
        localStorage.setItem('loggedOutAccounts', JSON.stringify([...loggedOutAccountsSet]));
        console.log('Cleared logged-out status for account:', accountUid);
      }
    }
  } catch (error) {
    console.error('Error clearing logged-out account status:', error);
  }
}

/**
 * Check if an account was explicitly logged out
 */
export function isAccountLoggedOut(accountUid: string): boolean {
  try {
    const loggedOutAccounts = localStorage.getItem('loggedOutAccounts');
    if (loggedOutAccounts) {
      const loggedOutAccountsSet = new Set(JSON.parse(loggedOutAccounts));
      return loggedOutAccountsSet.has(accountUid);
    }
  } catch (error) {
    console.error('Error checking logged-out account status:', error);
  }
  return false;
}

export default AccountSwitcher;
