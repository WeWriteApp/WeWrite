"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { hexToOklch, formatOklchForCSSVar, OKLCHColor, oklchToHex } from '../lib/oklch-utils';
import { useTheme } from '../providers/ThemeProvider';

// Default OKLCH values for independent light/dark modes
const DEFAULT_LIGHT_OKLCH = { l: 0.50, c: 0.33, h: 227 }; // H: 227, L: 50%, C: 33%
const DEFAULT_DARK_OKLCH = { l: 0.60, c: 0.33, h: 264 };  // H: 264, L: 60%, C: 33%

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

interface ThemeColorSettings {
  light: OKLCHColor;
  dark: OKLCHColor;
}

interface AccentColorContextType {
  // Legacy support for existing components
  accentColor: ColorKey | string;
  setAccentColor: (color: ColorKey | string) => void;
  getAccentColorValue: () => string;
  isCustomColor: () => boolean;

  // New independent theme color support
  lightColor: OKLCHColor;
  darkColor: OKLCHColor;
  setLightColor: (color: OKLCHColor) => void;
  setDarkColor: (color: OKLCHColor) => void;
  getCurrentThemeColor: () => OKLCHColor;
  setCurrentThemeColor: (color: OKLCHColor) => void;
}

const AccentColorContext = createContext<AccentColorContextType>({
  accentColor: 'blue',
  setAccentColor: () => {},
  getAccentColorValue: () => COLORS.blue,
  isCustomColor: () => false,
  lightColor: DEFAULT_LIGHT_OKLCH,
  darkColor: DEFAULT_DARK_OKLCH,
  setLightColor: () => {},
  setDarkColor: () => {},
  getCurrentThemeColor: () => DEFAULT_LIGHT_OKLCH,
  setCurrentThemeColor: () => {}
});

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColor] = useState<ColorKey | string>('blue');
  const [lightColor, setLightColor] = useState<OKLCHColor>(DEFAULT_LIGHT_OKLCH);
  const [darkColor, setDarkColor] = useState<OKLCHColor>(DEFAULT_DARK_OKLCH);
  const { resolvedTheme } = useTheme();

  const getAccentColorValue = useCallback(() => {
    if (typeof accentColor === 'string' && accentColor.startsWith('#')) {
      return accentColor; // Custom hex color
    }
    return COLORS[accentColor as ColorKey] || COLORS.blue;
  }, [accentColor]);

  const isCustomColor = useCallback(() => {
    return typeof accentColor === 'string' && accentColor.startsWith('#');
  }, [accentColor]);

  // Memoize the current theme color to avoid unnecessary effect runs
  const currentThemeColor = useMemo((): OKLCHColor => {
    return resolvedTheme === 'dark' ? darkColor : lightColor;
  }, [resolvedTheme, darkColor, lightColor]);

  const getCurrentThemeColor = useCallback((): OKLCHColor => {
    return currentThemeColor;
  }, [currentThemeColor]);

  const setCurrentThemeColor = useCallback((color: OKLCHColor) => {
    if (resolvedTheme === 'dark') {
      setDarkColor(color);
    } else {
      setLightColor(color);
    }
  }, [resolvedTheme]);

  // Load saved colors
  useEffect(() => {
    // Load legacy accent color
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

    // Load independent theme colors
    const savedLight = localStorage.getItem('accent-color-light');
    const savedDark = localStorage.getItem('accent-color-dark');

    if (savedLight) {
      try {
        const lightOklch = JSON.parse(savedLight);
        if (lightOklch.l !== undefined && lightOklch.c !== undefined && lightOklch.h !== undefined) {
          setLightColor(lightOklch);
        }
      } catch (e) {
        console.warn('Failed to parse saved light color:', e);
      }
    }

    if (savedDark) {
      try {
        const darkOklch = JSON.parse(savedDark);
        if (darkOklch.l !== undefined && darkOklch.c !== undefined && darkOklch.h !== undefined) {
          setDarkColor(darkOklch);
        }
      } catch (e) {
        console.warn('Failed to parse saved dark color:', e);
      }
    }
  }, []);

  // Save independent theme colors
  useEffect(() => {
    localStorage.setItem('accent-color-light', JSON.stringify(lightColor));
  }, [lightColor]);

  useEffect(() => {
    localStorage.setItem('accent-color-dark', JSON.stringify(darkColor));
  }, [darkColor]);

  // Save legacy color and update CSS
  // Note: On the landing page, LandingColorContext handles CSS variables for scroll animation
  // so we skip CSS updates here to prevent overwriting the scroll-animated colors
  useEffect(() => {
    localStorage.setItem('accent-color', accentColor.toString());

    // Skip CSS variable updates on landing page - LandingColorContext handles scroll animation
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      return;
    }

    // Use the memoized current theme color for CSS variables (already computed)
    const currentColor = currentThemeColor;

    // Also support legacy color system
    const colorValue = getAccentColorValue();
    let oklchValues: OKLCHColor;
    if (isCustomColor()) {
      // Convert custom hex to OKLCH
      const converted = hexToOklch(colorValue);
      oklchValues = converted || currentColor; // fallback to current theme color
    } else {
      // Use preset OKLCH values or current theme color
      const preset = COLOR_OKLCH[accentColor as ColorKey];
      if (preset) {
        oklchValues = { l: preset.l / 100, c: preset.c, h: preset.h }; // Convert lightness to 0-1 range
      } else {
        oklchValues = currentColor;
      }
    }

    // Prefer the independent theme color over legacy color
    // DEFENSIVE: Ensure we have valid OKLCH values with fallbacks
    const finalOklchValues = {
      l: currentColor?.l ?? DEFAULT_LIGHT_OKLCH.l,
      c: currentColor?.c ?? DEFAULT_LIGHT_OKLCH.c,
      h: currentColor?.h ?? DEFAULT_LIGHT_OKLCH.h
    };

    // Skip if we don't have valid values (prevents NaN in CSS)
    if (isNaN(finalOklchValues.l) || isNaN(finalOklchValues.c) || isNaN(finalOklchValues.h)) {
      console.warn('AccentColorContext: Invalid OKLCH values, skipping CSS update');
      return;
    }

    // Update CSS variables for OKLCH using the final values
    const finalHex = oklchToHex(finalOklchValues);
    document.documentElement.style.setProperty('--accent-color', finalHex || '#2563EB');
    // Use DECIMAL format for OKLCH values (not percentage) for browser compatibility
    document.documentElement.style.setProperty('--accent-l', finalOklchValues.l.toFixed(2));
    document.documentElement.style.setProperty('--accent-c', finalOklchValues.c.toFixed(2));
    document.documentElement.style.setProperty('--accent-h', finalOklchValues.h.toFixed(1));

    // Set base accent color for opacity-based system - DECIMAL format (e.g., "0.50 0.25 230")
    const baseAccent = `${finalOklchValues.l.toFixed(2)} ${finalOklchValues.c.toFixed(2)} ${finalOklchValues.h.toFixed(1)}`;
    document.documentElement.style.setProperty('--accent-base', baseAccent);

    // Set primary color to use the accent color
    document.documentElement.style.setProperty('--primary', baseAccent);

    // Set neutral base color (same hue as accent, reduced chroma for subtle appearance)
    const neutralChroma = Math.min(finalOklchValues.c * 0.3, 0.05); // Reduce chroma to 30% of accent, max 0.05
    const baseNeutral = `${finalOklchValues.l.toFixed(2)} ${neutralChroma.toFixed(2)} ${finalOklchValues.h.toFixed(1)}`;
    document.documentElement.style.setProperty('--neutral-base', baseNeutral);

    // Dynamic primary foreground color based on accent lightness (DECIMAL format)
    // Use black text for bright accent colors (>70% lightness), white text for darker colors
    const primaryForegroundColor = finalOklchValues.l > 0.70 ? '0.00 0.00 0.0' : '1.00 0.00 0.0';
    document.documentElement.style.setProperty('--primary-foreground', primaryForegroundColor);

    // Convert hex to RGB for --accent-color-rgb (kept for compatibility)
    const safeHex = (finalHex || '#2563EB').replace('#', '');
    const r = parseInt(safeHex.substr(0, 2), 16) || 37;
    const g = parseInt(safeHex.substr(2, 2), 16) || 99;
    const b = parseInt(safeHex.substr(4, 2), 16) || 235;
    document.documentElement.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`);
  }, [accentColor, currentThemeColor, getAccentColorValue, isCustomColor]);

  return (
    <AccentColorContext.Provider value={{
      accentColor,
      setAccentColor,
      getAccentColorValue,
      isCustomColor,
      lightColor,
      darkColor,
      setLightColor,
      setDarkColor,
      getCurrentThemeColor,
      setCurrentThemeColor
    }}>
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

// Helper function to get OKLCH CSS variable format for a color (DECIMAL format)
export function getColorOklchVar(colorKey: ColorKey): string {
  const oklch = COLOR_OKLCH[colorKey];
  // Convert lightness from percentage (0-100) to decimal (0-1) for OKLCH
  return `${(oklch.l / 100).toFixed(2)} ${oklch.c.toFixed(2)} ${oklch.h.toFixed(1)}`;
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