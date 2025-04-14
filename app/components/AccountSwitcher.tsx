"use client";

import React, { useState } from 'react';
import { ChevronRight, Settings, LogOut, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { useAuth } from '../providers/AuthProvider';
import { logoutUser } from '../firebase/auth';

interface Account {
  uid: string;
  email: string;
  username?: string;
}

export function AccountSwitcher() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Only show the current user account
  const [accounts, setAccounts] = useState<Account[]>([
    user ? {
      uid: user.uid,
      email: user.email || '',
      username: user.username || '',
    } : {
      uid: '1',
      email: 'demo@example.com',
      username: 'demo',
    },
  ]);

  const handleAccountClick = (account: Account) => {
    // In a real implementation, this would switch the active account
    // For now, just navigate to account settings
    setIsOpen(false);
    router.push('/account');
  };

  const handleAddAccount = () => {
    // Navigate to the login page
    setIsOpen(false);

    // Use localStorage to remember the current user is still logged in
    if (user) {
      localStorage.setItem('previousUserSession', JSON.stringify({
        uid: user.uid,
        email: user.email,
        username: user.username
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
        <DialogContent className="sm:max-w-md mx-4">
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
                    <span className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">Current</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{account.email}</span>
                </div>
                <Settings className="h-5 w-5 text-muted-foreground" />
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
