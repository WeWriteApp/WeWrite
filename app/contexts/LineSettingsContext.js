'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// Available line modes
export const LINE_MODES = {
  SPACED: 'spaced',  // Space between paragraphs
  DEFAULT: 'default', // Normal spacing and layout
  WRAPPED: 'wrapped' // Wrap paragraphs with dense layout
};

const LineSettingsContext = createContext();

export function LineSettingsProvider({ children, isEditMode = false }) {
  // Default to 'default' mode, but try to load from localStorage if available
  const [lineMode, setLineMode] = useState(LINE_MODES.DEFAULT);
  
  // Load setting from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('lineMode');
      if (savedMode && Object.values(LINE_MODES).includes(savedMode)) {
        setLineMode(savedMode);
      }
    }
  }, []);
  
  // Save setting to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lineMode', lineMode);
    }
  }, [lineMode]);

  return (
    <LineSettingsContext.Provider value={{ lineMode, setLineMode, isEditMode }}>
      {children}
    </LineSettingsContext.Provider>
  );
}

export function useLineSettings() {
  const context = useContext(LineSettingsContext);
  if (context === undefined) {
    throw new Error('useLineSettings must be used within a LineSettingsProvider');
  }
  return context;
}
