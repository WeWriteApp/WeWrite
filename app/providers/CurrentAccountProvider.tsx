"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { UserAccount, CurrentAccountContextValue, SessionError, SESSION_ERROR_CODES } from '../types/account';
import { useMultiAuth } from './MultiAuthProvider';
import Cookies from 'js-cookie';
import { auth } from '../firebase/config';
import { reload } from 'firebase/auth';

// Safety check for auth object
if (!auth && process.env.NODE_ENV === 'development') {
  console.warn('[CurrentAccountProvider] Auth object not available in development mode');
}

// Create context
const CurrentAccountContext = createContext<CurrentAccountContextValue | null>(null);

// Custom hook to use the context
export const useCurrentAccount = (): CurrentAccountContextValue => {
  const context = useContext(CurrentAccountContext);
  if (!context) {
    throw new Error('useCurrentAccount must be used within a CurrentAccountProvider');
  }
  return context;
};

interface CurrentSessionProviderProps {
  children: ReactNode;
}

export const CurrentAccountProvider: React.FC<CurrentSessionProviderProps> = ({ children }) => {
  const multiAuth = useMultiAuth();

  // State with logging
  const [currentAccount, setCurrentSession] = useState<UserAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);



  // Storage key for active account
  const ACTIVE_SESSION_KEY = 'wewrite_active_session_id';

  // Helper function to set authentication cookies
  const setAuthenticationCookies = useCallback((session: UserAccount | null) => {
    if (session) {
      Cookies.set('authenticated', 'true', { expires: 7 });
      Cookies.set('userSession', JSON.stringify({
        uid: session.uid,
        email: session.email,
        username: session.username,
        displayName: session.displayName || session.username,
        emailVerified: session.emailVerified ?? false // Include email verification status
      }), { expires: 7 });
    } else {
      Cookies.remove('authenticated');
      Cookies.remove('userSession');
      Cookies.remove('session');
    }
  }, []);

  // Storage utilities
  const saveActiveSessionToStorage = useCallback((sessionId: string | null) => {
    try {
      if (typeof window === 'undefined') return;
      if (sessionId) {
        localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
      } else {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    } catch (err) {
      // Silent error
    }
  }, []);

  const loadActiveSessionFromStorage = useCallback((): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(ACTIVE_SESSION_KEY);
    } catch (err) {
      return null;
    }
  }, []);

  // Update email verification status from Firebase auth
  const updateEmailVerificationStatus = useCallback(async () => {
    // Skip in development environment to avoid Firebase auth issues
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    if (!currentAccount || !auth?.currentUser) return;

    try {
      // Reload Firebase user to get latest verification status
      await reload(auth.currentUser);
      const isVerified = auth.currentUser.emailVerified;

      // Update session if verification status changed
      if (currentAccount.emailVerified !== isVerified) {
        await multiAuth.updateSession(currentAccount.sessionId, { emailVerified: isVerified });

        // Update local state
        const updatedSession = multiAuth.getSession(currentAccount.sessionId);
        if (updatedSession) {
          setCurrentSession(updatedSession);
          setAuthenticationCookies(updatedSession);
        }
      }
    } catch (error) {
      // Silent error
      console.warn('Error updating email verification status:', error);
    }
  }, [currentAccount, multiAuth, setAuthenticationCookies]);

  // Hydration management
  const markAsHydrated = useCallback(() => {
    setIsHydrated(true);
  }, []);

  // Switch to a specific session
  const switchAccount = useCallback(async (sessionId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const session = multiAuth.getSession(sessionId);
      if (!session) {
        throw new SessionError('Session not found', SESSION_ERROR_CODES.SESSION_NOT_FOUND, sessionId);
      }

      // Update the previous active account to mark it as inactive
      if (currentAccount) {
        await multiAuth.updateSession(currentAccount.sessionId, { isActive: false });
      }

      // Mark the new session as active
      await multiAuth.updateSession(sessionId, { isActive: true });

      // Update local state
      const updatedSession = multiAuth.getSession(sessionId);
      setCurrentSession(updatedSession);

      // Set authentication cookies for middleware compatibility
      setAuthenticationCookies(updatedSession);

      // Save to storage
      saveActiveSessionToStorage(sessionId);

      // Session switched successfully
    } catch (err) {
      const error = err instanceof SessionError ? err : new SessionError('Failed to switch session', SESSION_ERROR_CODES.STORAGE_ERROR, sessionId);
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [multiAuth, currentAccount, saveActiveSessionToStorage, setAuthenticationCookies]);

  // Switch to session by UID
  const switchAccountByUid = useCallback(async (uid: string): Promise<void> => {
    const session = multiAuth.getSessionByUid(uid);
    if (!session) {
      throw new SessionError('Session not found for UID', SESSION_ERROR_CODES.SESSION_NOT_FOUND, uid);
    }
    await switchAccount(session.sessionId);
  }, [multiAuth, switchAccount]);

  // Clear active account
  const signOutCurrent = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Mark current account as inactive
      if (currentAccount) {
        await multiAuth.updateSession(currentAccount.sessionId, { isActive: false });
      }

      // Clear local state
      setCurrentSession(null);

      // Clear authentication cookies
      setAuthenticationCookies(null);

      // Clear from storage
      saveActiveSessionToStorage(null);

      console.log('Cleared active account');
    } catch (err) {
      const error = new SessionError('Failed to clear active account', SESSION_ERROR_CODES.STORAGE_ERROR);
      setError(error.message);
      console.error('Failed to clear active account:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount, multiAuth, saveActiveSessionToStorage, setAuthenticationCookies]);

  // Refresh active account
  const refreshActiveAccount = useCallback(async (): Promise<void> => {
    if (!currentAccount) return;

    try {
      setError(null);
      const refreshedSession = await multiAuth.refreshSession(currentAccount.sessionId);
      setCurrentSession(refreshedSession);
    } catch (err) {
      const error = err instanceof SessionError ? err : new SessionError('Failed to refresh session', SESSION_ERROR_CODES.STORAGE_ERROR);
      setError(error.message);
      console.error('Failed to refresh active account:', error);
      throw error;
    }
  }, [currentAccount, multiAuth]);

  // Update active account
  const updateActiveAccount = useCallback(async (updates: Partial<UserAccount>): Promise<void> => {
    if (!currentAccount) {
      throw new SessionError('No active account to update', SESSION_ERROR_CODES.SESSION_NOT_FOUND);
    }

    try {
      setError(null);
      await multiAuth.updateSession(currentAccount.sessionId, updates);
      const updatedSession = multiAuth.getSession(currentAccount.sessionId);
      setCurrentSession(updatedSession);
    } catch (err) {
      const error = err instanceof SessionError ? err : new SessionError('Failed to update session', SESSION_ERROR_CODES.STORAGE_ERROR);
      setError(error.message);
      console.error('Failed to update active account:', error);
      throw error;
    }
  }, [currentAccount, multiAuth]);

  // Load active account on mount
  useEffect(() => {
    const loadActiveSession = async () => {
      try {
        setIsLoading(true);

        const activeSessionId = loadActiveSessionFromStorage();
        if (activeSessionId) {
          const session = multiAuth.getSession(activeSessionId);
          if (session) {
            // Verify the session is still valid
            const now = Date.now();
            const sessionAge = now - new Date(session.createdAt).getTime();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

            if (sessionAge < maxAge) {
              console.log('🔵 CurrentAccountProvider: Setting current session:', {
                uid: session.uid,
                email: session.email,
                username: session.username,
                isActive: session.isActive,
                sessionAge: Math.round(sessionAge / 1000 / 60) + ' minutes'
              });
              setCurrentSession(session);
              // Set authentication cookies for middleware compatibility
              setAuthenticationCookies(session);

              // DISABLE SESSION UPDATES TO PREVENT INFINITE LOOP
              // The session updates were causing the session object to be recreated
              // which triggered infinite re-renders. We'll skip these updates for now.
              console.log('CurrentAccountProvider: Skipping session update to prevent infinite loop');
            } else {
              // Session expired, clear it
              await multiAuth.removeSession(activeSessionId);
              saveActiveSessionToStorage(null);
            }
          } else {
            // Session not found in bag, clear storage
            saveActiveSessionToStorage(null);
          }
        } else {
          // No active session in localStorage, check if we have server-side authentication
          console.log('CurrentAccountProvider: No active session found, checking for server-side auth');
          await checkAndSyncServerAuth();
        }
      } catch (err) {
        console.error('Failed to load active account:', err);
        setError('Failed to load active account');
      } finally {
        setIsLoading(false);
        markAsHydrated();
      }
    };

    // Only run once when multiAuth becomes ready and we haven't hydrated yet
    if (!multiAuth.isLoading && !isHydrated) {
      loadActiveSession();
    }
  }, [multiAuth.isLoading, isHydrated]);

  // Helper function to check server-side auth and sync with client-side sessions
  const checkAndSyncServerAuth = useCallback(async () => {
    try {
      // Check if we have server-side authentication by calling an API that requires auth
      const response = await fetch('/api/account-subscription');

      if (response.ok) {
        // We have server-side auth, check if we have user session cookie
        const userSessionCookie = Cookies.get('userSession');
        if (userSessionCookie) {
          try {
            const userData = JSON.parse(userSessionCookie);
            console.log('CurrentAccountProvider: Found server-side auth, creating client-side session for:', userData.uid);

            // Check if we already have a session for this user to prevent infinite loops
            const existingSession = multiAuth.getSessionByUid(userData.uid);
            if (existingSession) {
              console.log('CurrentAccountProvider: Session already exists for user, switching to it');
              await switchAccount(existingSession.sessionId);
              return;
            }

            // Create a client-side session to match the server-side auth
            const sessionData = {
              uid: userData.uid,
              email: userData.email || '',
              username: userData.username || userData.displayName || '',
              displayName: userData.displayName || userData.username || '',
              photoURL: null,
              emailVerified: userData.emailVerified ?? false
            };

            const newSession = await multiAuth.addSession(sessionData);
            console.log('CurrentAccountProvider: Created session:', newSession.sessionId);

            // Switch to this session
            await switchAccount(newSession.sessionId);
            console.log('CurrentAccountProvider: Switched to synced session');
          } catch (parseError) {
            console.error('CurrentAccountProvider: Failed to parse userSession cookie:', parseError);
          }
        }
      } else {
        console.log('CurrentAccountProvider: No server-side authentication found');
      }
    } catch (error) {
      console.error('CurrentAccountProvider: Error checking server-side auth:', error);
    }
  }, [multiAuth, switchAccount]);

  // Periodically check email verification status for unverified users
  useEffect(() => {
    if (!currentAccount || currentAccount.emailVerified) return;

    const checkInterval = setInterval(() => {
      updateEmailVerificationStatus();
    }, 10000); // Check every 10 seconds for unverified users

    return () => clearInterval(checkInterval);
  }, [currentAccount, updateEmailVerificationStatus]);

  // Context value
  const contextValue: CurrentAccountContextValue = useMemo(() => {
    const value = {
      // State
      currentAccount,
      session: currentAccount,
      isAuthenticated: !!currentAccount,
      isEmailVerified: currentAccount?.emailVerified ?? false,
      isLoading,
      isHydrated,
      error,

      // Actions - these are already memoized with useCallback
      switchAccount,
      switchAccountByUid,
      signOutCurrent,
      refreshActiveAccount,
      updateActiveAccount,
      markAsHydrated
    };

    console.log('🔵 CurrentAccountProvider: Context value updated:', {
      hasCurrentAccount: !!currentAccount,
      isAuthenticated: !!currentAccount,
      isLoading,
      isHydrated,
      currentAccountUid: currentAccount?.uid,
      error
    });

    return value;
  }, [currentAccount, isLoading, isHydrated, error]);

  return (
    <CurrentAccountContext.Provider value={contextValue}>
      {children}
    </CurrentAccountContext.Provider>
  );
};