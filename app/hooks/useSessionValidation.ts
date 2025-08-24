'use client';

import { useCallback, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useRouter } from 'next/navigation';

interface SessionValidationResult {
  valid: boolean;
  reason?: string;
  user?: any;
  timestamp: string;
}

interface UseSessionValidationOptions {
  showNotifications?: boolean;
  onSessionRevoked?: () => void;
}

/**
 * Reusable hook for session validation logic
 * Centralizes session checking and error handling
 */
export function useSessionValidation(options: UseSessionValidationOptions = {}) {
  const { showNotifications = true, onSessionRevoked } = options;
  const { signOut } = useAuth();
  const router = useRouter();
  const isCheckingRef = useRef(false);

  const validateSession = useCallback(async (): Promise<SessionValidationResult | null> => {
    // Prevent multiple simultaneous checks
    if (isCheckingRef.current) return null;
    
    try {
      isCheckingRef.current = true;
      
      const response = await fetch('/api/auth/validate-session', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        console.warn('Session validation request failed:', response.status, response.statusText);
        
        // Only treat 401 as actual auth failure
        if (response.status === 401) {
          console.log('[SessionValidation] 401 Unauthorized - session expired');
          return { valid: false, reason: 'Session expired', timestamp: new Date().toISOString() };
        } else if (response.status === 404) {
          console.log('[SessionValidation] 404 Not Found - validation endpoint missing');
          return { valid: true, reason: 'Endpoint missing - assuming valid', timestamp: new Date().toISOString() };
        } else {
          console.log('[SessionValidation] Network/server error - assuming valid');
          return { valid: true, reason: 'Network error - assuming valid', timestamp: new Date().toISOString() };
        }
      }

      const result: SessionValidationResult = await response.json();
      console.log('[SessionValidation] Session validation result:', result);
      
      return result;
      
    } catch (error) {
      console.error('Error validating session:', error);
      // Return valid on errors to prevent unnecessary logouts
      return { valid: true, reason: 'Validation error - assuming valid', timestamp: new Date().toISOString() };
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  const handleSessionRevoked = useCallback(async () => {
    try {
      // Show notification if enabled
      if (showNotifications && 'Notification' in window) {
        try {
          new Notification('WeWrite Security Alert', {
            body: 'Your session has been logged out from another device for security.',
            icon: '/favicon.ico',
          });
        } catch (error) {
          console.warn('Could not show notification:', error);
        }
      }

      // Call custom handler if provided
      if (onSessionRevoked) {
        onSessionRevoked();
      }

      // Clear local session
      await signOut();
      
      // Redirect to login with message
      router.push('/auth/login?message=session_revoked');
      
    } catch (error) {
      console.error('Error handling session revocation:', error);
      // Force redirect even if signOut fails
      window.location.href = '/auth/login?message=session_revoked';
    }
  }, [signOut, router, showNotifications, onSessionRevoked]);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn('Could not request notification permission:', error);
      }
    }
  }, []);

  return {
    validateSession,
    handleSessionRevoked,
    requestNotificationPermission,
    isChecking: isCheckingRef.current
  };
}
