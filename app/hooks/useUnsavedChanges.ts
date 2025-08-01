"use client";

import { useState, useEffect, useCallback } from 'react';
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
 */
export function useUnsavedChanges(
  hasUnsavedChanges: boolean,
  saveFunction: () => Promise<void>
): UnsavedChangesReturn {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [isHandlingNavigation, setIsHandlingNavigation] = useState<boolean>(false);

  // Handle browser back/forward navigation and tab/window close
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
    console.log('handleStayAndSave called, current hasUnsavedChanges:', hasUnsavedChanges);
    setIsHandlingNavigation(true);
    try {
      // Call the save function
      await saveFunction();

      // After saving, close the dialog
      setShowDialog(false);

      // Log the state after saving
      console.log('Save completed in handleStayAndSave, hasUnsavedChanges should be reset by saveFunction');

      // If there was a pending navigation, proceed with it
      if (pendingUrl) {
        router.push(pendingUrl);
      }
    } catch (error) {
      console.error("Error saving changes:", error);
      // Keep the dialog open if saving fails
    } finally {
      setIsHandlingNavigation(false);
    }
  }, [pendingUrl, router, saveFunction, hasUnsavedChanges]);

  // Function to handle "Leave without Saving" action
  const handleLeaveWithoutSaving = useCallback((): void => {
    console.log('[DEBUG] handleLeaveWithoutSaving called, pendingUrl:', pendingUrl);
    setIsHandlingNavigation(true);
    setShowDialog(false);

    // If there was a pending navigation, proceed with it
    if (pendingUrl) {
      try {
        // Use window.location for more reliable navigation
        window.location.href = pendingUrl;
      } catch (error) {
        console.error('[DEBUG] Error navigating with window.location:', error);
        // Fallback to router.push
        router.push(pendingUrl);
      }
    }

    // Reset handling state after a short delay to ensure navigation has started
    setTimeout(() => {
      setIsHandlingNavigation(false);
    }, 100);
  }, [pendingUrl, router]);

  // Function to close the dialog without taking any action
  const handleCloseDialog = useCallback((): void => {
    setShowDialog(false);
    setPendingUrl(null);
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