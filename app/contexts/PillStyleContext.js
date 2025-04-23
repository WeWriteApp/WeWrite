"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { getBestTextColor } from '../utils/accessibility';

// Define the available pill styles
export const PILL_STYLES = {
  FILLED: 'filled',
  OUTLINE: 'outline',
  CLASSIC: 'classic'
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
  const getPillStyleClasses = () => {
    if (pillStyle === PILL_STYLES.OUTLINE) {
      return `
        bg-transparent text-primary
        border-[1.5px] border-primary/40
        hover:bg-primary/10 hover:border-primary/60
        shadow-inner
      `;
    } else if (pillStyle === PILL_STYLES.CLASSIC) {
      return `
        bg-transparent text-primary font-bold
        border-none
        hover:underline
        shadow-none
      `;
    } else {
      // Default filled style
      // Force white text for better contrast regardless of background
      return `
        bg-primary
        border-[1.5px] border-primary/20
        hover:bg-primary/90 hover:border-primary/30
        text-white
      `;
    }
  };

  // Get the best text color for a pill based on its background
  // This ensures proper contrast for accessibility
  const getTextColorForPill = (backgroundColor) => {
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
      console.error('Error determining text color:', error);
      // Fall back to the standard contrast function if there's an error
      return getBestTextColor(backgroundColor, {
        level: 'AAA',
        size: 'normal',
        preferredColors: ['#ffffff', '#000000']
      });
    }
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
