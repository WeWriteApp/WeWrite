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

// localStorage key for caching auth state (not sensitive - just for UI hydration)
const AUTH_CACHE_KEY = 'wewrite_auth_cache';

// Helper to get cached auth state from localStorage
const getCachedAuthState = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Only use cache if it's less than 24 hours old
      if (parsed.cachedAt && Date.now() - parsed.cachedAt < 24 * 60 * 60 * 1000) {
        return parsed.user;
      }
      // Clear stale cache
      localStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
};

// Helper to cache auth state
const setCachedAuthState = (user: User | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
        user,
        cachedAt: Date.now()
      }));
    } else {
      localStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
};

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

  // Initialize with cached user for immediate UI hydration
  // The server will validate and update if needed
  const [authState, setAuthState] = useState<AuthState>(() => {
    const cachedUser = getCachedAuthState();
    if (cachedUser) {
      return {
        user: cachedUser,
        isLoading: true, // Still loading to validate with server
        isAuthenticated: true, // Show as authenticated immediately
        error: null
      };
    }
    return {
      user: null,
      isLoading: true,
      isAuthenticated: false,
      error: null
    };
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

    // Cache the auth state for faster hydration on next page load
    setCachedAuthState(enrichedUser);

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
        identifyUser({
          id: enrichedUser.uid,
          username: enrichedUser.username,
          email: enrichedUser.email,
          accountType: 'user',
          createdAt: enrichedUser.createdAt,
          isAdmin: enrichedUser.isAdmin
        });
      } catch (error) {
        // Failed to identify user in LogRocket - non-fatal
      }
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
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
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
      if (useDevAuth) {



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
      if (error instanceof AuthError) {
        setError(error.message);
      } else {
        // Provide more helpful generic error message
        setError('Unable to sign in. Please check your username/email and password, then try again.');
      }
      throw error;
    }
  }, [setLoading, clearError, setUser, setError]);

  // Consolidated sign out - single source of truth for logout
  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      clearError();

      // Step 1: Clear local React state immediately
      setUser(null);

      // Step 2: Sign out from Firebase Auth
      try {
        const { signOut: firebaseSignOut } = await import('firebase/auth');
        const { auth } = await import('../firebase/auth');
        await firebaseSignOut(auth);
      } catch (firebaseError) {
        // Firebase logout error - continue with cleanup
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
      } catch (cleanupError) {
        // Client cleanup error - continue
      }

      // Step 4: Call server-side logout API
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (apiError) {
        // Server logout API error - continue
      }

    } catch (error) {
      // Still clear local state even if everything fails
      setUser(null);
    } finally {
      // ALWAYS force refresh to ensure clean state, regardless of errors
      setTimeout(() => {
        // Redirect to /welcome instead of / to avoid race condition where
        // the root page might detect stale cookies and redirect to /home
        window.location.href = '/welcome';
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
            return;
          }
        }
      }

      // Fallback to regular session check
      await checkSession();
    } catch (error) {
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
        }
      } else {
        const errorData = await response.json();
        throw new AuthError(errorData.error || 'Profile update failed', AuthErrorCode.UNKNOWN_ERROR);
      }
    } catch (error) {
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
