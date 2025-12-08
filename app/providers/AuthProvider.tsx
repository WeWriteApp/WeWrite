"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthContextValue, AuthState, AuthError, AuthErrorCode } from '../types/auth';
import { getEnvironmentType } from '../utils/environmentConfig';
import { identifyUser } from '../utils/logrocket';
import { useRouter } from 'next/navigation';
import { isAdmin } from '../utils/isAdmin';
import { checkEmailVerificationOnStartup } from '../services/emailVerificationNotifications';

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
    // Always derive admin flag from email allowlist to avoid missing server flags
    const enrichedUser = user
      ? {
          ...user,
          isAdmin: user.isAdmin === true || isAdmin(user.email),
        }
      : null;

    setAuthState(prev => ({
      ...prev,
      user: enrichedUser,
      isAuthenticated: !!enrichedUser,
      isLoading: false,
      error: null
    }));

    // Identify user in LogRocket when user logs in
    if (enrichedUser) {
      try {
        console.log('✅ LogRocket user identification:', {
          uid: enrichedUser.uid,
          username: enrichedUser.username,
          email: enrichedUser.email,
          hasUsername: !!enrichedUser.username,
          hasEmail: !!enrichedUser.email,
          isAdmin: enrichedUser.isAdmin
        });

        identifyUser({
          id: enrichedUser.uid,
          username: enrichedUser.username,
          email: enrichedUser.email,
          accountType: 'user',
          createdAt: enrichedUser.createdAt,
          isAdmin: enrichedUser.isAdmin
        });
        console.log('✅ LogRocket user identified successfully:', enrichedUser.username || enrichedUser.email);
      } catch (error) {
        console.error('❌ Failed to identify user in LogRocket:', error);
      }
    } else {
    }
  }, []);

  // Check current session
  const checkSession = useCallback(async () => {
    try {
      console.log('[Auth] 🔍 Starting session check...');
      setLoading(true);
      clearError();

      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include'
      });

      console.log('[Auth] 🔍 Session check response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Auth] 🔍 Session data received:', {
          isAuthenticated: data.isAuthenticated,
          hasUser: !!data.user,
          userEmail: data.user?.email
        });

        if (data.isAuthenticated && data.user) {
          setUser(data.user);
          console.log('[Auth] ✅ Session restored for user:', data.user.email);
        } else {
          setUser(null);
          console.log('[Auth] ❌ No active session found - data:', data);
        }
      } else {
        const errorData = await response.text();
        setUser(null);
      }
    } catch (error) {
      console.error('[Auth] ❌ Session check error:', error);
      setError('Failed to check authentication status');
      setUser(null);
    }
  }, [setLoading, clearError, setUser, setError]);

  // Sign in (SIMPLIFIED)
  const signIn = useCallback(async (emailOrUsername: string, password: string) => {
    try {
      setLoading(true);
      clearError();

      // Check if we should use dev auth system
      // ONLY use dev auth for local development with USE_DEV_AUTH=true
      const useDevAuth = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_DEV_AUTH === 'true';

      // SIMPLIFIED: Always use the login API endpoint
      console.log('[Auth] Using simplified login API for all environments', {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_USE_DEV_AUTH: process.env.NEXT_PUBLIC_USE_DEV_AUTH,
        useDevAuth: useDevAuth
      });

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
        console.log('[Auth] Using Firebase Auth for production', {
          nodeEnv: process.env.NODE_ENV,
          hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
          isClient: typeof window !== 'undefined'
        });

        const { loginUser } = await import('../firebase/auth');
        const result = await loginUser(emailOrUsername, password);

        if (result.user) {
          console.log('[Auth] Firebase user authenticated:', {
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

  // Consolidated sign out - single source of truth for logout
  const signOut = useCallback(async () => {
    console.log('[Auth] 🔴 LOGOUT: Starting consolidated logout process');

    try {
      setLoading(true);
      clearError();

      // Step 1: Clear local React state immediately
      setUser(null);
      console.log('[Auth] 🔴 LOGOUT: Local state cleared');

      // Step 2: Sign out from Firebase Auth
      try {
        const { signOut: firebaseSignOut } = await import('firebase/auth');
        const { auth } = await import('../firebase/auth');
        await firebaseSignOut(auth);
      } catch (firebaseError) {
        console.warn('[Auth] 🔴 LOGOUT: Firebase logout error (continuing):', firebaseError);
      }

      // Step 3: Clear client-side cookies and localStorage
      try {
        const Cookies = (await import('js-cookie')).default;

        const cookiesToClear = [
          'session',
          'authenticated',
          'userSession',
          'simpleUserSession',
          'sessionId',
          'devUserSession',
          'authToken'
        ];

        // Clear cookies with different domain/path combinations
        cookiesToClear.forEach(cookieName => {
          Cookies.remove(cookieName);
          Cookies.remove(cookieName, { path: '/' });
          if (window.location.hostname.includes('getwewrite.app')) {
            Cookies.remove(cookieName, { path: '/', domain: '.getwewrite.app' });
            Cookies.remove(cookieName, { path: '/', domain: 'getwewrite.app' });
          }
        });

        // Clear relevant localStorage items
        const localStorageKeysToRemove = [
          'email_verification_notification_dismissed',
          'last_email_verification_notification',
          'email_verification_resend_cooldown',
          'email_verification_resend_count',
          'authRedirectPending'
        ];

        localStorageKeysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });

        console.log('[Auth] 🔴 LOGOUT: Client-side cleanup completed');
      } catch (cleanupError) {
        console.warn('[Auth] 🔴 LOGOUT: Client cleanup error (continuing):', cleanupError);
      }

      // Step 4: Call server-side logout API
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });

        if (response.ok) {
          console.log('[Auth] 🔴 LOGOUT: Server-side logout completed');
        } else {
          console.warn('[Auth] 🔴 LOGOUT: Server logout API failed (continuing)');
        }
      } catch (apiError) {
        console.warn('[Auth] 🔴 LOGOUT: Server logout API error (continuing):', apiError);
      }

      console.log('[Auth] 🔴 LOGOUT: All logout steps completed');

    } catch (error) {
      console.error('[Auth] 🔴 LOGOUT: Unexpected error during logout:', error);
      // Still clear local state even if everything fails
      setUser(null);
    } finally {
      // ALWAYS force refresh to ensure clean state, regardless of errors
      console.log('[Auth] 🔴 LOGOUT: Force refreshing page to complete logout');
      setTimeout(() => {
        window.location.href = '/';
      }, 100); // Small delay to ensure state updates are processed
    }
  }, [setLoading, clearError, setUser]);

  // Refresh user data - force refresh from Firebase Auth to get latest emailVerified status
  const refreshUser = useCallback(async () => {
    try {
      setLoading(true);
      clearError();

      // First, check if we have a Firebase Auth user and refresh their token
      const { auth } = await import('../firebase/auth');
      if (auth.currentUser) {
        await auth.currentUser.reload(); // Refresh the user's data from Firebase

        // Get fresh ID token with updated claims
        const idToken = await auth.currentUser.getIdToken(true); // Force refresh

        // Create new session with updated data
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ idToken })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.isAuthenticated && data.user) {
            setUser(data.user);
            console.log('[Auth] User data refreshed with updated emailVerified status:', data.user.emailVerified);
            return;
          }
        }
      }

      // Fallback to regular session check
      await checkSession();
    } catch (error) {
      console.error('[Auth] Error refreshing user data:', error);
      // Fallback to regular session check
      await checkSession();
    }
  }, [checkSession, setLoading, clearError, setUser]);

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

  // Initialize authentication on mount (client-side only)
  useEffect(() => {
    // Only run on client side to avoid SSR issues
    if (typeof window === 'undefined') {
      return;
    }

    // Perform session check on client-side mount
    const performSessionCheck = async () => {
      try {
        setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

        const response = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();

          if (data.isAuthenticated && data.user) {
            setUser(data.user);
            
            // If user is not email verified, check if we should show a reminder notification
            if (!data.user.emailVerified) {
              checkEmailVerificationOnStartup();
            }
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('[Auth] Session check error:', error);
        setAuthState(prev => ({ ...prev, user: null, isLoading: false, error: 'Failed to check authentication status' }));
      }
    };

    performSessionCheck();
  }, []); // Empty dependency array to run only once on mount

  // Listen for page visibility changes to refresh user data when user returns
  // This helps catch email verification status changes when user returns from email
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && authState.user && !authState.user.emailVerified) {
        console.log('[Auth] Page became visible and user is unverified, refreshing user data');
        refreshUser();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [authState.user, refreshUser]);

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
