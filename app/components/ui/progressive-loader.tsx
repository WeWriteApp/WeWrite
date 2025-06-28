"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { cn } from '../../lib/utils';

interface ProgressiveLoaderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  skeleton?: React.ReactNode;
  priority?: 'high' | 'medium' | 'low';
  delay?: number;
  timeout?: number;
  networkAware?: boolean;
  className?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  retryCount?: number;
}

interface NetworkCondition {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

/**
 * ProgressiveLoader - Intelligent loading component for poor network connections
 * 
 * Features:
 * - Network-aware loading strategies
 * - Progressive enhancement
 * - Graceful degradation
 * - Adaptive timeouts based on connection speed
 * - Retry mechanisms for failed loads
 * - Priority-based loading queues
 */
export function ProgressiveLoader({
  children,
  fallback,
  skeleton,
  priority = 'medium',
  delay = 0,
  timeout = 10000,
  networkAware = true,
  className,
  onLoad,
  onError,
  retryCount = 2,
}: ProgressiveLoaderProps) {
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [networkCondition, setNetworkCondition] = useState<NetworkCondition | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [shouldLoad, setShouldLoad] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  // Network condition monitoring
  useEffect(() => {
    if (!networkAware || typeof navigator === 'undefined') {
      setShouldLoad(true);
      return;
    }

    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      const updateNetworkCondition = () => {
        const condition: NetworkCondition = {
          effectiveType: connection.effectiveType || '4g',
          downlink: connection.downlink || 10,
          rtt: connection.rtt || 100,
          saveData: connection.saveData || false,
        };
        
        setNetworkCondition(condition);
        
        // Adjust loading strategy based on network conditions
        adjustLoadingStrategy(condition);
      };

      updateNetworkCondition();
      connection.addEventListener('change', updateNetworkCondition);

      return () => {
        connection.removeEventListener('change', updateNetworkCondition);
      };
    } else {
      // No network API, proceed with default loading
      setShouldLoad(true);
    }
  }, [networkAware]);

  // Priority-based loading delay
  useEffect(() => {
    if (!shouldLoad) return;

    const priorityDelays = {
      high: 0,
      medium: 100,
      low: 500,
    };

    const effectiveDelay = Math.max(delay, priorityDelays[priority]);
    
    if (effectiveDelay > 0) {
      const delayTimeout = setTimeout(() => {
        startLoading();
      }, effectiveDelay);

      return () => clearTimeout(delayTimeout);
    } else {
      startLoading();
    }
  }, [shouldLoad, delay, priority]);

  const adjustLoadingStrategy = (condition: NetworkCondition) => {
    const isSlowConnection = ['slow-2g', '2g', '3g'].includes(condition.effectiveType);
    const hasDataSaver = condition.saveData;
    
    if (isSlowConnection || hasDataSaver) {
      // Delay loading for slow connections or data saver mode
      const adaptiveDelay = priority === 'high' ? 0 : 
                           priority === 'medium' ? 1000 : 2000;
      
      setTimeout(() => setShouldLoad(true), adaptiveDelay);
    } else {
      setShouldLoad(true);
    }
  };

  const startLoading = () => {
    if (loadingState !== 'idle') return;
    
    setLoadingState('loading');
    
    // Set adaptive timeout based on network conditions
    const adaptiveTimeout = getAdaptiveTimeout();
    
    timeoutRef.current = setTimeout(() => {
      if (loadingState === 'loading') {
        handleLoadTimeout();
      }
    }, adaptiveTimeout);
  };

  const getAdaptiveTimeout = (): number => {
    if (!networkCondition) return timeout;
    
    const baseTimeout = timeout;
    const isSlowConnection = ['slow-2g', '2g', '3g'].includes(networkCondition.effectiveType);
    
    if (isSlowConnection) {
      return baseTimeout * 2; // Double timeout for slow connections
    }
    
    if (networkCondition.rtt > 500) {
      return baseTimeout * 1.5; // 50% longer for high latency
    }
    
    return baseTimeout;
  };

  const handleLoadTimeout = () => {
    if (retryAttempts < retryCount) {
      // Retry with exponential backoff
      const retryDelay = Math.pow(2, retryAttempts) * 1000;
      
      setRetryAttempts(prev => prev + 1);
      setLoadingState('idle');
      
      retryTimeoutRef.current = setTimeout(() => {
        startLoading();
      }, retryDelay);
    } else {
      // Max retries reached, show error
      setLoadingState('error');
      onError?.(new Error('Loading timeout after retries'));
    }
  };

  const handleLoadSuccess = () => {
    setLoadingState('loaded');
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    onLoad?.();
  };

  const handleLoadError = (error: Error) => {
    setLoadingState('error');
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    onError?.(error);
  };

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Render loading states
  if (loadingState === 'error') {
    return (
      <div className={cn('flex flex-col items-center justify-center p-4 text-center', className)}>
        <div className="text-red-500 mb-2">⚠️</div>
        <p className="text-sm text-muted-foreground mb-3">
          Content failed to load
          {networkCondition?.effectiveType && (
            <span className="block text-xs">
              Network: {networkCondition.effectiveType}
            </span>
          )}
        </p>
        <button
          onClick={() => {
            setLoadingState('idle');
            setRetryAttempts(0);
            startLoading();
          }}
          className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loadingState === 'idle' || loadingState === 'loading') {
    // Show skeleton or fallback while loading
    if (skeleton) {
      return <div className={className}>{skeleton}</div>;
    }
    
    if (fallback) {
      return <div className={className}>{fallback}</div>;
    }
    
    // Default loading state
    return (
      <div className={cn('flex items-center justify-center p-4', className)}>
        <div className="flex items-center space-x-2">
          <div className="loading-spinner" />
          <span className="text-sm text-muted-foreground">
            Loading...
            {retryAttempts > 0 && (
              <span className="block text-xs">
                Retry {retryAttempts}/{retryCount}
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }

  // Content loaded successfully
  return (
    <div className={className}>
      <Suspense fallback={fallback || skeleton}>
        <LoadedContent onLoad={handleLoadSuccess} onError={handleLoadError}>
          {children}
        </LoadedContent>
      </Suspense>
    </div>
  );
}

/**
 * Wrapper component to handle load events
 */
function LoadedContent({ 
  children, 
  onLoad, 
  onError 
}: { 
  children: React.ReactNode;
  onLoad: () => void;
  onError: (error: Error) => void;
}) {
  useEffect(() => {
    try {
      // Simulate successful load
      onLoad();
    } catch (error) {
      onError(error as Error);
    }
  }, [onLoad, onError]);

  return <>{children}</>;
}

/**
 * Hook for managing progressive loading state
 */
export function useProgressiveLoading() {
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkCondition | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const connection = (navigator as any).connection;
    
    if (connection) {
      const updateConnection = () => {
        const info: NetworkCondition = {
          effectiveType: connection.effectiveType || '4g',
          downlink: connection.downlink || 10,
          rtt: connection.rtt || 100,
          saveData: connection.saveData || false,
        };
        
        setNetworkInfo(info);
        setIsSlowConnection(['slow-2g', '2g', '3g'].includes(info.effectiveType));
      };

      updateConnection();
      connection.addEventListener('change', updateConnection);

      return () => {
        connection.removeEventListener('change', updateConnection);
      };
    }
  }, []);

  return {
    isSlowConnection,
    networkInfo,
    shouldDefer: isSlowConnection || networkInfo?.saveData,
  };
}

export default ProgressiveLoader;
