"use client";

import { useState, useCallback } from 'react';

interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning';
  icon?: 'warning' | 'delete' | 'logout' | 'check' | null;
}

interface ConfirmationState extends ConfirmationOptions {
  isOpen: boolean;
  onConfirm: () => void;
  isLoading: boolean;
}

/**
 * Hook for managing confirmation modals
 * 
 * This hook provides a clean API for showing confirmation dialogs
 * and replaces the need for window.confirm() calls.
 * 
 * @returns Object with confirmation state and control functions
 */
export function useConfirmation() {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    icon: 'warning',
    onConfirm: () => {},
    isLoading: false
  });

  /**
   * Show a confirmation modal
   * 
   * @param options - Configuration for the confirmation modal
   * @returns Promise that resolves to true if confirmed, false if cancelled
   */
  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmationState({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'default',
        icon: options.icon !== undefined ? options.icon : 'warning',
        onConfirm: () => {
          resolve(true);
        },
        isLoading: false
      });

      // Set up a timeout to auto-resolve as false if modal is closed without action
      const timeoutId = setTimeout(() => {
        resolve(false);
      }, 30000); // 30 second timeout

      // Clear timeout when modal is closed
      const originalOnConfirm = () => {
        clearTimeout(timeoutId);
        resolve(true);
      };

      setConfirmationState(prev => ({
        ...prev,
        onConfirm: originalOnConfirm
      }));
    });
  }, []);

  /**
   * Close the confirmation modal
   */
  const closeConfirmation = useCallback(() => {
    setConfirmationState(prev => ({
      ...prev,
      isOpen: false
    }));
  }, []);

  /**
   * Set loading state for the confirmation modal
   */
  const setConfirmationLoading = useCallback((loading: boolean) => {
    setConfirmationState(prev => ({
      ...prev,
      isLoading: loading
    }));
  }, []);

  /**
   * Convenience method for delete confirmations
   */
  const confirmDelete = useCallback((itemName: string = 'this item'): Promise<boolean> => {
    return confirm({
      title: 'Delete Confirmation',
      message: `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
      icon: 'delete'
    });
  }, [confirm]);

  /**
   * Convenience method for logout confirmations
   */
  const confirmLogout = useCallback((): Promise<boolean> => {
    return confirm({
      title: 'Log Out',
      message: 'Are you sure you want to log out?',
      confirmText: 'Log Out',
      cancelText: 'Cancel',
      variant: 'default',
      icon: 'logout'
    });
  }, [confirm]);

  /**
   * Convenience method for subscription cancellation
   */
  const confirmCancelSubscription = useCallback((): Promise<boolean> => {
    return confirm({
      title: 'Cancel Subscription',
      message: 'Are you sure you want to cancel your subscription? This will stop all future payments and remove your subscription badge.',
      confirmText: 'Cancel Subscription',
      cancelText: 'Keep Subscription',
      variant: 'destructive',
      icon: 'warning'
    });
  }, [confirm]);

  /**
   * Show confirmation modal (alias for confirm)
   */
  const showConfirmation = useCallback((
    title: string,
    message: string,
    confirmText?: string,
    variant?: 'default' | 'destructive' | 'warning'
  ): Promise<boolean> => {
    return confirm({
      title,
      message,
      confirmText,
      variant
    });
  }, [confirm]);

  return {
    // State for the confirmation modal
    confirmationState,

    // Control functions
    confirm,
    showConfirmation,
    closeConfirmation,
    setConfirmationLoading,

    // Convenience methods
    confirmDelete,
    confirmLogout,
    confirmCancelSubscription
  };
}

export default useConfirmation;
