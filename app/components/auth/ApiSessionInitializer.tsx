"use client";

/**
 * API-Based Session Initializer
 * 
 * This component replaces SessionAuthInitializer and uses API calls instead
 * of direct Firebase Auth calls to ensure proper environment separation.
 * 
 * It handles:
 * - Session detection and management through APIs
 * - Environment-aware authentication
 * - Development vs production session handling
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useMultiAuth } from '../../providers/MultiAuthProvider';
import { transferLoggedOutAllocationsToUser } from '../../utils/simulatedTokens';
import Cookies from 'js-cookie';

interface ApiSessionInitializerProps {
  children: React.ReactNode;
}

/**
 * API-based session initializer that doesn't use direct Firebase calls
 */
function ApiSessionInitializer({ children }: ApiSessionInitializerProps) {
  const [isClient, setIsClient] = useState(false);
  const { currentAccount, switchAccountByUid, signOutCurrent } = useCurrentAccount();
  const { addSession, getSessionByUid, updateSession } = useMultiAuth();

  // Set client flag after hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Session management functions
  const createSessionCookies = useCallback((sessionData: any) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    Cookies.set('currentUser', JSON.stringify(sessionData), {
      expires,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    Cookies.set('userSession', JSON.stringify(sessionData), {
      expires,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  }, []);

  const clearSessionCookies = useCallback(() => {
    Cookies.remove('currentUser');
    Cookies.remove('userSession');
    Cookies.remove('devUserSession');
    Cookies.remove('authToken');
  }, []);

  const clearActiveSessionRef = useRef(async () => {
    try {
      await signOutCurrent();
    } catch (error) {
      console.error('ApiSessionInitializer: Error clearing active session:', error);
    }
  });

  /**
   * Create session from API user data
   */
  const createSessionFromApiUser = useCallback(async (userData: any) => {
    try {
      console.log('ApiSessionInitializer: Creating session from API user data:', userData.uid);

      // Transfer any logged-out allocations to the user
      await transferLoggedOutAllocationsToUser(userData.uid);

      // Create session data
      const sessionData = {
        uid: userData.uid,
        email: userData.email,
        username: userData.username,
        displayName: userData.displayName,
        emailVerified: userData.emailVerified,
        isDevelopment: userData.isDevelopment || false,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      // Create session cookies
      createSessionCookies(sessionData);

      // Add to session store (now waits for session to be available)
      const newSession = await addSession(sessionData);
      console.log('ApiSessionInitializer: Session created and available:', newSession.sessionId);

      // Verify session is available in store
      const session = getSessionByUid(userData.uid);
      if (!session) {
        throw new Error(`Session not found in store after creation: ${userData.uid}`);
      }

      // Switch to the new session
      await switchAccountByUid(userData.uid);
      console.log('ApiSessionInitializer: Successfully switched to session:', userData.uid);

    } catch (error) {
      console.error('ApiSessionInitializer: Error creating session from API user:', error);
      throw error;
    }
  }, [addSession, getSessionByUid, switchAccountByUid, createSessionCookies]);

  /**
   * Check for existing session via API
   */
  const checkExistingSession = useCallback(async () => {
    try {
      console.log('ApiSessionInitializer: Checking for existing session via API');

      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.isAuthenticated) {
          console.log('ApiSessionInitializer: Found existing session:', result.data.session.uid);

          // Check if session exists in store
          const existingSession = getSessionByUid(result.data.session.uid);
          if (existingSession) {
            // PREVENT INFINITE LOOP: Only switch if it's not already the current session
            // We can't directly access currentAccount here, so we'll check if the session
            // is already active to avoid unnecessary switches
            console.log('ApiSessionInitializer: Session already in store, checking if switch needed');

            // Check if the session is active AND CurrentAccountProvider actually has it
            // We need to ensure both conditions are met to prevent infinite loops
            // while also ensuring proper session synchronization
            const currentAccountHasSession = currentAccount?.uid === result.data.session.uid;

            if (!existingSession.isActive || !currentAccountHasSession) {
              if (!existingSession.isActive) {
                console.log('🔵 ApiSessionInitializer: Session not active, switching to it');
              } else {
                console.log('🔵 ApiSessionInitializer: Session active but CurrentAccountProvider missing it, forcing sync');
              }
              await switchAccountByUid(result.data.session.uid);
            } else {
              console.log('🔵 ApiSessionInitializer: Session already active and CurrentAccountProvider has it, skipping switch');
            }
          } else {
            console.log('ApiSessionInitializer: Session not in store, creating new session');
            await createSessionFromApiUser(result.data.session);
          }

          return true;
        }
      }

      console.log('ApiSessionInitializer: No existing session found');
      return false;

    } catch (error) {
      // Handle specific error types gracefully
      if (error.code === 'SESSION_NOT_FOUND' || error.name === 'SessionError') {
        console.log('ApiSessionInitializer: No existing session found (expected)');
        return false;
      }

      console.error('ApiSessionInitializer: Error checking existing session:', error);
      return false;
    }
  }, [getSessionByUid, switchAccountByUid, createSessionFromApiUser]);

  /**
   * Poll for session changes (replaces Firebase auth state listener)
   */
  useEffect(() => {
    if (!isClient) return;

    console.log('ApiSessionInitializer: Setting up API-based session monitoring');

    let pollInterval: NodeJS.Timeout;
    let isPolling = false;

    const pollForSessionChanges = async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        await checkExistingSession();
      } catch (error) {
        console.error('ApiSessionInitializer: Error during session polling:', error);
      } finally {
        isPolling = false;
      }
    };

    // Initial session check
    pollForSessionChanges();

    // Poll every 5 minutes for session changes (further optimized for cost reduction)
    pollInterval = setInterval(pollForSessionChanges, 300000);

    // Listen for storage events (when user logs in/out in another tab)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'currentUser' || event.key === 'userSession') {
        console.log('ApiSessionInitializer: Storage change detected, checking session');
        pollForSessionChanges();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      console.log('ApiSessionInitializer: Cleaning up API session monitoring');
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isClient, checkExistingSession]);

  return <>{children}</>;
}

export default ApiSessionInitializer;
