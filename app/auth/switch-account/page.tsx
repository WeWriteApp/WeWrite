"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthManager from "../../utils/AuthManager";
import { auth } from "../../firebase/auth";

export default function SwitchAccountPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Initializing...');

  useEffect(() => {
    const completeAccountSwitch = async () => {
      try {
        // Check if we're in the middle of an account switch
        if (sessionStorage.getItem('accountSwitch') !== 'true') {
          setError('No account switch in progress');
          setTimeout(() => router.push('/'), 1000);
          return;
        }

        setStatus('Getting account data...');

        // Get the current account from AuthManager
        const currentAccount = AuthManager.getCurrentAccount();

        if (!currentAccount) {
          setError('No account to switch to found');
          setTimeout(() => router.push('/'), 1000);
          return;
        }

        console.log('Switching to account:', currentAccount.email);

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

        // Clear the account switch flag
        sessionStorage.removeItem('accountSwitch');

        setStatus('Setting up session...');

        // Redirect to home page
        setStatus('Redirecting to home page...');
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
