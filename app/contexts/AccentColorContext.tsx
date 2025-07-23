"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

// SIMPLE accent colors - no 792-line nightmare
const COLORS = {
  blue: '#1768FF',
  red: '#E5484D',
  green: '#46A758',
  purple: '#8B5CF6',
  amber: '#F59E0B',
  sky: '#0EA5E9',
} as const;

type ColorKey = keyof typeof COLORS;

interface AccentColorContextType {
  accentColor: ColorKey;
  setAccentColor: (color: ColorKey) => void;
  getAccentColorValue: () => string;
}

const AccentColorContext = createContext<AccentColorContextType>({
  accentColor: 'blue',
  setAccentColor: () => {},
  getAccentColorValue: () => COLORS.blue
});

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColor] = useState<ColorKey>('blue');

  const getAccentColorValue = () => COLORS[accentColor];

  // Load saved color
  useEffect(() => {
    const saved = localStorage.getItem('accent-color') as ColorKey;
    if (saved && saved in COLORS) {
      setAccentColor(saved);
    }
  }, []);

  // Save color and update CSS
  useEffect(() => {
    localStorage.setItem('accent-color', accentColor);
    document.documentElement.style.setProperty('--accent-color', getAccentColorValue());
  }, [accentColor]);

  return (
    <AccentColorContext.Provider value={{ accentColor, setAccentColor, getAccentColorValue }}>
      {children}
    </AccentColorContext.Provider>
  );
}

export const useAccentColor = () => {
  const context = useContext(AccentColorContext);
  if (!context) {
    throw new Error('useAccentColor must be used within AccentColorProvider');
  }
  return context;
};

// Export for external use
export { COLORS };
export type { ColorKey };

// Legacy exports for compatibility
export const ACCENT_COLORS = {
  RED: 'red',
  GREEN: 'green',
  BLUE: 'blue',
  AMBER: 'amber',
  PURPLE: 'purple',
  SKY: 'sky',
} as const;

export const ACCENT_COLOR_VALUES = COLORS;
export type AccentColorKey = ColorKey;