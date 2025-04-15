"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function SwitchAccountPage() {
  const router = useRouter();

  useEffect(() => {
    const switchAccount = async () => {
      try {
        // Get the account to switch to from localStorage
        const switchToAccountJson = localStorage.getItem('switchToAccount');

        if (!switchToAccountJson) {
          console.error('No account to switch to found');
          router.push('/');
          return;
        }

        const switchToAccount = JSON.parse(switchToAccountJson);
        console.log('Switching to account:', switchToAccount.username || switchToAccount.email);

        // In a real implementation, you would use proper auth tokens or credentials
        // For now, we'll just redirect back to home and rely on the AuthProvider
        // to handle the account switching based on the localStorage data

        // Make sure the account is marked as current
        switchToAccount.isCurrent = true;

        // Store the account data in localStorage for the AuthProvider to use
        localStorage.setItem('switchToAccount', JSON.stringify(switchToAccount));

        // Set a flag to indicate we're in the middle of an account switch
        // This helps prevent the AuthProvider from clearing user state
        localStorage.setItem('accountSwitchInProgress', 'true');

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

        // Always redirect to home page after switching accounts
        router.push('/');
      } catch (error) {
        console.error('Error switching account:', error);
        router.push('/');
      }
    };

    switchAccount();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Switching Account...</h1>
        <p className="text-muted-foreground">Please wait while we switch your account.</p>
      </div>
    </div>
  );
}
