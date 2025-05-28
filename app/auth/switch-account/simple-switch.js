"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../firebase/auth';
import { setupSessionCookies, updateSessionStorage } from './auth-helper';

/**
 * A simple account switching component that uses standard Firebase Auth patterns
 */
export default function SimpleAccountSwitch() {
  const router = useRouter();
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const completeAccountSwitch = async () => {
      try {
        setStatus('Getting account data...');

        // Get the account to switch to from sessionStorage
        const switchToJson = sessionStorage.getItem('wewrite_switch_to');
        if (!switchToJson) {
          setError('No account to switch to found');
          setTimeout(() => router.push('/'), 1000);
          return;
        }

        const switchToAccount = JSON.parse(switchToJson);
        console.log('Switching to account:', switchToAccount.email);

        // Make sure we're completely signed out of Firebase
        if (auth.currentUser) {
          setStatus('Signing out current user...');
          try {
            await auth.signOut();
            console.log('Signed out current user');
          } catch (signOutError) {
            console.error('Error signing out current user:', signOutError);
            // Continue anyway
          }
        }

        // Set up session cookies
        setStatus('Setting up session cookies...');
        setupSessionCookies(switchToAccount);

        // Update session storage
        setStatus('Updating session storage...');
        updateSessionStorage(switchToAccount);

        // Also update localStorage to ensure consistency
        try {
          const localStorageAccounts = localStorage.getItem('wewrite_accounts');
          if (localStorageAccounts) {
            const accounts = JSON.parse(localStorageAccounts);

            // Update the accounts to mark the current one and ensure others are not current
            const updatedAccounts = accounts.map(acc => ({
              ...acc,
              isCurrent: acc.uid === switchToAccount.uid
            }));

            localStorage.setItem('wewrite_accounts', JSON.stringify(updatedAccounts));
          }
        } catch (error) {
          console.error('Error updating localStorage:', error);
          // Continue anyway
        }

        // Clear the account switch flags
        sessionStorage.removeItem('wewrite_switching');
        sessionStorage.removeItem('wewrite_switch_to');

        // Also clear any old localStorage items
        localStorage.removeItem('switchToAccount');
        localStorage.removeItem('accountSwitchInProgress');

        setStatus('Redirecting to home page...');

        // Redirect to home page
        window.location.href = '/';
      } catch (error) {
        console.error('Error switching account:', error);
        setError(`Error switching account: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setTimeout(() => router.push('/'), 2000);
      }
    };

    completeAccountSwitch();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Switching Account...</h1>
        <p className="text-muted-foreground mb-4">
          {status}
        </p>
        {error && (
          <p className="text-red-500 mt-4">{error}</p>
        )}
      </div>
    </div>
  );
}
