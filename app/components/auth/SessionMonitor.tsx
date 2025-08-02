'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';

interface SessionMonitorProps {
  // Check interval in milliseconds (default: 5 minutes)
  checkInterval?: number;
  // Whether to show notifications when session is revoked
  showNotifications?: boolean;
}

/**
 * SessionMonitor - Monitors session validity and logs out user if session is revoked
 * 
 * This component runs in the background and periodically checks if the user's session
 * is still valid. If the session has been revoked from another device, it will
 * automatically log out the user and redirect to login.
 */
export default function SessionMonitor({
  checkInterval = 15 * 60 * 1000, // CRITICAL FIX: Increased to 15 minutes to reduce server load
  showNotifications = true
}: SessionMonitorProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  // Check session validity
  const checkSessionValidity = async () => {
    // Prevent multiple simultaneous checks
    if (isCheckingRef.current) return;
    
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
        // CRITICAL FIX: Don't logout on network errors, only on actual auth failures
        if (response.status === 401) {
          console.log('[SessionMonitor] 401 Unauthorized - session actually expired');
          // Continue to handle as session expired
        } else {
          console.log('[SessionMonitor] Network/server error - not logging out user');
          return; // Don't logout on network errors
        }
      }
      
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('[SessionMonitor] Failed to parse session response:', parseError);
        return; // Don't logout on parse errors
      }

      console.log('[SessionMonitor] Session validation result:', result);

      if (!result.valid) {
        console.log('[SessionMonitor] Session invalid, triggering logout. Reason:', result.reason);

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

        // Log out user and redirect
        await handleSessionRevoked();
      } else {
        console.log('[SessionMonitor] Session is valid, continuing...');
      }
      
    } catch (error) {
      console.error('Error checking session validity:', error);
    } finally {
      isCheckingRef.current = false;
    }
  };

  // Handle session revoked
  const handleSessionRevoked = async () => {
    try {
      // Clear local session
      await signOut();
      
      // Redirect to login with message
      router.push('/auth/login?message=session_revoked');
      
    } catch (error) {
      console.error('Error handling session revocation:', error);
      // Force redirect even if signOut fails
      window.location.href = '/auth/login?message=session_revoked';
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn('Could not request notification permission:', error);
      }
    }
  };

  // Start monitoring when user is authenticated
  useEffect(() => {
    if (!user) {
      // Clear interval if user is not authenticated
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Request notification permission
    if (showNotifications) {
      requestNotificationPermission();
    }

    // Start periodic session validation
    intervalRef.current = setInterval(checkSessionValidity, checkInterval);
    
    // Also check immediately
    checkSessionValidity();

    // Cleanup on unmount or user change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, checkInterval, showNotifications]);

  // Handle page visibility change - check session when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        // Page became visible, check session validity
        checkSessionValidity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Handle window focus - check session when window gains focus
  useEffect(() => {
    const handleWindowFocus = () => {
      if (user) {
        // Window gained focus, check session validity
        checkSessionValidity();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [user]);

  // This component doesn't render anything
  return null;
}
