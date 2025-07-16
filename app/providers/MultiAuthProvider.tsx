"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { UserAccount, MultiAuthContextValue, SessionError, SESSION_ERROR_CODES } from '../types/account';

// Create context
const MultiAuthContext = createContext<MultiAuthContextValue | null>(null);

// Custom hook to use the context
export const useMultiAuth = (): MultiAuthContextValue => {
  const context = useContext(MultiAuthContext);
  if (!context) {
    throw new Error('useMultiAuth must be used within a MultiAuthProvider');
  }
  return context;
};

interface MultiAuthProviderProps {
  children: ReactNode;
}

export const MultiAuthProvider: React.FC<MultiAuthProviderProps> = ({ children }) => {
  // State
  const [sessions, setSessions] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  // Storage utilities
  const STORAGE_KEY = 'wewrite_sessions';

  const saveToStorage = useCallback((sessions: UserAccount[]) => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (err) {
      console.error('Failed to save sessions to storage:', err);
    }
  }, []);

  const loadFromStorage = useCallback((): UserAccount[] => {
    try {
      if (typeof window === 'undefined') {
        return [];
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Failed to load sessions from storage:', err);
      return [];
    }
  }, []);

  // Generate session ID
  const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Session management actions
  const addSession = useCallback(async (sessionData: Omit<UserAccount, 'sessionId' | 'createdAt' | 'lastActiveAt' | 'isActive'>): Promise<UserAccount> => {
    try {
      const now = new Date().toISOString();
      const newSession: UserAccount = {
        ...sessionData,
        sessionId: generateSessionId(),
        createdAt: now,
        lastActiveAt: now,
        isActive: false,
        isPersistent: true};

      setSessions(prev => {
        const updated = [...prev, newSession];
        saveToStorage(updated);
        return updated;
      });

      return newSession;
    } catch (err) {
      const error = new SessionError('Failed to add session', SESSION_ERROR_CODES.STORAGE_ERROR);
      setError(error.message);
      throw error;
    }
  }, [saveToStorage]);

  const removeSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      setSessions(prev => {
        const updated = prev.filter(s => s.sessionId !== sessionId);
        saveToStorage(updated);
        return updated;
      });
    } catch (err) {
      const error = new SessionError('Failed to remove session', SESSION_ERROR_CODES.STORAGE_ERROR, sessionId);
      setError(error.message);
      throw error;
    }
  }, [saveToStorage]);

  const updateSession = useCallback(async (sessionId: string, updates: Partial<UserAccount>): Promise<void> => {
    try {
      setSessions(prev => {
        const updated = prev.map(session => 
          session.sessionId === sessionId 
            ? { ...session, ...updates, lastActiveAt: new Date().toISOString() }
            : session
        );
        saveToStorage(updated);
        return updated;
      });
    } catch (err) {
      const error = new SessionError('Failed to update session', SESSION_ERROR_CODES.STORAGE_ERROR, sessionId);
      setError(error.message);
      throw error;
    }
  }, [saveToStorage]);

  const clearAllSessions = useCallback(async (): Promise<void> => {
    try {
      setSessions([]);
      saveToStorage([]);
    } catch (err) {
      const error = new SessionError('Failed to clear sessions', SESSION_ERROR_CODES.STORAGE_ERROR);
      setError(error.message);
      throw error;
    }
  }, [saveToStorage]);

  // Session queries
  const getSession = useCallback((sessionId: string): UserAccount | null => {
    return sessions.find(s => s.sessionId === sessionId) || null;
  }, [sessions]);

  const getAllSessions = useCallback((): UserAccount[] => {
    return sessions;
  }, [sessions]);

  const getSessionByUid = useCallback((uid: string): UserAccount | null => {
    return sessions.find(s => s.uid === uid) || null;
  }, [sessions]);

  const refreshSession = useCallback(async (sessionId: string): Promise<UserAccount> => {
    const session = getSession(sessionId);
    if (!session) {
      throw new SessionError('Session not found', SESSION_ERROR_CODES.SESSION_NOT_FOUND, sessionId);
    }
    
    await updateSession(sessionId, { lastActiveAt: new Date().toISOString() });
    return getSession(sessionId)!;
  }, [getSession, updateSession]);

  const cleanupExpiredSessions = useCallback(async (): Promise<void> => {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    const expiredSessions = sessions.filter(session => {
      const sessionAge = now - new Date(session.createdAt).getTime();
      return sessionAge > maxAge;
    });

    for (const session of expiredSessions) {
      await removeSession(session.sessionId);
    }
  }, [sessions, removeSession]);

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoading(true);
        const storedSessions = loadFromStorage();
        setSessions(storedSessions);

        // Cleanup expired sessions without dependency loop
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        const validSessions = storedSessions.filter(session => {
          const sessionAge = now - new Date(session.createdAt).getTime();
          return sessionAge < maxAge;
        });

        // Only update if we found expired sessions
        if (validSessions.length !== storedSessions.length) {
          setSessions(validSessions);
          saveToStorage(validSessions);
        }
      } catch (err) {
        console.error('Error loading sessions:', err);
        setError('Failed to load sessions');
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();
  }, [loadFromStorage]);

  // Context value
  const contextValue: SessionBagContextValue = useMemo(() => ({
    // State
    sessions,
    isLoading,
    error,

    // Actions
    addSession,
    removeSession,
    updateSession,
    clearAllSessions,
    getSession,
    getAllSessions,
    getSessionByUid,
    refreshSession,
    cleanupExpiredSessions}), [
    sessions,
    isLoading,
    error,
    addSession,
    removeSession,
    updateSession,
    clearAllSessions,
    getSession,
    getAllSessions,
    getSessionByUid,
    refreshSession,
    cleanupExpiredSessions,
  ]);

  return (
    <MultiAuthContext.Provider value={contextValue}>
      {children}
    </MultiAuthContext.Provider>
  );
};