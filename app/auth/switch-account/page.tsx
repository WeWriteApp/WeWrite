"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../firebase/auth";
import Cookies from 'js-cookie';

export default function SwitchAccountPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const completeAccountSwitch = async () => {
      try {
        // Collect debug information
        let debug = {};

        if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined' && typeof localStorage !== 'undefined') {
          debug = {
            isSwitching: sessionStorage.getItem('wewrite_switching'),
            switchToAccount: sessionStorage.getItem('wewrite_switch_to'),
            accounts: sessionStorage.getItem('wewrite_accounts'),
            cookies: {
              userId: Cookies.get('wewrite_user_id'),
              authenticated: Cookies.get('wewrite_authenticated'),
              session: Cookies.get('session'),
              userSession: Cookies.get('userSession')
            },
            currentUser: auth.currentUser ? {
              uid: auth.currentUser.uid,
              email: auth.currentUser.email
            } : null,
            localStorage: {
              switchToAccount: localStorage.getItem('switchToAccount'),
              accountSwitchInProgress: localStorage.getItem('accountSwitchInProgress'),
              savedAccounts: localStorage.getItem('savedAccounts')
            }
          };
        }

        setDebugInfo(debug);

        // Check if we're in the middle of an account switch
        if (typeof sessionStorage === 'undefined' || sessionStorage.getItem('wewrite_switching') !== 'true') {
          setError('No account switch in progress');
          setTimeout(() => router.push('/'), 1000);
          return;
        }

        setStatus('Getting account data...');

        // Get the account to switch to
        const switchToJson = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('wewrite_switch_to') : null;
        if (!switchToJson) {
          setError('No account to switch to found');
          setTimeout(() => router.push('/'), 1000);
          return;
        }

        let switchToAccount;
        try {
          switchToAccount = JSON.parse(switchToJson);
          console.log('Switching to account:', switchToAccount.email);
        } catch (parseError) {
          console.error('Error parsing account data:', parseError);
          setError('Invalid account data');
          setTimeout(() => router.push('/'), 1000);
          return;
        }

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

        // Set cookies for session-based auth
        try {
          Cookies.set('wewrite_user_id', switchToAccount.uid, { expires: 7 });
          Cookies.set('wewrite_authenticated', 'true', { expires: 7 });
          Cookies.set('userSession', JSON.stringify({
            uid: switchToAccount.uid,
            email: switchToAccount.email,
            username: switchToAccount.username
          }), { expires: 7 });
        } catch (cookieError) {
          console.error('Error setting cookies:', cookieError);
          // Continue anyway, as we might still be able to redirect
        }

        // Clear the account switch flags
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('wewrite_switching');
          sessionStorage.removeItem('wewrite_switch_to');
        }

        // Also clear any old localStorage items
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('switchToAccount');
          localStorage.removeItem('accountSwitchInProgress');
        }

        setStatus('Redirecting to home page...');

        // Redirect to home page
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Error switching account:', error);
        setError(`Error switching account: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setTimeout(() => router.push('/'), 2000);
      }
    };

    completeAccountSwitch();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="text-center max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Switching Account...</h1>
        <p className="text-muted-foreground mb-4">
          {status}
        </p>
        {error && (
          <div className="bg-red-100 text-red-800 p-4 rounded-md mb-4">
            <p className="font-bold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Debug information - only shown when URL has ?debug=true */}
        {typeof window !== 'undefined' &&
         typeof window.location !== 'undefined' &&
         typeof window.location.search === 'string' &&
         window.location.search.includes('debug=true') && (
          <div className="mt-8 text-left bg-gray-100 p-4 rounded-md overflow-auto max-h-96">
            <h2 className="text-lg font-semibold mb-2">Debug Information</h2>
            <pre className="text-xs whitespace-pre-wrap">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
