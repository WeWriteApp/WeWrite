"use client";

/**
 * Production Hydration Fix Utilities
 *
 * This module provides utilities specifically designed to fix hydration issues
 * that only occur in production environments (Vercel preview/production).
 */

import React, { useEffect, useState } from 'react';

/**
 * Detect if we're running in a production environment
 */
export function useIsProduction(): boolean {
  const [isProduction, setIsProduction] = useState(false);
  
  useEffect(() => {
    // Multiple ways to detect production environment
    const nodeEnv = process.env.NODE_ENV === 'production';
    const vercelEnv = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';
    const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
    
    setIsProduction(nodeEnv || vercelEnv || isVercel);
  }, []);
  
  return isProduction;
}

/**
 * Production-safe client-only rendering hook
 * 
 * This hook ensures components only render after hydration is complete
 * and provides additional safety measures for production environments.
 */
export function useProductionSafeClient(): { 
  isClient: boolean; 
  isProduction: boolean; 
  shouldRender: boolean 
} {
  const [isClient, setIsClient] = useState(false);
  const [isProduction, setIsProduction] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  
  useEffect(() => {
    // First, detect if we're on the client
    setIsClient(true);
    
    // Then detect production environment
    const nodeEnv = process.env.NODE_ENV === 'production';
    const vercelEnv = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';
    const isVercel = window.location.hostname.includes('vercel.app');
    const prod = nodeEnv || vercelEnv || isVercel;
    
    setIsProduction(prod);
    
    // In production, add a small delay to ensure everything is ready
    if (prod) {
      const timer = setTimeout(() => {
        setShouldRender(true);
      }, 100); // Small delay for production stability
      
      return () => clearTimeout(timer);
    } else {
      // In development, render immediately
      setShouldRender(true);
    }
  }, []);
  
  return { isClient, isProduction, shouldRender };
}

/**
 * Fix for React Strict Mode issues in production
 * 
 * React Strict Mode can cause double-rendering which leads to hydration mismatches
 * in production environments with complex components like Slate editor.
 */
export function useStrictModeFix(): void {
  useEffect(() => {
    // Detect if we're in React Strict Mode
    const isStrictMode = document.querySelector('[data-reactroot]') !== null;
    
    if (isStrictMode && process.env.NODE_ENV === 'production') {
      console.warn('React Strict Mode detected in production - this may cause hydration issues');
      
      // Add a flag to help components detect strict mode
      if (typeof window !== 'undefined') {
        (window as any).__REACT_STRICT_MODE__ = true;
      }
    }
  }, []);
}

/**
 * Production-safe error boundary hook
 * 
 * This hook provides error recovery specifically for production hydration issues.
 */
export function useProductionErrorRecovery(): {
  hasError: boolean;
  errorCount: number;
  resetError: () => void;
} {
  const [hasError, setHasError] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  
  useEffect(() => {
    // Listen for unhandled errors that might be hydration-related
    const handleError = (event: ErrorEvent) => {
      const error = event.error;
      
      // Check if this looks like a hydration error
      if (error && (
        error.message?.includes('Minified React error #185') ||
        error.message?.includes('hydration') ||
        error.message?.includes('Text content does not match')
      )) {
        console.error('Production hydration error detected:', error);
        
        setErrorCount(prev => prev + 1);
        setHasError(true);
        
        // Auto-recovery for hydration errors
        if (errorCount < 3) {
          setTimeout(() => {
            setHasError(false);
          }, 1000);
        }
      }
    };
    
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [errorCount]);
  
  const resetError = () => {
    setHasError(false);
    setErrorCount(0);
  };
  
  return { hasError, errorCount, resetError };
}

/**
 * CSP violation fix for Firebase Realtime Database
 * 
 * This function helps fix Content Security Policy violations that can cause
 * connection issues in production environments.
 */
export function fixFirebaseCSPViolations(): void {
  useEffect(() => {
    // Listen for CSP violations
    const handleCSPViolation = (event: SecurityPolicyViolationEvent) => {
      // SECURITY FIX: Parse URL properly instead of substring check
      if (event.violatedDirective === 'connect-src' && event.blockedURI) {
        try {
          const url = new URL(event.blockedURI);
          // Check if hostname ends with firebaseio.com (proper domain validation)
          if (url.hostname.endsWith('.firebaseio.com') || url.hostname === 'firebaseio.com') {
            console.warn('Firebase CSP violation detected:', event.blockedURI);

            // Log this for debugging
            console.warn('This may cause Firebase Realtime Database connection issues');
          }
        } catch (error) {
          // If URL parsing fails, log the error but don't process as Firebase URL
          console.debug('Could not parse blocked URI:', event.blockedURI);
        }
      }
    };
    
    document.addEventListener('securitypolicyviolation', handleCSPViolation);
    
    return () => {
      document.removeEventListener('securitypolicyviolation', handleCSPViolation);
    };
  }, []);
}

/**
 * Production-safe component wrapper
 * 
 * This higher-order component provides comprehensive protection for components
 * that have hydration issues in production.
 */
export function withProductionSafety<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function ProductionSafeComponent(props: P) {
    const { isClient, isProduction, shouldRender } = useProductionSafeClient();
    const { hasError, resetError } = useProductionErrorRecovery();
    
    useStrictModeFix();
    fixFirebaseCSPViolations();
    
    if (!isClient || !shouldRender) {
      return fallback || (
        <div className="w-full p-4 border rounded-lg">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </div>
      );
    }
    
    if (hasError) {
      return (
        <div className="w-full p-4 border rounded-lg border-red-200 bg-red-50">
          <div className="text-center">
            <p className="text-red-600 mb-2">Component failed to load</p>
            <button 
              onClick={resetError}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    
    try {
      return <Component {...props} />;
    } catch (error) {
      console.error('Component render error:', error);
      return fallback || (
        <div className="w-full p-4 border rounded-lg border-red-200 bg-red-50">
          <p className="text-red-600 text-center">Failed to render component</p>
        </div>
      );
    }
  };
}
