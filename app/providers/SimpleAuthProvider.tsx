"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthContextValue, AuthState, AuthError, AuthErrorCode } from '../types/simpleAuth';

// Create context
const AuthContext = createContext<AuthContextValue | null>(null);

// Custom hook to use the context
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a SimpleAuthProvider');
  }
  return context;
};

interface SimpleAuthProviderProps {
  children: ReactNode;
}

/**
 * Simple Authentication Provider
 * 
 * This provider replaces the complex multi-auth system with a simple,
 * reliable single-user authentication system.
 * 
 * Key principles:
 * - One user session at a time
 * - Server-side session management
 * - Simple sign out to switch accounts
 * - No client-side session complexity
 */
export function SimpleAuthProvider({ children }: SimpleAuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null
  });

  // Clear error
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // Set loading state
  const setLoading = useCallback((isLoading: boolean) => {
    setAuthState(prev => ({ ...prev, isLoading }));
  }, []);

  // Set error state
  const setError = useCallback((error: string | null) => {
    setAuthState(prev => ({ ...prev, error, isLoading: false }));
  }, []);

  // Set user state
  const setUser = useCallback((user: User | null) => {
    setAuthState(prev => ({
      ...prev,
      user,
      isAuthenticated: !!user,
      isLoading: false,
      error: null
    }));
  }, []);

  // Check current session
  const checkSession = useCallback(async () => {
    try {
      setLoading(true);
      clearError();

      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isAuthenticated && data.user) {
          setUser(data.user);
          console.log('[SimpleAuth] Session restored for user:', data.user.email);
        } else {
          setUser(null);
          console.log('[SimpleAuth] No active session found');
        }
      } else {
        setUser(null);
        console.log('[SimpleAuth] Session check failed:', response.status);
      }
    } catch (error) {
      console.error('[SimpleAuth] Session check error:', error);
      setError('Failed to check authentication status');
      setUser(null);
    }
  }, [setLoading, clearError, setUser, setError]);

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      clearError();

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          emailOrUsername: email,
          password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Create session
        const sessionResponse = await fetch('/api/auth/session', {
          method: 'POST',
          credentials: 'include'
        });

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          if (sessionData.user) {
            setUser(sessionData.user);
            console.log('[SimpleAuth] Sign in successful for user:', sessionData.user.email);
          } else {
            throw new AuthError('Session creation failed', AuthErrorCode.UNKNOWN_ERROR);
          }
        } else {
          throw new AuthError('Session creation failed', AuthErrorCode.UNKNOWN_ERROR);
        }
      } else {
        const errorCode = data.code || AuthErrorCode.INVALID_CREDENTIALS;
        const errorMessage = data.error || 'Sign in failed';
        throw new AuthError(errorMessage, errorCode);
      }
    } catch (error) {
      console.error('[SimpleAuth] Sign in error:', error);
      if (error instanceof AuthError) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred during sign in');
      }
      throw error;
    }
  }, [setLoading, clearError, setUser, setError]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      clearError();

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      // Always clear local state, even if API call fails
      setUser(null);
      console.log('[SimpleAuth] Sign out completed');

      if (!response.ok) {
        console.warn('[SimpleAuth] Logout API call failed, but local state cleared');
      }
    } catch (error) {
      console.error('[SimpleAuth] Sign out error:', error);
      // Still clear local state even if API fails
      setUser(null);
    }
  }, [setLoading, clearError, setUser]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    await checkSession();
  }, [checkSession]);

  // Update user profile
  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!authState.user) {
      throw new AuthError('No authenticated user', AuthErrorCode.SESSION_EXPIRED);
    }

    try {
      setLoading(true);
      clearError();

      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
          console.log('[SimpleAuth] Profile updated successfully');
        }
      } else {
        const errorData = await response.json();
        throw new AuthError(errorData.error || 'Profile update failed', AuthErrorCode.UNKNOWN_ERROR);
      }
    } catch (error) {
      console.error('[SimpleAuth] Profile update error:', error);
      if (error instanceof AuthError) {
        setError(error.message);
      } else {
        setError('Failed to update profile');
      }
      throw error;
    }
  }, [authState.user, setLoading, clearError, setUser, setError]);

  // Initialize authentication on mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Context value
  const contextValue: AuthContextValue = {
    // State
    user: authState.user,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    error: authState.error,

    // Actions
    signIn,
    signOut,
    refreshUser,
    updateProfile,
    clearError
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
