"use client";

import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AccountSwitcherModal } from './AccountSwitcherModal';
import { useAuth } from '../providers/AuthProvider';
import AuthManager from '../utils/AuthManager';

interface Account {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
}

export function AccountSwitcherNew() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load accounts from AuthManager on component mount
  useEffect(() => {
    loadAccounts();
  }, [user]);

  const loadAccounts = () => {
    // Get saved accounts
    const savedAccounts = AuthManager.getSavedAccounts();

    // Always include current user if available and not already in the list
    if (user) {
      const currentAccount = {
        uid: user.uid,
        email: user.email || '',
        username: user.username || user.displayName || '',
        displayName: user.displayName || user.username || ''
      };

      // Save current user to accounts list
      AuthManager.saveAccount(currentAccount);

      // Reload accounts after saving
      const updatedAccounts = AuthManager.getSavedAccounts();
      setAccounts(updatedAccounts);
    } else {
      setAccounts(savedAccounts);
    }
  };

  const handleAccountClick = async (account: Account) => {
    setIsOpen(false);

    // If it's the current user, go to account settings
    if (user && user.uid === account.uid) {
      router.push('/account');
      return;
    }

    // Otherwise, switch to the selected account
    try {
      setIsLoading(true);

      // Switch to the selected account
      await AuthManager.switchToAccount(account);

      // Redirect to account switch page
      router.push('/auth/switch-account');
    } catch (error) {
      console.error('Error switching account:', error);
      setIsLoading(false);
    }
  };

  const handleAddAccount = async () => {
    setIsOpen(false);

    try {
      // Sign out but keep accounts
      await AuthManager.signOutUser(true);

      // Redirect to login page
      router.push('/auth/login');
    } catch (error) {
      console.error('Error adding account:', error);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-neutral-alpha-2 dark:hover:bg-accent transition-colors overflow-hidden"
        disabled={isLoading}
      >
        <div className="flex flex-col items-start min-w-0 flex-1 mr-2">
          <span className="font-medium truncate w-full">
            {isLoading ? 'Switching...' : (user?.username || user?.displayName || 'Anonymous')}
          </span>
          <span className="text-sm text-muted-foreground truncate w-full">
            {user?.email || 'Not signed in'}
          </span>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </button>

      <AccountSwitcherModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        accounts={accounts.map(account => ({
          id: account.uid,
          email: account.email,
          username: account.username || account.displayName || ''
        }))}
        currentUser={user ? {
          id: user.uid,
          email: user.email || '',
          username: user.username || user.displayName || ''
        } : null}
        onSwitchAccount={(userId) => {
          const account = accounts.find(acc => acc.uid === userId);
          if (account) {
            handleAccountClick(account);
          }
        }}
        onAddAccount={handleAddAccount}
      />
    </>
  );
}
