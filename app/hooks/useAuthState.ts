'use client';

import { useMemo } from 'react';
import { useAuth } from '../providers/AuthProvider';

/**
 * Enhanced auth state hook with computed properties
 * Provides consistent auth state checks across components
 */
export function useAuthState() {
  const { user, isAuthenticated, isLoading, error } = useAuth();

  const authState = useMemo(() => ({
    // Basic auth state
    user,
    isAuthenticated,
    isLoading,
    error,
    
    // Computed properties
    hasUser: !!user,
    userId: user?.uid || null,
    userEmail: user?.email || null,
    username: user?.username || null,
    isEmailVerified: user?.emailVerified ?? false,
    
    // Auth status checks
    isLoggedIn: isAuthenticated && !!user,
    isLoggedOut: !isAuthenticated && !user,
    needsEmailVerification: isAuthenticated && !!user && !user.emailVerified,
    
    // Loading states
    isAuthReady: !isLoading,
    isAuthPending: isLoading,
    
    // Error states
    hasAuthError: !!error,
    authErrorMessage: error || null,
    
    // User profile completeness (displayName removed - only username matters)
    hasUsername: !!(user?.username),
    hasPhotoURL: !!(user?.photoURL),
    isProfileComplete: !!(user?.username),
    
    // Permissions (can be extended)
    canCreateContent: isAuthenticated && !!user,
    canAccessSettings: isAuthenticated && !!user,
    canAccessSubscription: isAuthenticated && !!user && user.emailVerified,
    
    // Debug info (useful for development)
    debugInfo: {
      mounted: !isLoading,
      hasUser: !!user,
      isAuthenticated,
      userId: user?.uid || 'none',
      email: user?.email || 'none',
      emailVerified: user?.emailVerified ?? false
    }
  }), [user, isAuthenticated, isLoading, error]);

  return authState;
}
