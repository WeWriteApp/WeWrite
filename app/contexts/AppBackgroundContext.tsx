"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTheme } from '../providers/ThemeProvider';

// Background types - simplified to just solid (no images)
export type BackgroundType = 'solid';

export interface SolidBackground {
  type: 'solid';
  color: string; // hex color - always white for light theme
  darkColor?: string; // always black for dark theme
  oklchLight?: string; // OKLCH for light mode (white)
  oklchDark?: string; // OKLCH for dark mode (black)
}

export type AppBackground = SolidBackground;

// Only one default background option: white/black
const DEFAULT_SOLID_BACKGROUNDS: SolidBackground[] = [
  {
    type: 'solid',
    color: '#ffffff', // Pure white for light theme
    darkColor: '#000000', // Pure black for dark theme
    oklchLight: '100.00 0.00 0',
    oklchDark: '0.00 0.00 0'
  }
];

interface AppBackgroundContextType {
  background: AppBackground;
  setBackground: (background: AppBackground) => void;
  defaultSolidBackgrounds: SolidBackground[];
  resetToDefault: () => void;
}

const DEFAULT_BACKGROUND: SolidBackground = {
  type: 'solid',
  color: '#ffffff',
  darkColor: '#000000',
  oklchLight: '100.00 0.00 0',
  oklchDark: '0.00 0.00 0'
};

const AppBackgroundContext = createContext<AppBackgroundContextType>({
  background: DEFAULT_BACKGROUND,
  setBackground: () => {},
  defaultSolidBackgrounds: DEFAULT_SOLID_BACKGROUNDS,
  resetToDefault: () => {}
});

export function AppBackgroundProvider({ children }: { children: React.ReactNode }) {
  const [background] = useState<AppBackground>(DEFAULT_BACKGROUND);
  const { resolvedTheme } = useTheme();

  // Apply background when theme changes
  useEffect(() => {
    if (!resolvedTheme) return;
    applyBackgroundToDOM(background, resolvedTheme);
  }, [background, resolvedTheme]);

  const resetToDefault = () => {
    // No-op since background is always default
  };

  return (
    <AppBackgroundContext.Provider value={{
      background,
      setBackground: () => {}, // Disabled - always use default
      defaultSolidBackgrounds: DEFAULT_SOLID_BACKGROUNDS,
      resetToDefault
    }}>
      {children}
    </AppBackgroundContext.Provider>
  );
}

export const useAppBackground = () => {
  const context = useContext(AppBackgroundContext);
  if (!context) {
    throw new Error('useAppBackground must be used within AppBackgroundProvider');
  }
  return context;
};

// Helper function to apply background to DOM with theme awareness
function applyBackgroundToDOM(background: AppBackground, theme: string) {
  const root = document.documentElement;

  if (background.type === 'solid') {
    // Use the resolved theme from next-themes
    const isDark = theme === 'dark';

    // Use pre-computed OKLCH values
    const oklchValue = isDark ? background.oklchDark : background.oklchLight;

    root.style.setProperty('--background', oklchValue || (isDark ? '0.00 0.00 0' : '100.00 0.00 0'));
    root.style.setProperty('--background-image', 'none');
  }
}

// Export types and defaults for external use
export { DEFAULT_SOLID_BACKGROUNDS, DEFAULT_BACKGROUND };
