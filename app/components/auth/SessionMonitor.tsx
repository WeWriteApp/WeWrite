'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useSessionValidation } from '../../hooks/useSessionValidation';

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
  const { user } = useAuth();
  const { validateSession, handleSessionRevoked, requestNotificationPermission } = useSessionValidation({
    showNotifications
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check session validity using the reusable hook
  const checkSessionValidity = async () => {
    const result = await validateSession();

    if (result && !result.valid) {
      console.log('[SessionMonitor] Session invalid, triggering logout. Reason:', result.reason);
      await handleSessionRevoked();
    } else if (result) {
      console.log('[SessionMonitor] Session is valid, continuing...');
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
