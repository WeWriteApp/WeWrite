"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthContextValue, AuthState, AuthError, AuthErrorCode } from '../types/auth';
import { getEnvironmentType } from '../utils/environmentConfig';
import { identifyUser } from '../utils/logrocket';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
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

    // Identify user in LogRocket when user logs in
    if (user) {
      try {
        console.log('🔍 AuthProvider: Attempting to identify user in LogRocket:', {
          uid: user.uid,
          username: user.username,
          email: user.email,
          hasUsername: !!user.username,
          hasEmail: !!user.email
        });

        identifyUser({
          id: user.uid,
          username: user.username,
          email: user.email,
          accountType: 'user',
          createdAt: user.createdAt
        });
        console.log('✅ LogRocket user identified successfully:', user.username || user.email);
      } catch (error) {
        console.error('❌ Failed to identify user in LogRocket:', error);
      }
    } else {
      console.log('🔍 AuthProvider: User is null, skipping LogRocket identification');
    }
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

      // Check if we should use dev auth system
      // ONLY use dev auth for local development with NEXT_PUBLIC_USE_DEV_AUTH=true
      // Preview and production environments should use Firebase Auth with real credentials
      const useDevAuth = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_DEV_AUTH === 'true';

      if (useDevAuth) {
        console.log('[Auth] Using dev auth system (local development only)');

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
            console.log('[Auth] Dev auth sign in successful for user:', loginData.user.email);
          } else {
            throw new AuthError(loginData.error || 'Login failed', AuthErrorCode.INVALID_CREDENTIALS);
          }
        } else {
          const errorData = await loginResponse.json();
          throw new AuthError(errorData.error || 'Login failed', AuthErrorCode.INVALID_CREDENTIALS);
        }
      } else {
        // Use client-side Firebase Auth for production
        console.log('[Auth] Using Firebase Auth for production/preview environment');
        console.log('[Auth] Attempting Firebase login for:', emailOrUsername);
        console.log('[Auth] Environment details:', {
          nodeEnv: process.env.NODE_ENV,
          hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
          isClient: typeof window !== 'undefined'
        });

        const { loginUser } = await import('../firebase/auth');
        console.log('[Auth] Firebase auth module loaded, attempting login...');
        const result = await loginUser(emailOrUsername, password);

        if (result.user) {
          console.log('[Auth] Firebase login successful, user:', {
            uid: result.user.uid,
            email: result.user.email,
            emailVerified: result.user.emailVerified
          });

          // Get ID token for server-side session
          console.log('[Auth] Getting ID token for session creation...');
          const idToken = await result.user.getIdToken();
          console.log('[Auth] ID token obtained, length:', idToken.length);

          // Create server-side session
          console.log('[Auth] Creating server-side session...');
          const sessionResponse = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ idToken })
          });

          console.log('[Auth] Session response status:', sessionResponse.status);
          console.log('[Auth] Session response ok:', sessionResponse.ok);

          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            console.log('[Auth] Session data received:', sessionData);
            if (sessionData.user) {
              setUser(sessionData.user);
              console.log('[Auth] Firebase Auth sign in successful for user:', sessionData.user.email);
            } else {
              console.error('[Auth] Session response missing user data:', sessionData);
              throw new AuthError('Session creation failed', AuthErrorCode.UNKNOWN_ERROR);
            }
          } else {
            const errorData = await sessionResponse.text();
            console.error('[Auth] Session creation failed:', {
              status: sessionResponse.status,
              statusText: sessionResponse.statusText,
              error: errorData
            });
            throw new AuthError('Session creation failed', AuthErrorCode.UNKNOWN_ERROR);
          }
        } else {
          console.error('[Auth] Firebase login failed:', result);
          const errorCode = result.code || AuthErrorCode.INVALID_CREDENTIALS;
          const errorMessage = result.message || 'Sign in failed';
          console.error('[Auth] Firebase error details:', { errorCode, errorMessage });
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

      // Redirect to homepage after successful logout
      console.log('[Auth] Redirecting to homepage after logout');
      router.push('/');

    } catch (error) {
      console.error('[Auth] Sign out error:', error);
      // Still clear local state even if API fails
      setUser(null);
      // Still redirect even if there was an error
      router.push('/');
    }
  }, [setLoading, clearError, setUser, router]);

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
