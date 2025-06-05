"use client";

import React, { useState, useEffect } from 'react';
import { infiniteReloadDetector, type DebugInfo } from '../../utils/infiniteReloadDetector';
import InfiniteReloadDebugModal from './InfiniteReloadDebugModal';

interface InfiniteReloadProtectionProps {
  children: React.ReactNode;
}

/**
 * Infinite Reload Protection Component
 * 
 * This component wraps the entire application and provides protection against
 * infinite reload loops by implementing a circuit breaker pattern.
 */
export function InfiniteReloadProtection({ children }: InfiniteReloadProtectionProps) {
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    // Check if circuit breaker is already triggered on mount
    if (infiniteReloadDetector.isTriggered()) {
      const info = infiniteReloadDetector.getDebugInfo();
      setDebugInfo(info);
      setShowDebugModal(true);
      setIsBlocked(true);
    }

    // Listen for infinite reload detection events
    const handleInfiniteReloadDetected = (event: CustomEvent) => {
      console.error('[InfiniteReloadProtection] Infinite reload detected!', event.detail);
      
      setDebugInfo(event.detail.debugInfo);
      setShowDebugModal(true);
      setIsBlocked(true);

      // Log to analytics if available
      try {
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'infinite_reload_detected', {
            event_category: 'error',
            event_label: 'circuit_breaker_triggered',
            value: event.detail.debugInfo.reloadEvents.length
          });
        }
      } catch (error) {
        console.warn('Failed to log infinite reload event to analytics:', error);
      }

      // Report to error tracking service
      try {
        fetch('/api/errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            error: {
              message: 'Infinite reload loop detected',
              type: 'infinite_reload',
              debugInfo: event.detail.debugInfo,
              timestamp: new Date().toISOString(),
              url: window.location.href,
              userAgent: navigator.userAgent
            }
          }),
        }).catch(err => console.warn('Failed to report infinite reload to backend:', err));
      } catch (error) {
        console.warn('Failed to report infinite reload error:', error);
      }
    };

    window.addEventListener('infiniteReloadDetected', handleInfiniteReloadDetected as EventListener);

    // Override window.location.reload to add protection
    try {
      const originalReload = window.location.reload.bind(window.location);

      // Use Object.defineProperty to override the reload method
      Object.defineProperty(window.location, 'reload', {
        value: function() {
          if (infiniteReloadDetector.isTriggered()) {
            console.warn('[InfiniteReloadProtection] Reload blocked by circuit breaker');
            return;
          }

          infiniteReloadDetector.recordManualReload('window.location.reload');
          originalReload();
        },
        writable: true,
        configurable: true
      });
    } catch (error) {
      console.warn('[InfiniteReloadProtection] Could not override window.location.reload:', error);
      // Fallback: just record reloads without blocking
      const originalReload = window.location.reload.bind(window.location);
      // We can't override it, so we'll just monitor for page loads instead
    }

    // Override router refresh methods if available
    const overrideRouterRefresh = () => {
      try {
        // Try to override Next.js router refresh
        const router = (window as any).__NEXT_ROUTER__;
        if (router && router.reload) {
          const originalRouterReload = router.reload.bind(router);
          router.reload = function() {
            if (infiniteReloadDetector.isTriggered()) {
              console.warn('[InfiniteReloadProtection] Router reload blocked by circuit breaker');
              return;
            }
            
            infiniteReloadDetector.recordManualReload('router.reload');
            originalRouterReload();
          };
        }
      } catch (error) {
        console.warn('Failed to override router refresh:', error);
      }
    };

    // Override after a short delay to ensure router is available
    setTimeout(overrideRouterRefresh, 1000);

    return () => {
      window.removeEventListener('infiniteReloadDetected', handleInfiniteReloadDetected as EventListener);
    };
  }, []);

  const handleCloseModal = () => {
    setShowDebugModal(false);
  };

  const handleBypass = () => {
    console.log('[InfiniteReloadProtection] User bypassed circuit breaker');
    
    // Reset the detector
    infiniteReloadDetector.reset();
    
    // Close modal and unblock
    setShowDebugModal(false);
    setIsBlocked(false);
    
    // Log bypass event
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'infinite_reload_bypass', {
          event_category: 'user_action',
          event_label: 'circuit_breaker_bypass'
        });
      }
    } catch (error) {
      console.warn('Failed to log bypass event to analytics:', error);
    }
  };

  // If blocked and no debug info, try to get it
  if (isBlocked && !debugInfo) {
    const info = infiniteReloadDetector.getDebugInfo();
    if (info) {
      setDebugInfo(info);
    }
  }

  return (
    <>
      {/* Render children normally */}
      {children}
      
      {/* Show debug modal when infinite reload is detected */}
      {showDebugModal && debugInfo && (
        <InfiniteReloadDebugModal
          isOpen={showDebugModal}
          debugInfo={debugInfo}
          onClose={handleCloseModal}
          onBypass={handleBypass}
        />
      )}
    </>
  );
}

/**
 * Hook to manually trigger infinite reload detection
 * Useful for components that want to report potential reload triggers
 */
export function useInfiniteReloadProtection() {
  const recordReload = (reason: string) => {
    infiniteReloadDetector.recordManualReload(reason);
  };

  const isTriggered = () => {
    return infiniteReloadDetector.isTriggered();
  };

  const reset = () => {
    infiniteReloadDetector.reset();
  };

  const getDebugInfo = () => {
    return infiniteReloadDetector.getDebugInfo();
  };

  return {
    recordReload,
    isTriggered,
    reset,
    getDebugInfo
  };
}

export default InfiniteReloadProtection;
