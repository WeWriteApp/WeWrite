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

        // Get the auth token from multiple sources
        setStatus('Getting authentication token...');
        let authToken = switchToAccount.authToken ||
                       localStorage.getItem('lastAuthToken') ||
                       Cookies.get('session');

        // If we have an auth token, add it to the account data
        if (authToken) {
          console.log('Found auth token, setting in account data');
          switchToAccount.authToken = authToken;

          // Also set it in a cookie for API requests
          Cookies.set('session', authToken, { expires: 7 });

          // Try to sign in with the token if it's a custom token
          if (authToken.length > 500) { // Custom tokens are typically very long
            try {
              setStatus('Signing in with token...');
              await signInWithCustomToken(auth, authToken);
              console.log('Successfully signed in with custom token');
            } catch (tokenError) {
              console.error('Error signing in with custom token:', tokenError);
              // Continue anyway, we'll use the session-based auth
            }
          }
        } else {
          console.warn('No auth token found for account switching');
        }

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
