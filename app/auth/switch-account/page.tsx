"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setCurrentUser } from "../../utils/currentUser";
import { auth } from "../../firebase/auth";
import { signInWithCustomToken } from "firebase/auth";
import Cookies from 'js-cookie';

export default function SwitchAccountPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Initializing...');

  useEffect(() => {
    const switchAccount = async () => {
      try {
        setStatus('Getting account data...');
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

        // We'll avoid trying to get the token directly to prevent browser extension issues
        setStatus('Setting up authentication...');

        // Instead of trying to get the token, we'll just set up the user session
        // and let the auth provider handle the authentication

        // First, check if the user is already signed in with Firebase
        if (auth.currentUser && auth.currentUser.uid !== switchToAccount.uid) {
          // If a different user is signed in, sign them out first
          setStatus('Signing out current user...');
          try {
            await auth.signOut();
            console.log('Signed out current user');
          } catch (signOutError) {
            console.error('Error signing out current user:', signOutError);
            // Continue anyway
          }
        }

        // Set the authenticated cookie to maintain session-based auth
        Cookies.set('authenticated', 'true', { expires: 7 });

        // Set a flag to indicate we're using session-based auth
        switchToAccount.useSessionAuth = true;

        setStatus('Setting current user...');
        // Use the centralized utility to set the current user
        setCurrentUser(switchToAccount);

        // Clean up the localStorage
        localStorage.removeItem('switchToAccount');
        localStorage.removeItem('lastAuthToken');
        localStorage.removeItem('accountSwitchInProgress');

        setStatus('Redirecting to home page...');
        // Immediately redirect to home page
        window.location.href = '/';
      } catch (error) {
        console.error('Error switching account:', error);
        setError(`Error switching account: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setTimeout(() => router.push('/'), 2000);
      }
    };

    switchAccount();
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
