"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthManager from "../utils/AuthManager";
import { AccountSwitcherNew } from "../components/AccountSwitcherNew";
import { Button } from "../components/ui/button";

export default function TestAccountSwitcher() {
  const router = useRouter();
  const [accounts, setAccounts] = useState([]);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Load accounts and current account
    const savedAccounts = AuthManager.getSavedAccounts();
    const current = AuthManager.getCurrentAccount();
    
    setAccounts(savedAccounts);
    setCurrentAccount(current);
    setIsAuthenticated(AuthManager.isAuthenticated());
  }, []);

  const handleSignOut = async () => {
    await AuthManager.signOutUser();
    router.push('/auth/login');
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Account Switcher Test</h1>
      
      <div className="bg-card p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Current Authentication State</h2>
        <p className="mb-2">
          <span className="font-medium">Authenticated:</span> {isAuthenticated ? 'Yes' : 'No'}
        </p>
        {currentAccount && (
          <div className="mb-4">
            <p className="mb-1"><span className="font-medium">User ID:</span> {currentAccount.uid}</p>
            <p className="mb-1"><span className="font-medium">Email:</span> {currentAccount.email}</p>
            <p><span className="font-medium">Username:</span> {currentAccount.username || 'Not set'}</p>
          </div>
        )}
        
        <Button onClick={handleSignOut} variant="destructive" className="mt-2">
          Sign Out
        </Button>
      </div>
      
      <div className="bg-card p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Account Switcher</h2>
        <div className="max-w-md">
          <AccountSwitcherNew />
        </div>
      </div>
      
      <div className="bg-card p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Saved Accounts ({accounts.length})</h2>
        {accounts.length > 0 ? (
          <ul className="space-y-4">
            {accounts.map(account => (
              <li key={account.uid} className="p-4 border rounded-md">
                <p className="mb-1"><span className="font-medium">User ID:</span> {account.uid}</p>
                <p className="mb-1"><span className="font-medium">Email:</span> {account.email}</p>
                <p className="mb-1"><span className="font-medium">Username:</span> {account.username || 'Not set'}</p>
                <p><span className="font-medium">Last Login:</span> {account.lastLogin || 'Unknown'}</p>
                <div className="mt-2 flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => AuthManager.switchToAccount(account).then(() => router.push('/auth/switch-account'))}
                    disabled={currentAccount && currentAccount.uid === account.uid}
                  >
                    Switch to Account
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => {
                      AuthManager.removeAccount(account.uid);
                      setAccounts(AuthManager.getSavedAccounts());
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No saved accounts found.</p>
        )}
      </div>
    </div>
  );
}
