"use client";

import React, { useState, useEffect } from 'react';
import { ChevronRight, Settings, LogOut, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
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

      // Simulate logging in as the selected account
      // In a real implementation, this would use proper auth tokens
      localStorage.setItem('switchToAccount', JSON.stringify({
        ...account,
        isCurrent: true
      }));

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
      localStorage.setItem('previousUserSession', JSON.stringify({
        uid: user.uid,
        email: user.email,
        username: user.username,
        isCurrent: true
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
        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent transition-colors"
      >
        <div className="flex flex-col items-start">
          <span className="font-medium">{user?.username || 'Anonymous'}</span>
          <span className="text-sm text-muted-foreground">{user?.email || 'Not signed in'}</span>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md rounded-lg relative">
          <IconButton
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4"
          >
            <X className="h-4 w-4" />
          </IconButton>
          <DialogHeader>
            <DialogTitle>Switch Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 px-1">
            {accounts.map((account) => (
              <div
                key={account.uid}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleAccountClick(account)}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{account.username || 'Anonymous'}</span>
                    {account.isCurrent && (
                      <span className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">Current</span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{account.email}</span>
                </div>
                {account.isCurrent ? (
                  <IconButton variant="ghost" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    router.push('/account');
                  }}>
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </IconButton>
                ) : null}
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full mt-4 flex items-center justify-center gap-2"
              onClick={handleAddAccount}
            >
              <Plus className="h-4 w-4" />
              Add Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
