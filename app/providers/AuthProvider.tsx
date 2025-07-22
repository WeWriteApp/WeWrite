"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthContextValue, AuthState, AuthError, AuthErrorCode } from '../types/auth';
import { getEnvironmentType } from '../utils/environmentConfig';

// Create context
const AuthContext = createContext<AuthContextValue | null>(null);

// Custom hook to use the context
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider
 *
 * This provider manages user authentication using Firebase Auth
 * with a simple, reliable single-user authentication system.
 *
 * Key principles:
 * - One user session at a time
 * - Server-side session management
 * - Simple sign out to switch accounts
 * - No client-side session complexity
 */
export function AuthProvider({ children }: AuthProviderProps) {
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
          console.log('[Auth] Session restored for user:', data.user.email);
        } else {
          setUser(null);
          console.log('[Auth] No active session found');
        }
      } else {
        setUser(null);
        console.log('[Auth] Session check failed:', response.status);
      }
    } catch (error) {
      console.error('[Auth] Session check error:', error);
      setError('Failed to check authentication status');
      setUser(null);
    }
  }, [setLoading, clearError, setUser, setError]);

  // Sign in
  const signIn = useCallback(async (emailOrUsername: string, password: string) => {
    try {
      setLoading(true);
      clearError();

      // Check if we should use dev auth system (client-side environment detection)
      // Note: Client-side can't access server-only env vars, so we use NEXT_PUBLIC_ vars and URL detection
      const isLocalDev = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_DEV_AUTH === 'true';
      const isPreviewEnv = typeof window !== 'undefined' &&
        (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('preview'));
      const useDevAuth = isLocalDev || isPreviewEnv;

      if (useDevAuth) {
        console.log(`[Auth] Using dev auth system (local dev: ${isLocalDev}, preview: ${isPreviewEnv}, hostname: ${typeof window !== 'undefined' ? window.location.hostname : 'server'})`);

        // Use server-side login endpoint for development
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ emailOrUsername, password })
        });

        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          if (loginData.success && loginData.user) {
            setUser(loginData.user);
            console.log(`[Auth] Dev auth sign in successful for user: ${loginData.user.email} (preview: ${isPreviewEnv})`);
          } else {
            throw new AuthError(loginData.error || 'Login failed', AuthErrorCode.INVALID_CREDENTIALS);
          }
        } else {
          const errorData = await loginResponse.json();
          throw new AuthError(errorData.error || 'Login failed', AuthErrorCode.INVALID_CREDENTIALS);
        }
      } else {
        // Use client-side Firebase Auth for production
        const { loginUser } = await import('../firebase/auth');
        const result = await loginUser(emailOrUsername, password);

        if (result.user) {
          // Get ID token for server-side session
          const idToken = await result.user.getIdToken();

          // Create server-side session
          const sessionResponse = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ idToken })
          });

          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData.user) {
              setUser(sessionData.user);
              console.log('[Auth] Sign in successful for user:', sessionData.user.email);
            } else {
              throw new AuthError('Session creation failed', AuthErrorCode.UNKNOWN_ERROR);
            }
          } else {
            throw new AuthError('Session creation failed', AuthErrorCode.UNKNOWN_ERROR);
          }
        } else {
          const errorCode = result.code || AuthErrorCode.INVALID_CREDENTIALS;
          const errorMessage = result.message || 'Sign in failed';
          throw new AuthError(errorMessage, errorCode);
        }
      }
    } catch (error) {
      console.error('[Auth] Sign in error:', error);
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
      console.log('[Auth] Sign out completed');

      if (!response.ok) {
        console.warn('[Auth] Logout API call failed, but local state cleared');
      }
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
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
          console.log('[Auth] Profile updated successfully');
        }
      } else {
        const errorData = await response.json();
        throw new AuthError(errorData.error || 'Profile update failed', AuthErrorCode.UNKNOWN_ERROR);
      }
    } catch (error) {
      console.error('[Auth] Profile update error:', error);
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
