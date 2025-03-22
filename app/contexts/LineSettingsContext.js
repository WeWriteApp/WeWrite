'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// Available line modes
export const LINE_MODES = {
  NORMAL: 'normal',  // Space between paragraphs (formerly SPACED)
  DENSE: 'dense' // Dense layout with minimal spacing (formerly WRAPPED)
};

const LineSettingsContext = createContext();

export function LineSettingsProvider({ children, isEditMode = false }) {
  // Default to 'normal' mode, but try to load from localStorage if available
  const [lineMode, setLineMode] = useState(LINE_MODES.NORMAL);
  
  // Load setting from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('lineMode');
      // Handle migration from old mode names
      if (savedMode === 'default') {
        setLineMode(LINE_MODES.NORMAL);
        localStorage.setItem('lineMode', LINE_MODES.NORMAL);
      } else if (savedMode === 'wrapped') {
        setLineMode(LINE_MODES.DENSE);
        localStorage.setItem('lineMode', LINE_MODES.DENSE);
      } else if (savedMode === 'spaced') {
        setLineMode(LINE_MODES.NORMAL);
        localStorage.setItem('lineMode', LINE_MODES.NORMAL);
      } else if (savedMode && Object.values(LINE_MODES).includes(savedMode)) {
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
