'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from '../providers/AuthProvider';

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
 * - Only a small space separates paragraphs
 * - Standard text size (1rem/16px)
 * - Only available in view mode, not edit mode
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
  lineFeaturesEnabled: boolean;
  setLineFeaturesEnabled: (enabled: boolean) => void;
}

interface LineSettingsProviderProps {
  children: React.ReactNode;
  isEditMode?: boolean;
}

const LineSettingsContext = createContext<LineSettingsContextType>({
  lineMode: LINE_MODES.NORMAL,
  setLineMode: () => {},
  isEditMode: false,
  lineFeaturesEnabled: false,
  setLineFeaturesEnabled: () => {}
});

/**
 * LineSettingsProvider - Context provider for paragraph display settings
 *
 * Manages the current paragraph display mode (normal and dense) and persists
 * the selection in localStorage for consistent user experience across sessions.
 * Dense mode is only available in view mode - edit mode always uses normal mode.
 */
export function LineSettingsProvider({ children, isEditMode = false }: LineSettingsProviderProps) {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);
  // Generate unique ID for this provider instance
  const providerId = useMemo(() => Math.random().toString(36).substr(2, 9), []);

  // Initialize with default mode to avoid SSR issues
  const [lineMode, setLineModeState] = useState<LineMode>(LINE_MODES.NORMAL);
  const [lineFeaturesEnabled, setLineFeaturesEnabledState] = useState<boolean>(false);

  // Load setting from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('lineMode');
      const savedFeatureFlag = localStorage.getItem('lineFeaturesEnabled') === 'true';

      // Only allow line number features for admins; everyone else is forced off
      if (isAdmin) {
        setLineFeaturesEnabledState(Boolean(savedFeatureFlag));
      } else {
        setLineFeaturesEnabledState(false);
        localStorage.removeItem('lineFeaturesEnabled');
      }

      // Handle migration from legacy mode names (one-time migration)
      if (savedMode === 'default' || savedMode === 'spaced' || savedMode === 'wrapped') {
        setLineModeState(LINE_MODES.NORMAL);
        localStorage.setItem('lineMode', LINE_MODES.NORMAL);
      }
      // Use saved mode if it's valid (both normal and dense modes supported)
      else if (savedMode && Object.values(LINE_MODES).includes(savedMode as LineMode)) {
        setLineModeState(savedMode as LineMode);
      }
    }
  }, [isAdmin]);

  // Client-side mode switching function that preserves unsaved content
  const setLineModeWithoutRefresh = (mode: LineMode): void => {
    if (!lineFeaturesEnabled) {
      // If features are disabled, force normal mode regardless of caller
      setLineModeState(LINE_MODES.NORMAL);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lineMode', LINE_MODES.NORMAL);
      }
      return;
    }

    // Validate the mode before setting it (both normal and dense modes supported)
    if (!Object.values(LINE_MODES).includes(mode)) {
      console.error(`Invalid line mode: ${mode}`);
      return;
    }

    // Update state immediately for instant UI response
    setLineModeState(mode);

    // Persist to localStorage immediately
    if (typeof window !== 'undefined') {
      localStorage.setItem('lineMode', mode);
    }
  };

  // Save setting to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lineMode', lineMode);
    }
  }, [lineMode]);

  // Save line feature toggle to localStorage (admin only)
  const setLineFeaturesEnabled = (enabled: boolean) => {
    if (!isAdmin) {
      setLineFeaturesEnabledState(false);
      return;
    }
    setLineFeaturesEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lineFeaturesEnabled', enabled ? 'true' : 'false');
    }
    if (!enabled) {
      setLineModeState(LINE_MODES.NORMAL);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lineMode', LINE_MODES.NORMAL);
      }
    }
  };

  const contextValue = {
    lineMode,
    setLineMode: setLineModeWithoutRefresh,
    isEditMode,
    lineFeaturesEnabled,
    setLineFeaturesEnabled
  };

  return (
    <LineSettingsContext.Provider value={contextValue}>
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
  return context;
}
