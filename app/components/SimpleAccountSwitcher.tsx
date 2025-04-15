"use client";

import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AccountSwitcherModal } from './AccountSwitcherModal';
import { useAuth } from '../providers/AuthProvider';
import { auth } from '../firebase/auth';
import { signOut } from 'firebase/auth';
import Cookies from 'js-cookie';

interface Account {
  uid: string;
  email: string;
  username?: string;
  isCurrent?: boolean;
}

export function SimpleAccountSwitcher() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load accounts from sessionStorage on component mount
  useEffect(() => {
    loadAccounts();
  }, [user]);

  const loadAccounts = () => {
    try {
      // Get saved accounts from sessionStorage
      const savedAccountsJson = sessionStorage.getItem('wewrite_accounts');
      let accountsList: Account[] = [];
      
      if (savedAccountsJson) {
        accountsList = JSON.parse(savedAccountsJson);
      }
      
      // Always include current user if available
      if (user) {
        const currentAccount = {
          uid: user.uid,
          email: user.email || '',
          username: user.username || user.displayName || '',
          isCurrent: true
        };
        
        // Check if this account is already in the list
        const existingIndex = accountsList.findIndex(acc => acc.uid === currentAccount.uid);
        
        if (existingIndex >= 0) {
          // Update existing account
          accountsList[existingIndex] = {
            ...accountsList[existingIndex],
            ...currentAccount
          };
        } else {
          // Add new account
          accountsList.push(currentAccount);
        }
        
        // Save updated accounts list
        sessionStorage.setItem('wewrite_accounts', JSON.stringify(accountsList));
      }
      
      setAccounts(accountsList);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setError(`Error loading accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAccountClick = async (account: Account) => {
    setIsOpen(false);
    setError(null);
    
    // If it's the current user, go to account settings
    if (user && user.uid === account.uid) {
      router.push('/account');
      return;
    }
    
    // Otherwise, switch to the selected account
    try {
      setIsLoading(true);
      
      // First, update the accounts list to mark this account as current
      const updatedAccounts = accounts.map(acc => ({
        ...acc,
        isCurrent: acc.uid === account.uid
      }));
      
      // Save updated accounts list
      sessionStorage.setItem('wewrite_accounts', JSON.stringify(updatedAccounts));
      
      // Store the account to switch to in sessionStorage
      sessionStorage.setItem('wewrite_switch_to', JSON.stringify(account));
      
      // Set a flag to indicate we're switching accounts
      sessionStorage.setItem('wewrite_switching', 'true');
      
      // Sign out from Firebase
      try {
        await signOut(auth);
        console.log('Signed out from Firebase');
      } catch (signOutError) {
        console.error('Error signing out from Firebase:', signOutError);
        // Continue anyway
      }
      
      // Set cookies for session-based auth
      Cookies.set('wewrite_user_id', account.uid, { expires: 7 });
      Cookies.set('wewrite_authenticated', 'true', { expires: 7 });
      
      // Redirect to the switch-account page
      window.location.href = '/auth/switch-account';
    } catch (error) {
      console.error('Error switching account:', error);
      setError(`Error switching account: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const handleAddAccount = async () => {
    setIsOpen(false);
    setError(null);
    
    try {
      // Store current user in sessionStorage
      if (user) {
        sessionStorage.setItem('wewrite_previous_user', JSON.stringify({
          uid: user.uid,
          email: user.email,
          username: user.username || user.displayName
        }));
      }
      
      // Set a flag to indicate we're adding a new account
      sessionStorage.setItem('wewrite_adding_account', 'true');
      
      // Sign out from Firebase
      try {
        await signOut(auth);
        console.log('Signed out from Firebase');
      } catch (signOutError) {
        console.error('Error signing out from Firebase:', signOutError);
        // Continue anyway
      }
      
      // Redirect to login page
      router.push('/auth/login');
    } catch (error) {
      console.error('Error adding account:', error);
      setError(`Error adding account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent transition-colors overflow-hidden"
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
          username: account.username || ''
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
      
      {error && (
        <div className="mt-2 p-2 bg-red-100 text-red-800 rounded-md text-sm">
          {error}
        </div>
      )}
    </>
  );
}
