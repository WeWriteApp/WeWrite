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
  pink: '#EC4899',
} as const;

// HSL values for CSS variables
const COLOR_HSL = {
  blue: { h: 217, s: 91, l: 60 },
  red: { h: 356, s: 75, l: 59 },
  green: { h: 142, s: 43, l: 56 },
  purple: { h: 262, s: 83, l: 58 },
  amber: { h: 43, s: 96, l: 56 },
  sky: { h: 199, s: 89, l: 48 },
  pink: { h: 330, s: 81, l: 60 },
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
    const colorValue = getAccentColorValue();
    const hslValues = COLOR_HSL[accentColor];

    // Update CSS variables
    document.documentElement.style.setProperty('--accent-color', colorValue);
    document.documentElement.style.setProperty('--accent-h', hslValues.h.toString());
    document.documentElement.style.setProperty('--accent-s', `${hslValues.s}%`);
    document.documentElement.style.setProperty('--accent-l', `${hslValues.l}%`);

    // Convert hex to RGB for --accent-color-rgb
    const hex = colorValue.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    document.documentElement.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`);
  }, [accentColor, getAccentColorValue]);

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
  PINK: 'pink',
} as const;

export const ACCENT_COLOR_VALUES = COLORS;
export type AccentColorKey = ColorKey;