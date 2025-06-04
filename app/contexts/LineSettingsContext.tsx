'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

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
} as const;

export type LineMode = typeof LINE_MODES[keyof typeof LINE_MODES];

interface LineSettingsContextType {
  lineMode: LineMode;
  setLineMode: (mode: LineMode) => void;
  isEditMode: boolean;
}

interface LineSettingsProviderProps {
  children: React.ReactNode;
  isEditMode?: boolean;
}

const LineSettingsContext = createContext<LineSettingsContextType | undefined>(undefined);

/**
 * LineSettingsProvider - Context provider for paragraph display settings
 *
 * Manages the current paragraph display mode (normal or dense) and persists
 * the selection in localStorage for consistent user experience across sessions.
 */
export function LineSettingsProvider({ children, isEditMode = false }: LineSettingsProviderProps) {
  // Try to get the initial mode from localStorage if available
  const getInitialMode = (): LineMode => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('lineMode') as LineMode;
      if (savedMode === LINE_MODES.DENSE) {
        return LINE_MODES.DENSE;
      }
    }
    return LINE_MODES.NORMAL; // Default to normal mode
  };

  // Initialize with the correct mode from localStorage
  const [lineMode, setLineMode] = useState(getInitialMode());

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

  // Custom setter function that also shows a toast notification and refreshes the page
  const setLineModeWithNotification = (mode: LineMode): void => {
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

      // No toast notification needed since we have a full page loading state
      console.log(`Line mode changed to ${mode}`);

      // Show loading overlay before refreshing
      const loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center';
      loadingOverlay.id = 'mode-change-overlay';

      const spinner = document.createElement('div');
      spinner.className = 'loader loader-md mb-4';

      const text = document.createElement('div');
      text.className = 'text-lg font-medium';
      text.textContent = 'Refreshing page...';

      loadingOverlay.appendChild(spinner);
      loadingOverlay.appendChild(text);
      document.body.appendChild(loadingOverlay);

      // Refresh the page after a short delay to allow the overlay to appear
      setTimeout(() => {
        window.location.reload();
      }, 100);
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
 * @returns Context containing:
 *   - lineMode: Current paragraph display mode (normal or dense)
 *   - setLineMode: Function to update the paragraph display mode
 *   - isEditMode: Whether the context is being used in edit mode
 */
export function useLineSettings(): LineSettingsContextType {
  const context = useContext(LineSettingsContext);
  if (context === undefined) {
    throw new Error('useLineSettings must be used within a LineSettingsProvider');
  }
  return context;
}
