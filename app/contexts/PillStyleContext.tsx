"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { getBestTextColor } from "../utils/accessibility";
import { useAccentColor } from "./AccentColorContext";
import { hexToOklch } from "../lib/oklch-utils";

// Define the available pill styles
export const PILL_STYLES = {
  FILLED: 'filled',
  OUTLINE: 'outline',
  TEXT_ONLY: 'text_only',
  UNDERLINED: 'underlined'
} as const;

export type PillStyle = typeof PILL_STYLES[keyof typeof PILL_STYLES];

interface PillStyleContextType {
  pillStyle: PillStyle;
  changePillStyle: (style: PillStyle) => void;
  getPillStyleClasses: (context?: string) => string;
  getTextColorForPill: (backgroundColor: string) => string;
}

interface PillStyleProviderProps {
  children: React.ReactNode;
}

// Create the context
const PillStyleContext = createContext<PillStyleContextType>({
  pillStyle: PILL_STYLES.FILLED,
  changePillStyle: () => {},
  getPillStyleClasses: () => '',
  getTextColorForPill: () => '#ffffff'
});

export function usePillStyle(): PillStyleContextType {
  return useContext(PillStyleContext);
}

export function PillStyleProvider({ children }: PillStyleProviderProps) {
  // Try to load from localStorage, default to filled
  const [pillStyle, setPillStyle] = useState(PILL_STYLES.FILLED);
  const { theme } = useTheme();
  const { accentColor } = useAccentColor();

  // Determine text color for filled pills based on accent color lightness
  const getFilledTextColor = useCallback(() => {
    const oklch = hexToOklch(accentColor);
    if (oklch && oklch.l >= 0.80) {
      return 'text-black'; // Use black text for light backgrounds (≥80% lightness)
    }
    return 'text-white'; // Use white text for dark backgrounds (<80% lightness)
  }, [accentColor]);

  // Load saved preference on mount
  useEffect(() => {
    const savedStyle = localStorage.getItem('pillStyle');
    if (savedStyle) {
      // Handle backward compatibility: migrate 'classic' to 'text_only'
      if (savedStyle === 'classic') {
        setPillStyle(PILL_STYLES.TEXT_ONLY);
        localStorage.setItem('pillStyle', PILL_STYLES.TEXT_ONLY);
      } else if (Object.values(PILL_STYLES).includes(savedStyle)) {
        setPillStyle(savedStyle);
      }
    }
  }, []);

  // Change pill style and save to localStorage - memoized to prevent re-renders
  const changePillStyle = useCallback((style: PillStyle): void => {
    if (Object.values(PILL_STYLES).includes(style)) {
      setPillStyle(style);
      localStorage.setItem('pillStyle', style);
    }
  }, []);

  // Get the complete pill styling classes - memoized to prevent re-computation on every render
  const getPillStyleClasses = useMemo(() => {
    return (context?: string): string => {
      // Base classes that apply to all pill styles
      const displayClass = 'inline-flex';

      const baseClasses = `
        ${displayClass}
        items-center
        text-sm font-medium
        rounded-lg
        transition-all duration-150 ease-out
        hover:scale-[1.05]
        active:scale-[0.95]
        hover:shadow-sm
        active:shadow-none
        transform-gpu
        text-indent-0
        float-none
        leading-tight
        w-auto
        max-w-[calc(100vw-2rem)]
        my-0.5
        vertical-align-baseline
        focus-visible:ring-2
        focus-visible:ring-accent
        focus-visible:ring-offset-2
        focus-visible:outline-none
      `.trim().replace(/\s+/g, ' ');

      // Style-specific classes
      let styleClasses = '';
      if (pillStyle === PILL_STYLES.OUTLINE) {
        styleClasses = `
          bg-transparent text-accent-100
          border border-accent-70
          hover:bg-accent-10 hover:border-accent-100
          active:bg-accent-15 active:border-accent-100
          pill-outline-style
          px-2 py-0.5
        `;
      } else if (pillStyle === PILL_STYLES.TEXT_ONLY) {
        styleClasses = `
          bg-transparent text-accent-100 font-bold
          border-none
          hover:underline hover:bg-accent-5
          active:bg-accent-10
          shadow-none
          px-1
          pill-text-style
        `;
      } else if (pillStyle === PILL_STYLES.UNDERLINED) {
        styleClasses = `
          bg-transparent text-accent-100 font-bold
          border-none
          underline
          hover:decoration-2 hover:bg-accent-5
          active:bg-accent-10
          shadow-none
          px-1
          pill-underlined-style
        `;
      } else {
        // Default filled style - dynamic text color based on accent lightness
        const textColor = getFilledTextColor();
        styleClasses = `
          bg-accent-100
          border border-accent-100
          hover:bg-accent-80 dark:hover:bg-accent-120
          active:bg-accent-70 dark:active:bg-accent-140
          hover:shadow-md
          active:shadow-sm
          ${textColor} !important
          px-2 py-0.5
          pill-filled-style
        `;
      }

      return `${baseClasses} ${styleClasses}`.trim().replace(/\s+/g, ' ');
    };
  }, [pillStyle, accentColor]); // Recompute when pillStyle or accentColor changes

  // Get the best text color for a pill based on its background - memoized for performance
  const getTextColorForPill = useCallback((backgroundColor: string): string => {
    // Force white text on dark backgrounds for better readability
    // This is a more aggressive approach to ensure contrast
    try {
      // Parse the background color to determine its brightness
      let r, g, b;

      if (backgroundColor.startsWith('#')) {
        // Handle hex colors
        const hex = backgroundColor.replace('#', '');
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      } else if (backgroundColor.startsWith('hsl')) {
        // Handle HSL colors - convert to RGB first
        const hslMatch = backgroundColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (hslMatch) {
          const h = parseInt(hslMatch[1]) / 360;
          const s = parseInt(hslMatch[2]) / 100;
          const l = parseInt(hslMatch[3]) / 100;

          // HSL to RGB conversion
          if (s === 0) {
            r = g = b = Math.round(l * 255);
          } else {
            const hue2rgb = (p, q, t) => {
              if (t < 0) t += 1;
              if (t > 1) t -= 1;
              if (t < 1/6) return p + (q - p) * 6 * t;
              if (t < 1/2) return q;
              if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
              return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
            g = Math.round(hue2rgb(p, q, h) * 255);
            b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
          }
        }
      } else if (backgroundColor.startsWith('rgb')) {
        // Handle RGB colors
        const rgbMatch = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          r = parseInt(rgbMatch[1]);
          g = parseInt(rgbMatch[2]);
          b = parseInt(rgbMatch[3]);
        }
      }

      // Calculate perceived brightness using the formula: (0.299*R + 0.587*G + 0.114*B)
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Use white text for darker backgrounds (brightness < 0.6)
      // Use black text for lighter backgrounds (brightness >= 0.6)
      return brightness < 0.6 ? '#ffffff' : '#000000';
    } catch (error) {
      // Fall back to the standard contrast function if there's an error (no logging to prevent spam)
      return getBestTextColor(backgroundColor, {
        level: 'AAA',
        size: 'normal',
        preferredColors: ['#ffffff', '#000000']
      });
    }
  }, []); // No dependencies since this is a pure function

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    pillStyle,
    changePillStyle,
    getPillStyleClasses,
    getTextColorForPill
  }), [pillStyle, changePillStyle, getPillStyleClasses, getTextColorForPill]);

  return (
    <PillStyleContext.Provider value={contextValue}>
      {children}
    </PillStyleContext.Provider>
  );
}

export default PillStyleContext;