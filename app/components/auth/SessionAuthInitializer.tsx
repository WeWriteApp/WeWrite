"use client";

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getEnvironmentAwareAuth } from '../../firebase/environmentAwareConfig';
import { isDevelopmentAuthActive, getGlobalAuthWrapper } from '../../firebase/authWrapper';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useMultiAuth } from '../../providers/MultiAuthProvider';
import { transferLoggedOutAllocationsToUser } from '../../utils/simulatedTokens';
import Cookies from 'js-cookie';

interface SessionAuthInitializerProps {
  children: React.ReactNode;
}

/**
 * SessionAuthInitializer - Connects Firebase auth to session management
 * 
 * This component:
 * - Listens for Firebase auth state changes
 * - Creates/updates sessions when users sign in
 * - Switches to the appropriate session
 * - Handles account switching events
 * - Replaces the old AuthInitializer
 */
function SessionAuthInitializer({ children }: SessionAuthInitializerProps) {
  const [isClient, setIsClient] = useState(false);
  const { switchAccountByUid, signOutCurrent } = useCurrentAccount();
  const { addSession, getSessionByUid, updateSession } = useMultiAuth();

  // Set client flag after hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Create stable references to prevent useEffect from re-running
  const switchToSessionByUidRef = useRef(switchAccountByUid);
  const clearActiveSessionRef = useRef(signOutCurrent);
  const addSessionRef = useRef(addSession);
  const updateSessionRef = useRef(updateSession);

  // Update refs when functions change
  switchToSessionByUidRef.current = switchAccountByUid;
  clearActiveSessionRef.current = signOutCurrent;
  addSessionRef.current = addSession;
  updateSessionRef.current = updateSession;

  // Helper function to create session cookies for middleware compatibility
  const createSessionCookies = useCallback(async (firebaseUser: User) => {
    try {
      console.log('SessionAuthInitializer: Creating session cookies for user:', firebaseUser.uid);

      // Get the Firebase ID token
      const idToken = await firebaseUser.getIdToken();

      // Call the API to create a session cookie
      const response = await fetch('/api/create-session-cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (response.ok) {
        console.log('SessionAuthInitializer: Session cookie created successfully');

        // Also set the authenticated cookie for backward compatibility
        Cookies.set('authenticated', 'true', { expires: 7 });

        // Set user session cookie with user data
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
          emailVerified: firebaseUser.emailVerified
        };
        Cookies.set('userSession', JSON.stringify(userData), { expires: 7 });

        console.log('SessionAuthInitializer: Authentication cookies set');
      } else {
        console.error('SessionAuthInitializer: Failed to create session cookie:', await response.text());
      }
    } catch (error) {
      console.error('SessionAuthInitializer: Error creating session cookies:', error);
    }
  }, []);

  // Helper function to clear session cookies
  const clearSessionCookies = useCallback(() => {
    console.log('SessionAuthInitializer: Clearing session cookies');
    Cookies.remove('session');
    Cookies.remove('authenticated');
    Cookies.remove('userSession');
  }, []);

  // Create a session from Firebase user data
  const createSessionFromFirebaseUser = useCallback(async (firebaseUser: User) => {
    try {
      console.log('SessionAuthInitializer: Creating session for new user:', firebaseUser.uid);

      const sessionData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
        photoURL: firebaseUser.photoURL || null,
        emailVerified: firebaseUser.emailVerified};

      const newSession = await addSession(sessionData);
      console.log('SessionAuthInitializer: Session created:', newSession.sessionId);

      // Wait for session to be available in the session store with optimized retry logic
      let retries = 0;
      const maxRetries = 5; // Reduced from 10 to minimize auth overhead
      let sessionFound = false;
      while (retries < maxRetries) {
        const session = getSessionByUid(firebaseUser.uid);
        if (session) {
          console.log('SessionAuthInitializer: Session found in store, switching to it');
          sessionFound = true;
          break;
        }
        console.log(`SessionAuthInitializer: Session not yet available, retrying... (${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 200)); // Increased delay to reduce rapid retries
        retries++;
      }

      if (!sessionFound) {
        throw new Error(`Session not found in store after ${maxRetries} retries`);
      }

      // Switch to the newly created session
      await switchAccountByUid(firebaseUser.uid);
      console.log('SessionAuthInitializer: Switched to new session for user:', firebaseUser.uid);

      // Create session cookies for middleware compatibility
      await createSessionCookies(firebaseUser);

      // Transfer any logged-out token allocations to the new user account
      try {
        const transferResult = transferLoggedOutAllocationsToUser(firebaseUser.uid);
        if (transferResult.success && transferResult.transferredCount > 0) {
          console.log(`SessionAuthInitializer: Transferred ${transferResult.transferredCount} token allocations from logged-out state to user ${firebaseUser.uid}`);
        }
      } catch (transferError) {
        console.warn('SessionAuthInitializer: Failed to transfer logged-out token allocations:', transferError);
        // Don't fail the login process if token transfer fails
      }

      return newSession;
    } catch (error) {
      console.error('SessionAuthInitializer: Failed to create session for user:', firebaseUser.uid, error);
      throw error;
    }
  }, [addSession, switchAccountByUid, createSessionCookies]);

  // Handle Firebase auth state changes
  useEffect(() => {
    // Only run on client side after hydration
    if (!isClient) {
      console.log('🔥 SessionAuthInitializer: Skipping Firebase auth setup - not client yet');
      return;
    }

    console.log('🔥 SessionAuthInitializer: Setting up Firebase auth listener on client');
    console.log('🔥 SessionAuthInitializer: Firebase auth object:', auth);
    console.log('🔥 SessionAuthInitializer: Current user:', auth.currentUser);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      try {
        if (firebaseUser) {
          console.log('SessionAuthInitializer: User signed in:', firebaseUser.uid);

          // Check if we're on a login page and if this is an automatic detection vs. actual login
          // This prevents the sign-in flow bypass issue while allowing actual logins
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          const isOnLoginPage = currentPath.startsWith('/auth/login') || currentPath.startsWith('/auth/register');
          const authRedirectPending = typeof window !== 'undefined' ? localStorage.getItem('authRedirectPending') : null;

          if (isOnLoginPage && !authRedirectPending) {
            console.log('SessionAuthInitializer: On login page without pending auth, skipping automatic session switch to prevent bypass');
            return;
          }

          try {
            // Try to switch to this user's existing session
            console.log('SessionAuthInitializer: Attempting to switch to existing session for user:', firebaseUser.uid);

            // Update email verification status for existing session
            const existingSession = getSessionByUid(firebaseUser.uid);
            if (existingSession && existingSession.emailVerified !== firebaseUser.emailVerified) {
              console.log('SessionAuthInitializer: Updating email verification status for existing session');
              await updateSessionRef.current(existingSession.sessionId, {
                emailVerified: firebaseUser.emailVerified
              });
            }

            await switchToSessionByUidRef.current(firebaseUser.uid);
            console.log('SessionAuthInitializer: Session switched for existing user:', firebaseUser.uid);

            // Create session cookies for middleware compatibility
            await createSessionCookies(firebaseUser);

            // Transfer any logged-out token allocations to the existing user account
            try {
              const transferResult = transferLoggedOutAllocationsToUser(firebaseUser.uid);
              if (transferResult.success && transferResult.transferredCount > 0) {
                console.log(`SessionAuthInitializer: Transferred ${transferResult.transferredCount} token allocations from logged-out state to existing user ${firebaseUser.uid}`);
              }
            } catch (transferError) {
              console.warn('SessionAuthInitializer: Failed to transfer logged-out token allocations for existing user:', transferError);
              // Don't fail the login process if token transfer fails
            }

            // Handle redirect after successful login
            if (isOnLoginPage && authRedirectPending) {
              console.log('SessionAuthInitializer: Login successful, redirecting to home page');
              localStorage.removeItem('authRedirectPending');
              // Immediate redirect without delay to prevent showing login page
              window.location.href = "/";
            }
          } catch (sessionError) {
            // If no session exists for this user, create a new one
            console.log('SessionAuthInitializer: No session found for user, creating new session:', firebaseUser.uid);
            console.log('SessionAuthInitializer: Session error details:', sessionError);
            try {
              await createSessionFromFirebaseUser(firebaseUser);

              // Handle redirect after successful new session creation
              if (isOnLoginPage && authRedirectPending) {
                console.log('SessionAuthInitializer: New session created, redirecting to home page');
                localStorage.removeItem('authRedirectPending');
                // Immediate redirect without delay to prevent showing login page
                window.location.href = "/";
              }
            } catch (createError) {
              console.error('SessionAuthInitializer: Failed to create session for user:', firebaseUser.uid, createError);
              // If session creation fails, clear any active account
              await clearActiveSessionRef.current();
            }
          }
        } else {
          console.log('SessionAuthInitializer: User signed out');
          // Clear session cookies
          clearSessionCookies();
          // Clear active account when user signs out
          await clearActiveSessionRef.current();
        }
      } catch (error) {
        console.error('SessionAuthInitializer: Error handling auth state change:', error);
      }
    });

    return () => {
      console.log('SessionAuthInitializer: Cleaning up Firebase auth listener');
      unsubscribe();
    };
  }, [isClient, createSessionCookies, clearSessionCookies]); // Include cookie functions in dependencies

  // Handle account switching events from AccountSwitcher (simplified for now)
  useEffect(() => {
    const handleAccountSwitch = async (event: CustomEvent) => {
      try {
        const newUser = event.detail;
        console.log('SessionAuthInitializer: Account switch event received:', newUser);

        if (!newUser || !newUser.uid || !newUser.email) {
          console.error('SessionAuthInitializer: Invalid account switch data received');
          return;
        }

        // Switch to the new user's session
        await switchAccountByUid(newUser.uid);
        console.log('SessionAuthInitializer: Account switch complete');
      } catch (error) {
        console.error('SessionAuthInitializer: Error handling account switch:', error);
      }
    };

    // Listen for account switch events
    window.addEventListener('accountSwitch', handleAccountSwitch as EventListener);

    return () => {
      window.removeEventListener('accountSwitch', handleAccountSwitch as EventListener);
    };
  }, [switchAccountByUid]);

  return <>{children}</>;
}

export default SessionAuthInitializer;