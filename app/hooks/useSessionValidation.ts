'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useRouter } from 'next/navigation';

interface SessionValidationResult {
  valid: boolean;
  reason?: string;
  newDeviceDetected?: boolean;
  user?: any;
  timestamp: string;
}

interface UseSessionValidationOptions {
  showNotifications?: boolean;
  onSessionRevoked?: () => void;
  onNewDeviceDetected?: () => void;
}

// Key for tracking if we've already shown the new device notification this session
const NEW_DEVICE_NOTIFICATION_KEY = 'wewrite_new_device_notified';

/**
 * Reusable hook for session validation logic
 * Centralizes session checking and error handling
 *
 * IMPORTANT: This hook now distinguishes between:
 * 1. Session revoked (user manually signed out from another device) - logs out user
 * 2. New device detected (user logged in from another device) - shows notification only
 */
export function useSessionValidation(options: UseSessionValidationOptions = {}) {
  const { showNotifications = true, onSessionRevoked, onNewDeviceDetected } = options;
  const { signOut } = useAuth();
  const router = useRouter();
  const isCheckingRef = useRef(false);
  const [hasNewDeviceAlert, setHasNewDeviceAlert] = useState(false);

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
          // Check if this is a session revocation
          try {
            const errorData = await response.json();
            if (errorData.reason === 'session_revoked') {
              console.log('[SessionValidation] Session was revoked from another device');
              return {
                valid: false,
                reason: 'session_revoked',
                timestamp: new Date().toISOString()
              };
            }
          } catch {
            // Couldn't parse response, treat as generic session expired
          }
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

      const result = await response.json();
      console.log('[SessionValidation] Session validation result:', result);

      // Handle new device detection - show notification but don't log out
      if (result.valid && result.newDeviceDetected) {
        const alreadyNotified = sessionStorage.getItem(NEW_DEVICE_NOTIFICATION_KEY);

        if (!alreadyNotified) {
          setHasNewDeviceAlert(true);
          sessionStorage.setItem(NEW_DEVICE_NOTIFICATION_KEY, 'true');

          // Show browser notification if enabled
          if (showNotifications && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('WeWrite Security Notice', {
                body: 'A new device has signed in to your account. If this wasn\'t you, check your security settings.',
                icon: '/favicon.ico',
              });
            } catch (error) {
              console.warn('Could not show notification:', error);
            }
          }

          // Call custom handler if provided
          if (onNewDeviceDetected) {
            onNewDeviceDetected();
          }
        }
      }

      return {
        ...result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error validating session:', error);
      // Return valid on errors to prevent unnecessary logouts
      return { valid: true, reason: 'Validation error - assuming valid', timestamp: new Date().toISOString() };
    } finally {
      isCheckingRef.current = false;
    }
  }, [showNotifications, onNewDeviceDetected]);

  const handleSessionRevoked = useCallback(async () => {
    try {
      // Show notification if enabled - this is for actual revocations
      if (showNotifications && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('WeWrite Security Alert', {
            body: 'Your session was signed out from another device.',
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

  const clearNewDeviceAlert = useCallback(() => {
    setHasNewDeviceAlert(false);
  }, []);

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
    hasNewDeviceAlert,
    clearNewDeviceAlert,
    isChecking: isCheckingRef.current
  };
}
