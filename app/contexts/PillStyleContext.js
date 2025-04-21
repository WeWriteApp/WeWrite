"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { getBestTextColor } from '../utils/accessibility';

// Define the available pill styles
export const PILL_STYLES = {
  FILLED: 'filled',
  OUTLINE: 'outline'
};

// Create the context
const PillStyleContext = createContext({
  pillStyle: PILL_STYLES.FILLED,
  changePillStyle: () => {},
  getPillStyleClasses: () => '',
  getTextColorForPill: () => '#ffffff'
});

export function usePillStyle() {
  return useContext(PillStyleContext);
}

export function PillStyleProvider({ children }) {
  // Try to load from localStorage, default to filled
  const [pillStyle, setPillStyle] = useState(PILL_STYLES.FILLED);
  const { theme } = useTheme();
  
  // Load saved preference on mount
  useEffect(() => {
    const savedStyle = localStorage.getItem('pillStyle');
    if (savedStyle && Object.values(PILL_STYLES).includes(savedStyle)) {
      setPillStyle(savedStyle);
    }
  }, []);

  // Change pill style and save to localStorage
  const changePillStyle = (style) => {
    if (Object.values(PILL_STYLES).includes(style)) {
      setPillStyle(style);
      localStorage.setItem('pillStyle', style);
    }
  };

  // Get the appropriate classes based on the current pill style
  const getPillStyleClasses = (variant = 'primary') => {
    if (pillStyle === PILL_STYLES.OUTLINE) {
      if (variant === 'primary') {
        return `
          bg-transparent text-primary
          border-[1.5px] border-primary/40
          hover:bg-primary/10 hover:border-primary/60
          shadow-inner
        `;
      } else if (variant === 'secondary') {
        return `
          bg-transparent text-accent-foreground
          border-[1.5px] border-border/60
          hover:bg-accent/20 hover:border-border
          shadow-inner
        `;
      }
    } else {
      // Default filled style
      if (variant === 'primary') {
        return `
          bg-primary text-primary-foreground
          border-[1.5px] border-primary/20
          hover:bg-primary/90 hover:border-primary/30
          inner-border inner-border-neutral-alpha-3
        `;
      } else if (variant === 'secondary') {
        return `
          bg-accent/50 text-accent-foreground
          border-[1.5px] border-border/40
          hover:bg-accent/70 hover:border-border
          inner-border inner-border-neutral-alpha-3
        `;
      }
    }
  };

  // Get the best text color for a pill based on its background
  const getTextColorForPill = (backgroundColor) => {
    return getBestTextColor(backgroundColor, {
      level: 'AA',
      size: 'normal',
      preferredColors: ['#ffffff', '#000000']
    });
  };

  return (
    <PillStyleContext.Provider value={{ 
      pillStyle, 
      changePillStyle, 
      getPillStyleClasses,
      getTextColorForPill
    }}>
      {children}
    </PillStyleContext.Provider>
  );
}

export default PillStyleContext;
