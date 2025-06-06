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

  // Load accounts from localStorage on component mount
  useEffect(() => {
    // Always include current user if available
    const accountsList: Account[] = [];

    if (user) {
      accountsList.push({
        uid: user.uid,
        email: user.email || '',
        username: user.username || '',
        isCurrent: true
      });
    }

    // Try to load saved accounts from localStorage
    try {
      const savedAccounts = localStorage.getItem('savedAccounts');
      if (savedAccounts) {
        const parsedAccounts: Account[] = JSON.parse(savedAccounts);

        // Filter out the current user to avoid duplicates
        const filteredAccounts = parsedAccounts.filter(account =>
          !user || account.uid !== user.uid
        );

        // Add filtered accounts to the list
        accountsList.push(...filteredAccounts);
      }
    } catch (error) {
      console.error('Error loading saved accounts:', error);
    }

    setAccounts(accountsList);
  }, [user]);

  const handleAccountClick = (account: Account) => {
    setIsOpen(false);

    if (account.isCurrent) {
      // If it's the current account, just go to settings
      router.push('/settings');
    } else {
      // If it's a different account, switch to it
      console.log('AccountSwitcher: Switching to account:', account.email);

      // Save current accounts list to localStorage first
      saveAccountsToLocalStorage();

      // Update the accounts list to mark the clicked account as current
      const updatedAccounts = accounts.map(acc => ({
        ...acc,
        isCurrent: acc.uid === account.uid
      }));
      localStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));

      // Prepare the account data for switching
      const accountData = {
        uid: account.uid,
        email: account.email,
        username: account.username,
        isCurrent: true
      };

      // Immediately emit account switch event to update authentication context
      const accountSwitchEvent = new CustomEvent('accountSwitch', {
        detail: { newUser: accountData }
      });
      window.dispatchEvent(accountSwitchEvent);

      // Update session storage for the switch
      sessionStorage.setItem('wewrite_switch_to', JSON.stringify(accountData));

      // Store the account data for the switch
      localStorage.setItem('switchToAccount', JSON.stringify(accountData));

      // Navigate directly to home page instead of going through logout flow
      // This prevents the authentication context from being lost
      console.log('AccountSwitcher: Account switch complete, navigating to home');
      router.push('/');
    }
  };

  // Helper function to save accounts to localStorage
  const saveAccountsToLocalStorage = () => {
    if (accounts.length > 0) {
      localStorage.setItem('savedAccounts', JSON.stringify(accounts));
    }
  };

  const handleLogout = () => {
    setIsOpen(false);

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

    // Log out the user completely
    logoutUser().then(() => {
      router.push('/');
    });
  };

  const handleAddAccount = () => {
    // Navigate to the login page
    setIsOpen(false);

    // Save current accounts to localStorage
    saveAccountsToLocalStorage();

    // Store the current URL to return to after login
    sessionStorage.setItem('wewrite_return_url', window.location.pathname);

    // Use localStorage to remember the current user is still logged in
    if (user) {
      // Store user data without trying to access auth token directly
      // This avoids the "blocked by client" error from browser extensions
      localStorage.setItem('previousUserSession', JSON.stringify({
        uid: user.uid,
        email: user.email,
        username: user.username,
        isCurrent: true
      }));

      // Also store in sessionStorage for better cross-browser compatibility
      // especially for PWA environments
      sessionStorage.setItem('wewrite_previous_user', JSON.stringify({
        uid: user.uid,
        email: user.email,
        username: user.username || user.displayName
      }));

      // Mark that we're adding a new account
      localStorage.setItem('addingNewAccount', 'true');
      sessionStorage.setItem('wewrite_adding_account', 'true');

      // Log out the current user before navigating to auth flow
      // This is necessary to allow adding a new account
      // Log out from Firebase, but keep the previousUserSession
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
                className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors ${
                  account.isCurrent ? 'bg-accent' : ''
                }`}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{account.username || 'No username'}</span>
                  <span className="text-sm text-muted-foreground">{account.email}</span>
                </div>
                {account.isCurrent && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                    Current
                  </span>
                )}
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
