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
  [ACCENT_COLORS.BLUE]: '#1768FF',
  [ACCENT_COLORS.PURPLE]: 'hsl(270, 84%, 60%)',
  [ACCENT_COLORS.CUSTOM]: '#1768FF' // Default to blue for custom
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

    // Function to convert hex to HSL
    const hexToHSL = (hex) => {
      // Remove the # if present
      hex = hex.replace(/^#/, '');

      // Parse the hex values
      let r, g, b;
      if (hex.length === 3) {
        r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
        g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
        b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
      } else {
        r = parseInt(hex.substring(0, 2), 16) / 255;
        g = parseInt(hex.substring(2, 4), 16) / 255;
        b = parseInt(hex.substring(4, 6), 16) / 255;
      }

      // Find min and max values
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0; // achromatic
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }

        h = Math.round(h * 60);
      }

      s = Math.round(s * 100);
      l = Math.round(l * 100);

      return { h, s, l };
    };

    let h, s, l;

    // Extract HSL values from the color string
    if (colorValue.startsWith('#')) {
      // It's a hex color
      const hsl = hexToHSL(colorValue);
      h = hsl.h;
      s = hsl.s;
      l = hsl.l;
    } else {
      // Try to parse as HSL
      const hslMatch = colorValue.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/) ||
                      colorValue.match(/hsl\((\d+),\s*(\d+\.?\d*)%,\s*(\d+\.?\d*)%\)/);

      if (hslMatch) {
        [_, h, s, l] = hslMatch;
      } else {
        // Default values if parsing fails
        h = 217;
        s = 91;
        l = 60;
      }
    }

    // Set the CSS variables
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
