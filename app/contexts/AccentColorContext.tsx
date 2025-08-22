"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { hexToOklch, formatOklchForCSSVar, OKLCHColor } from '../lib/oklch-utils';

// SIMPLE accent colors - no 792-line nightmare
const COLORS = {
  blue: '#2563EB',  // Updated to 230° hue blue
  red: '#E5484D',
  green: '#46A758',
  purple: '#8B5CF6',
  amber: '#F59E0B',
  sky: '#0EA5E9',
  pink: '#EC4899',
} as const;

// OKLCH values for CSS variables (converted from original hex colors)
const COLOR_OKLCH = {
  blue: { l: 48.64, c: 0.8787, h: 230.0 },    // #2563EB - 230° hue blue
  red: { l: 53.85, c: 0.6863, h: 28.0 },      // #E5484D
  green: { l: 61.34, c: 0.5602, h: 144.7 },   // #46A758
  purple: { l: 51.61, c: 0.8844, h: 306.9 },  // #8B5CF6
  amber: { l: 72.16, c: 0.7881, h: 72.7 },    // #F59E0B
  sky: { l: 64.07, c: 0.4524, h: 255.8 },     // #0EA5E9
  pink: { l: 56.85, c: 0.6930, h: 353.1 },    // #EC4899
} as const;

type ColorKey = keyof typeof COLORS;

interface AccentColorContextType {
  accentColor: ColorKey | string; // Support custom hex colors
  setAccentColor: (color: ColorKey | string) => void;
  getAccentColorValue: () => string;
  isCustomColor: () => boolean;
}

const AccentColorContext = createContext<AccentColorContextType>({
  accentColor: 'blue',
  setAccentColor: () => {},
  getAccentColorValue: () => COLORS.blue,
  isCustomColor: () => false
});

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColor] = useState<ColorKey | string>('blue');

  const getAccentColorValue = () => {
    if (typeof accentColor === 'string' && accentColor.startsWith('#')) {
      return accentColor; // Custom hex color
    }
    return COLORS[accentColor as ColorKey] || COLORS.blue;
  };

  const isCustomColor = () => {
    return typeof accentColor === 'string' && accentColor.startsWith('#');
  };

  // Load saved color
  useEffect(() => {
    const saved = localStorage.getItem('accent-color');
    if (saved) {
      if (saved.startsWith('#')) {
        // Custom hex color
        setAccentColor(saved);
      } else if (saved in COLORS) {
        // Preset color
        setAccentColor(saved as ColorKey);
      }
    }
  }, []);

  // Save color and update CSS
  useEffect(() => {
    localStorage.setItem('accent-color', accentColor.toString());
    const colorValue = getAccentColorValue();

    let oklchValues: OKLCHColor;
    if (isCustomColor()) {
      // Convert custom hex to OKLCH
      const converted = hexToOklch(colorValue);
      oklchValues = converted || { l: 0.5593, c: 0.6617, h: 284.9 }; // fallback to blue
    } else {
      // Use preset OKLCH values
      const preset = COLOR_OKLCH[accentColor as ColorKey] || COLOR_OKLCH.blue;
      oklchValues = { l: preset.l / 100, c: preset.c, h: preset.h }; // Convert lightness to 0-1 range
    }

    // Update CSS variables for OKLCH
    document.documentElement.style.setProperty('--accent-color', colorValue);
    document.documentElement.style.setProperty('--accent-l', `${(oklchValues.l * 100).toFixed(2)}%`);
    document.documentElement.style.setProperty('--accent-c', oklchValues.c.toFixed(4));
    document.documentElement.style.setProperty('--accent-h', oklchValues.h.toFixed(1));

    // Set base accent color for opacity-based system
    const baseAccent = `${(oklchValues.l * 100).toFixed(2)}% ${oklchValues.c.toFixed(4)} ${oklchValues.h.toFixed(1)}`;
    document.documentElement.style.setProperty('--accent-base', baseAccent);

    // Set primary color to use the accent color
    document.documentElement.style.setProperty('--primary', baseAccent);

    // Set neutral base color (same hue as accent, reduced chroma for subtle appearance)
    const neutralChroma = Math.min(oklchValues.c * 0.3, 0.05); // Reduce chroma to 30% of accent, max 0.05
    const baseNeutral = `${(oklchValues.l * 100).toFixed(2)}% ${neutralChroma.toFixed(4)} ${oklchValues.h.toFixed(1)}`;
    document.documentElement.style.setProperty('--neutral-base', baseNeutral);

    // Dynamic primary foreground color based on accent lightness
    // Use black text for bright accent colors (>70% lightness), white text for darker colors
    const primaryForegroundColor = oklchValues.l > 0.70 ? '0.00% 0.0000 0.0' : '100.00% 0.0000 158.2';
    document.documentElement.style.setProperty('--primary-foreground', primaryForegroundColor);

    // Convert hex to RGB for --accent-color-rgb (kept for compatibility)
    const hex = colorValue.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    document.documentElement.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`);
  }, [accentColor, getAccentColorValue, isCustomColor]);

  return (
    <AccentColorContext.Provider value={{ accentColor, setAccentColor, getAccentColorValue, isCustomColor }}>
      {children}
    </AccentColorContext.Provider>
  );
}

// Helper function to get OKLCH values for a color
function getOklchValues(colorKey: ColorKey): OKLCHColor {
  const preset = COLOR_OKLCH[colorKey] || COLOR_OKLCH.blue;
  return { l: preset.l / 100, c: preset.c, h: preset.h };
}

export const useAccentColor = () => {
  const context = useContext(AccentColorContext);
  if (!context) {
    throw new Error('useAccentColor must be used within AccentColorProvider');
  }
  return context;
};

// Export for external use
export { COLORS, COLOR_OKLCH };
export type { ColorKey };

// Helper function to get OKLCH CSS variable format for a color
export function getColorOklchVar(colorKey: ColorKey): string {
  const oklch = COLOR_OKLCH[colorKey];
  return `${oklch.l.toFixed(2)}% ${oklch.c.toFixed(4)} ${oklch.h.toFixed(1)}`;
}

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