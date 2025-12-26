'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useSessionValidation } from '../../hooks/useSessionValidation';

interface SessionMonitorProps {
  // Check interval in milliseconds (default: 15 minutes)
  checkInterval?: number;
  // Whether to show notifications when session is revoked or new device detected
  showNotifications?: boolean;
}

/**
 * SessionMonitor - Monitors session validity and handles security events
 *
 * This component runs in the background and periodically checks if the user's session
 * is still valid.
 *
 * BEHAVIOR:
 * - If the session was EXPLICITLY REVOKED from another device (user clicked "sign out"),
 *   it will log out the user and redirect to login.
 * - If a NEW DEVICE LOGIN is detected, it will only show a notification but keep the
 *   user logged in. The user can review their devices in Settings > Security.
 */
export default function SessionMonitor({
  checkInterval = 15 * 60 * 1000, // 15 minutes
  showNotifications = true
}: SessionMonitorProps) {
  const { user } = useAuth();
  const { validateSession, handleSessionRevoked, requestNotificationPermission } = useSessionValidation({
    showNotifications
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check session validity using the reusable hook
  const checkSessionValidity = async () => {
    const result = await validateSession();

    if (result && !result.valid) {
      // Only log out if the session was explicitly revoked
      // The reason will be 'session_revoked' when user manually signed out from another device
      if (result.reason === 'session_revoked') {
        console.log('[SessionMonitor] Session was revoked, triggering logout');
        await handleSessionRevoked();
      } else {
        // For other invalid reasons (like expired cookies), just log
        // Don't aggressively log out users for transient issues
        console.log('[SessionMonitor] Session invalid but not revoked. Reason:', result.reason);
      }
    } else if (result) {
      // Session is valid
      // New device detection is handled within validateSession (shows notification)
      console.log('[SessionMonitor] Session is valid');
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
