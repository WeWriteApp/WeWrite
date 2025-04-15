"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from 'js-cookie';

export default function SwitchAccountPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const switchAccount = () => {
      try {
        // Get the account to switch to from localStorage
        const switchToAccountJson = localStorage.getItem('switchToAccount');

        if (!switchToAccountJson) {
          setError('No account to switch to found');
          setTimeout(() => router.push('/'), 1000);
          return;
        }

        const switchToAccount = JSON.parse(switchToAccountJson);
        console.log('Switching to account:', switchToAccount.username || switchToAccount.email);

        // Make sure the account is marked as current
        switchToAccount.isCurrent = true;

        // Store the account data in localStorage
        localStorage.setItem('switchToAccount', JSON.stringify(switchToAccount));

        // Set authenticated cookie to maintain logged-in state
        Cookies.set('authenticated', 'true', { expires: 7 });

        // Set a user session cookie with minimal data
        Cookies.set('userSession', JSON.stringify({
          uid: switchToAccount.uid,
          username: switchToAccount.username,
          email: switchToAccount.email
        }), { expires: 7 });

        // Update saved accounts to ensure only this one is current
        try {
          const savedAccountsJson = localStorage.getItem('savedAccounts');
          if (savedAccountsJson) {
            const savedAccounts = JSON.parse(savedAccountsJson);
            const updatedAccounts = savedAccounts.map(account => ({
              ...account,
              isCurrent: account.uid === switchToAccount.uid
            }));
            localStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
          }
        } catch (error) {
          console.error('Error updating saved accounts:', error);
        }

        // Immediately redirect to home page
        window.location.href = '/';
      } catch (error) {
        console.error('Error switching account:', error);
        setError('Error switching account. Please try again.');
        setTimeout(() => router.push('/'), 1000);
      }
    };

    switchAccount();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Switching Account...</h1>
        <p className="text-muted-foreground mb-4">
          Please wait while we switch your account.
        </p>
        {error && (
          <p className="text-red-500 mt-4">{error}</p>
        )}
      </div>
    </div>
  );
}
