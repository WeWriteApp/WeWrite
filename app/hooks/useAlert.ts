"use client";

import { useState, useCallback } from 'react';

interface AlertOptions {
  title: string;
  message: string;
  buttonText?: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  icon?: 'success' | 'error' | 'warning' | 'info' | null;
}

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  buttonText: string;
  variant: 'success' | 'error' | 'warning' | 'info';
  icon: 'success' | 'error' | 'warning' | 'info' | null;
}

/**
 * Hook for managing alert modals
 * 
 * This hook provides a clean API for showing alert dialogs
 * and replaces the need for alert() calls.
 * 
 * @returns Object with alert state and control functions
 */
export function useAlert() {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    title: '',
    message: '',
    buttonText: 'OK',
    variant: 'info',
    icon: 'info'
  });

  /**
   * Show an alert modal
   * 
   * @param options - Configuration for the alert modal
   * @returns Promise that resolves when the alert is dismissed
   */
  const showAlert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        title: options.title,
        message: options.message,
        buttonText: options.buttonText || 'OK',
        variant: options.variant || 'info',
        icon: options.icon !== undefined ? options.icon : 'info'
      });

      // Store the resolve function to call when modal is closed
      (window as any).__alertResolve = resolve;
    });
  }, []);

  /**
   * Close the alert modal
   */
  const closeAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
    
    // Resolve the promise if it exists
    if ((window as any).__alertResolve) {
      (window as any).__alertResolve();
      delete (window as any).__alertResolve;
    }
  }, []);

  /**
   * Convenience method for success alerts
   */
  const showSuccess = useCallback((title: string, message: string): Promise<void> => {
    return showAlert({
      title,
      message,
      variant: 'success',
      icon: 'success'
    });
  }, [showAlert]);

  /**
   * Convenience method for error alerts
   */
  const showError = useCallback((title: string, message: string): Promise<void> => {
    return showAlert({
      title,
      message,
      variant: 'error',
      icon: 'error'
    });
  }, [showAlert]);

  /**
   * Convenience method for warning alerts
   */
  const showWarning = useCallback((title: string, message: string): Promise<void> => {
    return showAlert({
      title,
      message,
      variant: 'warning',
      icon: 'warning'
    });
  }, [showAlert]);

  /**
   * Convenience method for info alerts
   */
  const showInfo = useCallback((title: string, message: string): Promise<void> => {
    return showAlert({
      title,
      message,
      variant: 'info',
      icon: 'info'
    });
  }, [showAlert]);

  return {
    // State for the alert modal
    alertState,
    
    // Control functions
    showAlert,
    closeAlert,
    
    // Convenience methods
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
}

export default useAlert;
