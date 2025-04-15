"use client";

import React, { useState, useEffect } from 'react';
import { ChevronRight, Settings, LogOut, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AccountSwitcherModal } from './AccountSwitcherModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { IconButton } from './ui/icon-button';
import { useAuth } from '../providers/AuthProvider';
import { logoutUser } from '../firebase/auth';

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
      // If it's the current account, just go to account settings
      router.push('/account');
    } else {
      // If it's a different account, switch to it
      // Save current accounts list to localStorage first
      saveAccountsToLocalStorage();

      // Update the accounts list to mark the clicked account as current
      const updatedAccounts = accounts.map(acc => ({
        ...acc,
        isCurrent: acc.uid === account.uid
      }));
      localStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));

      // Get the auth token from multiple sources
      // 1. Check cookies first
      let authToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('session='))
        ?.split('=')[1];

      // 2. If not in cookies, check localStorage for the token we saved during logout
      if (!authToken) {
        authToken = localStorage.getItem('lastAuthToken');
      }

      // Prepare the account data with auth token if available
      const accountData = {
        ...account,
        isCurrent: true,
        authToken: authToken || undefined
      };

      // Store the account data for the switch
      localStorage.setItem('switchToAccount', JSON.stringify(accountData));

      // Log out current user (but keep session data for account switcher)
      logoutUser(true).then(() => {
        // After logout, redirect to a special route that will handle the switch
        // which will then redirect to home page
        router.push('/auth/switch-account');
      });
    }
  };

  // Helper function to save accounts to localStorage
  const saveAccountsToLocalStorage = () => {
    if (accounts.length > 0) {
      localStorage.setItem('savedAccounts', JSON.stringify(accounts));
    }
  };

  const handleAddAccount = () => {
    // Navigate to the login page
    setIsOpen(false);

    // Save current accounts to localStorage
    saveAccountsToLocalStorage();

    // Use localStorage to remember the current user is still logged in
    if (user) {
      // Get the auth token from multiple sources
      // 1. Check cookies first
      let authToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('session='))
        ?.split('=')[1];

      // 2. If not in cookies, check localStorage for the token we saved during logout
      if (!authToken) {
        authToken = localStorage.getItem('lastAuthToken');
      }

      localStorage.setItem('previousUserSession', JSON.stringify({
        uid: user.uid,
        email: user.email,
        username: user.username,
        isCurrent: true,
        authToken: authToken || undefined
      }));

      // Log out the current user before navigating to auth flow
      // This is necessary to allow adding a new account
      // Log out from Firebase, but keep the previousUserSession
      logoutUser(true).then(() => {
        // Navigate to login page after logout
        router.push('/auth/login');
      });
    } else {
      // If no user is logged in, just navigate to login page
      router.push('/auth/login');
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent transition-colors overflow-hidden"
      >
        <div className="flex flex-col items-start min-w-0 flex-1 mr-2">
          <span className="font-medium truncate w-full">{user?.username || 'Anonymous'}</span>
          <span className="text-sm text-muted-foreground truncate w-full">{user?.email || 'Not signed in'}</span>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </button>

      <AccountSwitcherModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        accounts={accounts.map(account => ({
          id: account.uid,
          email: account.email,
          username: account.username
        }))}
        currentUser={user ? {
          id: user.uid,
          email: user.email || '',
          username: user.username
        } : null}
        onSwitchAccount={(userId) => {
          const account = accounts.find(acc => acc.uid === userId);
          if (account) {
            // Make sure we're not treating this as the current account
            // even if the UI thinks it is (to prevent going to account settings)
            const accountToSwitch = {
              ...account,
              isCurrent: false // Force this to false to ensure we go to home page
            };
            handleAccountClick(accountToSwitch);
          }
        }}
        onAddAccount={handleAddAccount}
      />
    </>
  );
}
