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

interface Account {
  uid: string;
  email: string;
  username?: string;
}

export function AccountSwitcher() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  
  // Mock accounts for now - in a real implementation, this would come from a service
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
    {
      uid: '2',
      email: 'test@example.com',
      username: 'test',
    },
  ]);

  const handleAccountClick = (account: Account) => {
    // In a real implementation, this would switch the active account
    // For now, just navigate to account settings
    setIsOpen(false);
    router.push('/account');
  };

  const handleAddAccount = () => {
    // In a real implementation, this would open a login/register flow
    setIsOpen(false);
    router.push('/auth/login');
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {accounts.map((account) => (
              <div 
                key={account.uid}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleAccountClick(account)}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{account.username || 'Anonymous'}</span>
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
