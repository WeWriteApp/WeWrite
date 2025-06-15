"use client";

import { useEffect, useRef } from 'react';

interface ClickPosition {
  x: number;
  y: number;
}

interface Editor {
  focus?: () => void;
}

/**
 * WeWrite Click-to-Edit Implementation - useClickToEdit Hook
 *
 * Simplified hook for Editor compatibility. Editor handles
 * cursor positioning internally, so this hook now just provides basic
 * focus functionality.
 */
export const useClickToEdit = (
  editor: Editor | null,
  clickPosition: ClickPosition | null,
  isEditing: boolean,
  content: any[]
): void => {
  const positionedRef = useRef<boolean>(false);

  useEffect(() => {
    // CRITICAL FIX: Disable focus call that interferes with cursor positioning
    // The Editor component handles its own focus and cursor positioning internally
    //
    // This hook was causing cursor jumping by calling focus() after the user
    // had already started typing, which would reset cursor to beginning
    //
    // if (isEditing && editor && !positionedRef.current) {
    //   positionedRef.current = true;
    //   const timer = setTimeout(() => {
    //     try {
    //       if (editor && typeof editor.focus === 'function') {
    //         editor.focus();
    //       }
    //     } catch (error) {
    //       console.error('Click-to-edit: Error focusing editor', error);
    //     }
    //   }, 100);
    //   return () => clearTimeout(timer);
    // }
  }, [isEditing, editor]);

  // Reset positioned flag when exiting edit mode
  useEffect(() => {
    if (!isEditing) {
      positionedRef.current = false;
    }
  }, [isEditing]);
};

// Helper functions removed - Editor handles positioning internally
