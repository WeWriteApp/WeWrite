"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { UserAccount, CurrentAccountContextValue, SessionError, SESSION_ERROR_CODES } from '../types/account';
import { useMultiAuth } from './MultiAuthProvider';

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
  
  // State
  const [currentAccount, setCurrentSession] = useState<UserAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Storage key for active account
  const ACTIVE_SESSION_KEY = 'wewrite_active_session_id';

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
      console.error('Failed to save active account to storage:', err);
    }
  }, []);

  const loadActiveSessionFromStorage = useCallback((): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(ACTIVE_SESSION_KEY);
    } catch (err) {
      console.error('Failed to load active account from storage:', err);
      return null;
    }
  }, []);

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

      // Save to storage
      saveActiveSessionToStorage(sessionId);

      console.log(`Switched to session: ${session.username || session.email} (${sessionId})`);
    } catch (err) {
      const error = err instanceof SessionError ? err : new SessionError('Failed to switch session', SESSION_ERROR_CODES.STORAGE_ERROR, sessionId);
      setError(error.message);
      console.error('Failed to switch session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [multiAuth, currentAccount, saveActiveSessionToStorage]);

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
  }, [currentAccount, multiAuth, saveActiveSessionToStorage]);

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
              setCurrentSession(session);
              await multiAuth.updateSession(session.sessionId, {
                isActive: true,
                lastActiveAt: new Date().toISOString()
              });
            } else {
              // Session expired, clear it
              await multiAuth.removeSession(activeSessionId);
              saveActiveSessionToStorage(null);
            }
          } else {
            // Session not found in bag, clear storage
            saveActiveSessionToStorage(null);
          }
        }
      } catch (err) {
        console.error('Failed to load active account:', err);
        setError('Failed to load active account');
      } finally {
        setIsLoading(false);
        markAsHydrated();
      }
    };

    if (!multiAuth.isLoading) {
      loadActiveSession();
    }
  }, [multiAuth.isLoading]); // Only depend on isLoading to avoid infinite loops

  // Context value
  const contextValue: CurrentAccountContextValue = useMemo(() => ({
    // State
    currentAccount,
    session: currentAccount, // Alias for backward compatibility
    isAuthenticated: !!currentAccount, // Computed from currentAccount
    isLoading,
    isHydrated,
    error,

    // Actions
    switchAccount,
    switchAccountByUid,
    signOutCurrent,
    refreshActiveAccount,
    updateActiveAccount,
    markAsHydrated}), [
    currentAccount,
    isLoading,
    isHydrated,
    error,
    switchAccount,
    switchAccountByUid,
    signOutCurrent,
    refreshActiveAccount,
    updateActiveAccount,
    markAsHydrated,
  ]);

  return (
    <CurrentAccountContext.Provider value={contextValue}>
      {children}
    </CurrentAccountContext.Provider>
  );
};