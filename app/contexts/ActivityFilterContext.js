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
  const [viewMode, setViewMode] = useState('following'); // Default to 'following'

  // Load saved preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('activityViewMode');
      if (savedViewMode) {
        setViewMode(savedViewMode);
      }
    }
  }, []);

  // Save preference to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activityViewMode', viewMode);
    }
  }, [viewMode]);

  // Value to be provided by the context
  const value = {
    viewMode,
    setViewMode,
  };

  return (
    <ActivityFilterContext.Provider value={value}>
      {children}
    </ActivityFilterContext.Provider>
  );
};
