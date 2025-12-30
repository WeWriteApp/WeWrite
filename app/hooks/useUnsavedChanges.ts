"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface UnsavedChangesReturn {
  /** Whether to show the unsaved changes dialog */
  showUnsavedChangesDialog: boolean;
  /** Function to handle navigation attempts */
  handleNavigation: (url: string) => boolean;
  /** Function to handle "Stay and Save" action */
  handleStayAndSave: () => Promise<void>;
  /** Function to handle "Leave without Saving" action */
  handleLeaveWithoutSaving: () => void;
  /** Function to close the dialog without taking any action */
  handleCloseDialog: () => void;
  /** Whether currently handling navigation */
  isHandlingNavigation: boolean;
}

/**
 * Hook to handle unsaved changes and prevent accidental navigation
 *
 * IMPORTANT: When implementing the save function, make sure to reset all change tracking states
 * (e.g., hasContentChanged, hasTitleChanged, etc.) to false after a successful save.
 * Otherwise, the unsaved changes warning will still appear even after saving successfully.
 *
 * This hook handles:
 * 1. Browser tab/window close (beforeunload event)
 * 2. Browser back/forward buttons and PWA swipe gestures (popstate event)
 * 3. In-app navigation (via handleNavigation function)
 */
export function useUnsavedChanges(
  hasUnsavedChanges: boolean,
  saveFunction: () => Promise<void>
): UnsavedChangesReturn {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [isHandlingNavigation, setIsHandlingNavigation] = useState<boolean>(false);
  const [isBackNavigation, setIsBackNavigation] = useState<boolean>(false);

  // Track if we've pushed our guard state to history
  const hasGuardStateRef = useRef<boolean>(false);
  const isProcessingPopstateRef = useRef<boolean>(false);

  // Handle browser tab/window close
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent): string | undefined => {
      if (hasUnsavedChanges) {
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    };

    if (hasUnsavedChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Handle browser back/forward navigation and PWA swipe gestures
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Push a guard state when we have unsaved changes
    if (hasUnsavedChanges && !hasGuardStateRef.current && !showDialog) {
      // Push a dummy state that we can intercept
      window.history.pushState({ unsavedChangesGuard: true }, '');
      hasGuardStateRef.current = true;
    }

    // Remove guard state when changes are saved
    if (!hasUnsavedChanges && hasGuardStateRef.current) {
      // Go back to remove the guard state we pushed
      window.history.back();
      hasGuardStateRef.current = false;
    }

    const handlePopstate = (event: PopStateEvent) => {
      // Prevent re-entry
      if (isProcessingPopstateRef.current) return;

      // If we have unsaved changes and this is our guard state being popped
      if (hasUnsavedChanges && hasGuardStateRef.current) {
        isProcessingPopstateRef.current = true;

        // Re-push the guard state to prevent navigation
        window.history.pushState({ unsavedChangesGuard: true }, '');

        // Show the dialog
        setIsBackNavigation(true);
        setShowDialog(true);
        setPendingUrl(null); // For back navigation, we don't have a specific URL

        // Reset processing flag after a short delay
        setTimeout(() => {
          isProcessingPopstateRef.current = false;
        }, 100);
      }
    };

    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
      // Clean up guard state on unmount if we still have it
      if (hasGuardStateRef.current) {
        hasGuardStateRef.current = false;
        // Don't navigate back here as component is unmounting
      }
    };
  }, [hasUnsavedChanges, showDialog]);

  // Function to intercept navigation attempts
  const handleNavigation = useCallback((url: string): boolean => {
    if (hasUnsavedChanges && !isHandlingNavigation) {
      // Show the dialog and store the URL the user was trying to navigate to
      setShowDialog(true);
      setPendingUrl(url);
      return true; // Navigation was intercepted
    }
    return false; // Navigation was not intercepted
  }, [hasUnsavedChanges, isHandlingNavigation]);

  // Function to handle "Stay and Save" action
  const handleStayAndSave = useCallback(async (): Promise<void> => {
    console.log('handleStayAndSave called, current hasUnsavedChanges:', hasUnsavedChanges, 'isBackNavigation:', isBackNavigation);
    setIsHandlingNavigation(true);
    try {
      // Call the save function
      await saveFunction();

      // After saving, close the dialog and reset state
      setShowDialog(false);
      setIsBackNavigation(false);
      setPendingUrl(null);

      // Log the state after saving
      console.log('Save completed in handleStayAndSave, hasUnsavedChanges should be reset by saveFunction');

      // If there was a pending URL navigation (not back navigation), proceed with it
      if (pendingUrl && !isBackNavigation) {
        router.push(pendingUrl);
      }
      // For back navigation, we just stay on the page after saving (guard state will be cleaned up by the useEffect)
    } catch (error) {
      console.error("Error saving changes:", error);
      // Keep the dialog open if saving fails
    } finally {
      setIsHandlingNavigation(false);
    }
  }, [pendingUrl, router, saveFunction, hasUnsavedChanges, isBackNavigation]);

  // Function to handle "Leave without Saving" action
  const handleLeaveWithoutSaving = useCallback((): void => {
    console.log('[DEBUG] handleLeaveWithoutSaving called, pendingUrl:', pendingUrl, 'isBackNavigation:', isBackNavigation);
    setIsHandlingNavigation(true);
    setShowDialog(false);

    // Clear the guard state ref since we're leaving
    hasGuardStateRef.current = false;

    if (isBackNavigation) {
      // For back/swipe navigation, we need to go back twice:
      // Once to remove our guard state, once to perform the actual back navigation
      setIsBackNavigation(false);

      // Use history.go(-2) to go back past our guard state and perform the actual back navigation
      window.history.go(-2);

      // Reset handling state after navigation
      setTimeout(() => {
        setIsHandlingNavigation(false);
      }, 100);
    } else if (pendingUrl) {
      // For explicit URL navigation, proceed to that URL
      try {
        // Use window.location for more reliable navigation
        window.location.href = pendingUrl;
      } catch (error) {
        console.error('[DEBUG] Error navigating with window.location:', error);
        // Fallback to router.push
        router.push(pendingUrl);
      }

      // Reset handling state after a short delay to ensure navigation has started
      setTimeout(() => {
        setIsHandlingNavigation(false);
      }, 100);
    } else {
      // No pending navigation - just reset state
      setIsHandlingNavigation(false);
    }
  }, [pendingUrl, router, isBackNavigation]);

  // Function to close the dialog without taking any action
  const handleCloseDialog = useCallback((): void => {
    setShowDialog(false);
    setPendingUrl(null);
    setIsBackNavigation(false);
  }, []);

  return {
    showUnsavedChangesDialog: showDialog,
    handleNavigation,
    handleStayAndSave,
    handleLeaveWithoutSaving,
    handleCloseDialog,
    isHandlingNavigation
  };
}