"use client";

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useMultiAuth } from '../../providers/MultiAuthProvider';
import { transferLoggedOutAllocationsToUser } from '../../utils/simulatedTokens';

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
  console.log('🔥 SessionAuthInitializer: Component mounted');
  console.log('🔥 SessionAuthInitializer: typeof window:', typeof window);

  const [isClient, setIsClient] = useState(false);
  const { switchAccountByUid, signOutCurrent } = useCurrentAccount();
  const { addSession } = useMultiAuth();

  // Set client flag after hydration
  useEffect(() => {
    console.log('🔥 SessionAuthInitializer: Setting client flag');
    setIsClient(true);
  }, []);

  // Create stable references to prevent useEffect from re-running
  const switchToSessionByUidRef = useRef(switchAccountByUid);
  const clearActiveSessionRef = useRef(signOutCurrent);
  const addSessionRef = useRef(addSession);

  // Update refs when functions change
  switchToSessionByUidRef.current = switchAccountByUid;
  clearActiveSessionRef.current = signOutCurrent;
  addSessionRef.current = addSession;

  // Create a session from Firebase user data
  const createSessionFromFirebaseUser = useCallback(async (firebaseUser: User) => {
    try {
      console.log('SessionAuthInitializer: Creating session for new user:', firebaseUser.uid);

      const sessionData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
        photoURL: firebaseUser.photoURL || null};

      const newSession = await addSession(sessionData);
      console.log('SessionAuthInitializer: Session created:', newSession.sessionId);

      // Add a small delay to ensure session is fully saved before switching
      await new Promise(resolve => setTimeout(resolve, 100));

      // Switch to the newly created session
      await switchAccountByUid(firebaseUser.uid);
      console.log('SessionAuthInitializer: Switched to new session for user:', firebaseUser.uid);

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
  }, [addSession, switchAccountByUid]);

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

          try {
            // Try to switch to this user's existing session
            console.log('SessionAuthInitializer: Attempting to switch to existing session for user:', firebaseUser.uid);
            await switchToSessionByUidRef.current(firebaseUser.uid);
            console.log('SessionAuthInitializer: Session switched for existing user:', firebaseUser.uid);

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
          } catch (sessionError) {
            // If no session exists for this user, create a new one
            console.log('SessionAuthInitializer: No session found for user, creating new session:', firebaseUser.uid);
            console.log('SessionAuthInitializer: Session error details:', sessionError);
            try {
              await createSessionFromFirebaseUser(firebaseUser);
            } catch (createError) {
              console.error('SessionAuthInitializer: Failed to create session for user:', firebaseUser.uid, createError);
              // If session creation fails, clear any active account
              await clearActiveSessionRef.current();
            }
          }
        } else {
          console.log('SessionAuthInitializer: User signed out');
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
  }, [isClient]); // Run when client flag changes

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