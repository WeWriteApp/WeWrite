'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

/**
 * LINE_MODES - Constants for paragraph display modes
 *
 * NORMAL: Traditional document style with paragraph numbers creating indentation
 * - Numbers positioned to the left of the text
 * - Clear indent for each paragraph
 * - Standard text size (1rem/16px)
 * - Proper spacing between paragraphs
 *
 * DENSE: Collapses all paragraphs for a more comfortable reading experience
 * - NO line breaks between paragraphs
 * - Text wraps continuously as if newline characters were temporarily deleted
 * - Paragraph numbers inserted inline within the continuous text
 * - Standard text size (1rem/16px)
 * - Only a small space separates paragraphs
 */
export const LINE_MODES = {
  NORMAL: 'normal',
  DENSE: 'dense'
};

const LineSettingsContext = createContext();

/**
 * LineSettingsProvider - Context provider for paragraph display settings
 *
 * Manages the current paragraph display mode (normal or dense) and persists
 * the selection in localStorage for consistent user experience across sessions.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {boolean} props.isEditMode - Whether the context is being used in edit mode
 */
export function LineSettingsProvider({ children, isEditMode = false }) {
  // Default to 'normal' mode, but try to load from localStorage if available
  const [lineMode, setLineMode] = useState(LINE_MODES.NORMAL);

  // Load setting from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('lineMode');

      // Handle migration from legacy mode names (one-time migration)
      if (savedMode === 'default' || savedMode === 'spaced') {
        setLineMode(LINE_MODES.NORMAL);
        localStorage.setItem('lineMode', LINE_MODES.NORMAL);
      } else if (savedMode === 'wrapped') {
        setLineMode(LINE_MODES.DENSE);
        localStorage.setItem('lineMode', LINE_MODES.DENSE);
      }
      // Use saved mode if it's valid
      else if (savedMode && Object.values(LINE_MODES).includes(savedMode)) {
        setLineMode(savedMode);
      }
    }
  }, []);

  // Custom setter function that also shows a toast notification and forces page reload
  const setLineModeWithNotification = (mode) => {
    // Validate the mode before setting it
    if (mode !== LINE_MODES.NORMAL && mode !== LINE_MODES.DENSE) {
      console.error(`Invalid line mode: ${mode}`);
      return;
    }

    // Force update the state immediately
    setLineMode(mode);

    // Also update localStorage immediately to ensure persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('lineMode', mode);
      console.log(`Line mode set to ${mode} and saved to localStorage`);

      // Show toast notification based on the selected mode
      if (mode === LINE_MODES.NORMAL) {
        toast.success("Normal paragraph mode selected");
      } else if (mode === LINE_MODES.DENSE) {
        toast.success("Dense paragraph mode selected");
      }

      // Force page reload to ensure the mode change takes effect immediately
      setTimeout(() => {
        window.location.reload();
      }, 300); // Short delay to allow toast to be seen
    }
  };

  // Save setting to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lineMode', lineMode);
    }
  }, [lineMode]);

  return (
    <LineSettingsContext.Provider value={{
      lineMode,
      setLineMode: setLineModeWithNotification,
      isEditMode
    }}>
      {children}
    </LineSettingsContext.Provider>
  );
}

/**
 * useLineSettings - Hook to access the LineSettings context
 *
 * @returns {Object} Context containing:
 *   - lineMode: Current paragraph display mode (normal or dense)
 *   - setLineMode: Function to update the paragraph display mode
 *   - isEditMode: Whether the context is being used in edit mode
 */
export function useLineSettings() {
  const context = useContext(LineSettingsContext);
  if (context === undefined) {
    throw new Error('useLineSettings must be used within a LineSettingsProvider');
  }
  return context;
}
