"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';

// Create context
const ActivityFilterContext = createContext();

// Custom hook to use the context
export const useActivityFilter = () => {
  const context = useContext(ActivityFilterContext);
  if (!context) {
    throw new Error('useActivityFilter must be used within an ActivityFilterProvider');
  }
  return context;
};

// Provider component
export const ActivityFilterProvider = ({ children }) => {
  // Initialize state from localStorage if available
  const [viewMode, setViewMode] = useState('all'); // Default to 'all' to show all activity

  // Load saved preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedViewMode = localStorage.getItem('activityViewMode');
        if (savedViewMode && (savedViewMode === 'all' || savedViewMode === 'following')) {
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

  // Wrap setViewMode to add logging
  const setViewModeWithLogging = (newMode) => {
    console.log(`ActivityFilterContext: Changing viewMode from "${viewMode}" to "${newMode}"`);
    setViewMode(newMode);
  };

  // Value to be provided by the context
  const value = {
    viewMode,
    setViewMode: setViewModeWithLogging,
  };

  return (
    <ActivityFilterContext.Provider value={value}>
      {children}
    </ActivityFilterContext.Provider>
  );
};
