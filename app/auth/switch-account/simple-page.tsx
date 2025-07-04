"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/components/auth";
import Cookies from 'js-cookie';

export default function SimpleSwitchAccountPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const completeAccountSwitch = async () => {
      try {
        // Collect debug information
        const debug = {
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
          } : null
        };
        
        setDebugInfo(debug);
        
        // Check if we're in the middle of an account switch
        if (sessionStorage.getItem('wewrite_switching') !== 'true') {
          setError('No account switch in progress');
          setTimeout(() => router.push('/'), 1000);
          return;
        }

        setStatus('Getting account data...');
        
        // Get the account to switch to
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
        
        // Set cookies for session-based auth (using standard WeWrite auth cookies)
        Cookies.set('authenticated', 'true', { expires: 7 });
        Cookies.set('userSession', JSON.stringify({
          uid: switchToAccount.uid,
          email: switchToAccount.email,
          username: switchToAccount.username
        }), { expires: 7 });
        
        // Clear the account switch flags
        sessionStorage.removeItem('wewrite_switching');
        sessionStorage.removeItem('wewrite_switch_to');
        
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
        
        <div className="mt-8 text-left bg-gray-100 p-4 rounded-md overflow-auto max-h-96">
          <h2 className="text-lg font-semibold mb-2">Debug Information</h2>
          <pre className="text-xs whitespace-pre-wrap">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}