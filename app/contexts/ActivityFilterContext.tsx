"use client";

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

/**
 * Activity view mode type
 */
export type ActivityViewMode = 'all' | 'following' | 'mine';

/**
 * Activity filter context interface
 */
interface ActivityFilterContextType {
  viewMode: ActivityViewMode;
  setViewMode: (mode: ActivityViewMode) => void;
}

/**
 * Activity filter provider props interface
 */
interface ActivityFilterProviderProps {
  children: ReactNode;
}

// Create context
export const ActivityFilterContext = createContext<ActivityFilterContextType | undefined>(undefined);

/**
 * Custom hook to use the activity filter context
 *
 * @returns The activity filter context value
 * @throws Error if used outside of ActivityFilterProvider
 */
export const useActivityFilter = (): ActivityFilterContextType => {
  const context = useContext(ActivityFilterContext);
  if (!context) {
    throw new Error('useActivityFilter must be used within an ActivityFilterProvider');
  }
  return context;
};

/**
 * ActivityFilterProvider component that manages activity filter state
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export const ActivityFilterProvider = ({ children }: ActivityFilterProviderProps) => {
  // Initialize state from localStorage if available
  const [viewMode, setViewMode] = useState<ActivityViewMode>('all'); // Default to 'all' to show all activity

  // Load saved preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedViewMode = localStorage.getItem('activityViewMode') as ActivityViewMode | null;
        if (savedViewMode && (savedViewMode === 'all' || savedViewMode === 'following' || savedViewMode === 'mine')) {
          console.log('Loading saved view mode from localStorage:', savedViewMode);
          setViewMode(savedViewMode);
        } else {
          // If invalid or missing value, set default and save it
          console.log('No valid saved view mode found, defaulting to "all"');
          localStorage.setItem('activityViewMode', 'all');
        }
      } catch (error) {
        console.error('Error loading view mode from localStorage:', error);
      }
    }
  }, []);

  // Save preference to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        console.log('Saving view mode to localStorage:', viewMode);
        localStorage.setItem('activityViewMode', viewMode);
      } catch (error) {
        console.error('Error saving view mode to localStorage:', error);
      }
    }
  }, [viewMode]);

  /**
   * Wrap setViewMode to add logging
   *
   * @param newMode - The new view mode to set
   */
  const setViewModeWithLogging = (newMode: ActivityViewMode): void => {
    console.log(`ActivityFilterContext: Changing viewMode from "${viewMode}" to "${newMode}"`);
    setViewMode(newMode);
  };

  // Value to be provided by the context
  const value: ActivityFilterContextType = {
    viewMode,
    setViewMode: setViewModeWithLogging};

  return (
    <ActivityFilterContext.Provider value={value}>
      {children}
    </ActivityFilterContext.Provider>
  );
};