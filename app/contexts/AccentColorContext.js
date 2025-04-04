"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

// Define available accent colors
export const ACCENT_COLORS = {
  RED: 'red',
  ORANGE: 'orange',
  YELLOW: 'yellow',
  GREEN: 'green',
  BLUE: 'blue',
  PURPLE: 'purple',
  CUSTOM: 'custom'
};

// Color values for each accent color
export const ACCENT_COLOR_VALUES = {
  [ACCENT_COLORS.RED]: 'hsl(0, 84%, 60%)',
  [ACCENT_COLORS.ORANGE]: 'hsl(30, 84%, 60%)',
  [ACCENT_COLORS.YELLOW]: 'hsl(60, 84%, 60%)',
  [ACCENT_COLORS.GREEN]: 'hsl(120, 84%, 60%)',
  [ACCENT_COLORS.BLUE]: 'hsl(217, 91%, 60%)',
  [ACCENT_COLORS.PURPLE]: 'hsl(270, 84%, 60%)',
  [ACCENT_COLORS.CUSTOM]: 'hsl(217, 91%, 60%)' // Default to blue for custom
};

const AccentColorContext = createContext();

export function AccentColorProvider({ children }) {
  // Try to load from localStorage, default to blue
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS.BLUE);
  const [customColor, setCustomColor] = useState(ACCENT_COLOR_VALUES[ACCENT_COLORS.BLUE]);
  
  // Load saved accent color from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAccentColor = localStorage.getItem('accentColor');
      const savedCustomColor = localStorage.getItem('customAccentColor');
      
      if (savedAccentColor && Object.values(ACCENT_COLORS).includes(savedAccentColor)) {
        setAccentColor(savedAccentColor);
      }
      
      if (savedCustomColor) {
        setCustomColor(savedCustomColor);
      }
      
      // Apply the accent color to CSS variables
      updateCSSVariables(savedAccentColor || accentColor, savedCustomColor || customColor);
    }
  }, []);
  
  // Update CSS variables when accent color changes
  const updateCSSVariables = (color, customColorValue) => {
    const colorValue = color === ACCENT_COLORS.CUSTOM 
      ? customColorValue 
      : ACCENT_COLOR_VALUES[color];
    
    // Extract HSL values from the color string
    const hslMatch = colorValue.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/) || 
                    colorValue.match(/hsl\((\d+),\s*(\d+\.?\d*)%,\s*(\d+\.?\d*)%\)/);
    
    if (hslMatch) {
      const [_, h, s, l] = hslMatch;
      document.documentElement.style.setProperty('--accent-h', h);
      document.documentElement.style.setProperty('--accent-s', `${s}%`);
      document.documentElement.style.setProperty('--accent-l', `${l}%`);
      document.documentElement.style.setProperty('--primary-h', h);
      document.documentElement.style.setProperty('--primary-s', `${s}%`);
      document.documentElement.style.setProperty('--primary-l', `${l}%`);
    }
  };
  
  // Change accent color and save to localStorage
  const changeAccentColor = (color, customColorValue = null) => {
    setAccentColor(color);
    localStorage.setItem('accentColor', color);
    
    if (color === ACCENT_COLORS.CUSTOM && customColorValue) {
      setCustomColor(customColorValue);
      localStorage.setItem('customAccentColor', customColorValue);
      updateCSSVariables(color, customColorValue);
    } else {
      updateCSSVariables(color, ACCENT_COLOR_VALUES[color]);
    }
  };
  
  return (
    <AccentColorContext.Provider 
      value={{ 
        accentColor, 
        customColor, 
        changeAccentColor,
        setCustomColor
      }}
    >
      {children}
    </AccentColorContext.Provider>
  );
}

export function useAccentColor() {
  const context = useContext(AccentColorContext);
  if (context === undefined) {
    throw new Error('useAccentColor must be used within an AccentColorProvider');
  }
  return context;
}
