"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

// Try to import color-namer, but provide a fallback if it fails
let colorNamer;
try {
  colorNamer = require('color-namer');
} catch (error) {
  console.warn('color-namer package not available, using fallback color naming');
  // Simple fallback function that returns a generic name
  colorNamer = (hex) => ({
    ntc: [{ name: 'Custom Color' }],
    basic: [{ name: 'Custom' }]
  });
}

// Define available accent colors
export const ACCENT_COLORS = {
  RED: 'red',
  GREEN: 'green',
  BLUE: 'blue',
  CUSTOM1: 'custom1',
  CUSTOM2: 'custom2',
  CUSTOM3: 'custom3'
};

// Color values for each accent color
export const ACCENT_COLOR_VALUES = {
  [ACCENT_COLORS.RED]: 'hsl(0, 84%, 60%)',
  [ACCENT_COLORS.GREEN]: 'hsl(120, 84%, 60%)',
  [ACCENT_COLORS.BLUE]: '#1768FF',
  [ACCENT_COLORS.CUSTOM1]: '#FF5733', // Default to a coral/orange
  [ACCENT_COLORS.CUSTOM2]: '#9B59B6', // Default to a purple
  [ACCENT_COLORS.CUSTOM3]: '#3498DB'  // Default to a light blue
};

// Get a friendly name for a color
export const getColorName = (hexColor) => {
  try {
    // Basic color name mapping for common colors
    const basicColorMap = {
      '#FF0000': 'Red',
      '#00FF00': 'Green',
      '#0000FF': 'Blue',
      '#FFFF00': 'Yellow',
      '#FF00FF': 'Magenta',
      '#00FFFF': 'Cyan',
      '#FF5733': 'Coral',
      '#9B59B6': 'Purple',
      '#3498DB': 'Sky Blue',
      '#1768FF': 'Royal Blue',
      '#000000': 'Black',
      '#FFFFFF': 'White'
    };

    // Normalize hex color
    const normalizedHex = hexColor.toUpperCase();

    // Check if it's a basic color we know
    if (basicColorMap[normalizedHex]) {
      return basicColorMap[normalizedHex];
    }

    // Try to get color names from the library
    try {
      const names = colorNamer(hexColor);

      // Try to get a name from the 'ntc' list (Name That Color)
      if (names.ntc && names.ntc.length > 0) {
        return names.ntc[0].name;
      }

      // Fall back to the basic list
      if (names.basic && names.basic.length > 0) {
        return names.basic[0].name;
      }
    } catch (libraryError) {
      console.warn('Color naming library error:', libraryError);
      // Continue to fallback
    }

    // Fallback: Generate a name based on RGB values
    if (hexColor.startsWith('#') && (hexColor.length === 7 || hexColor.length === 4)) {
      let r, g, b;

      if (hexColor.length === 7) {
        r = parseInt(hexColor.substring(1, 3), 16);
        g = parseInt(hexColor.substring(3, 5), 16);
        b = parseInt(hexColor.substring(5, 7), 16);
      } else {
        // Handle shorthand hex (#RGB)
        r = parseInt(hexColor.charAt(1) + hexColor.charAt(1), 16);
        g = parseInt(hexColor.charAt(2) + hexColor.charAt(2), 16);
        b = parseInt(hexColor.charAt(3) + hexColor.charAt(3), 16);
      }

      // Determine dominant color
      const max = Math.max(r, g, b);
      let colorName = 'Custom';

      if (r === g && g === b) {
        const brightness = r / 255;
        if (brightness > 0.8) return 'White';
        if (brightness < 0.2) return 'Black';
        return `Gray (${Math.round(brightness * 100)}%)`;
      }

      if (max === r) colorName = 'Red';
      else if (max === g) colorName = 'Green';
      else if (max === b) colorName = 'Blue';

      // Add intensity
      const intensity = Math.round((max / 255) * 100);
      return `${colorName} (${intensity}%)`;
    }

    return 'Custom';
  } catch (error) {
    console.error('Error getting color name:', error);
    return 'Custom';
  }
};

// Calculate luminance to determine if text should be light or dark
export const getTextColorForBackground = (bgColor) => {
  // Convert color to RGB
  let r, g, b;

  if (bgColor.startsWith('#')) {
    // Hex color
    const hex = bgColor.replace(/^#/, '');
    if (hex.length === 3) {
      r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
      g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
      b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
    } else {
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
    }
  } else if (bgColor.startsWith('hsl')) {
    // HSL color - convert to RGB
    const hslMatch = bgColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/) ||
                    bgColor.match(/hsl\((\d+),\s*(\d+\.?\d*)%,\s*(\d+\.?\d*)%\)/);

    if (hslMatch) {
      const h = parseInt(hslMatch[1]) / 360;
      const s = parseInt(hslMatch[2]) / 100;
      const l = parseInt(hslMatch[3]) / 100;

      if (s === 0) {
        r = g = b = l;
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

        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
    } else {
      // Default to middle gray if parsing fails
      r = g = b = 0.5;
    }
  } else {
    // Default to middle gray for unknown formats
    r = g = b = 0.5;
  }

  // Calculate relative luminance using the formula from WCAG 2.0
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Return white for dark backgrounds, black for light backgrounds
  // Using a higher threshold (0.55) to ensure better contrast for primary buttons
  return luminance < 0.55 ? '#ffffff' : '#000000';
};

const AccentColorContext = createContext();

export function AccentColorProvider({ children }) {
  // Try to load from localStorage, default to blue
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS.BLUE);
  const [customColors, setCustomColors] = useState({
    [ACCENT_COLORS.CUSTOM1]: ACCENT_COLOR_VALUES[ACCENT_COLORS.CUSTOM1],
    [ACCENT_COLORS.CUSTOM2]: ACCENT_COLOR_VALUES[ACCENT_COLORS.CUSTOM2],
    [ACCENT_COLORS.CUSTOM3]: ACCENT_COLOR_VALUES[ACCENT_COLORS.CUSTOM3]
  });
  // Store color names
  const [colorNames, setColorNames] = useState({
    [ACCENT_COLORS.CUSTOM1]: 'Custom 1',
    [ACCENT_COLORS.CUSTOM2]: 'Custom 2',
    [ACCENT_COLORS.CUSTOM3]: 'Custom 3'
  });
  const [textColor, setTextColor] = useState('#ffffff'); // Default text color

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

  // Update CSS variables when accent color changes
  const updateCSSVariables = (color, colorValue) => {
    console.log('Updating CSS variables with:', { color, colorValue });

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
        h = parseInt(hslMatch[1]);
        s = parseInt(hslMatch[2]);
        l = parseInt(hslMatch[3]);
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

    // Calculate and set text color
    const newTextColor = getTextColorForBackground(colorValue);
    setTextColor(newTextColor);
    document.documentElement.style.setProperty('--accent-text', newTextColor);

    // Ensure primary button text has good contrast
    document.documentElement.style.setProperty('--primary-foreground', newTextColor);
  };

  // Load saved accent color from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAccentColor = localStorage.getItem('accentColor');
      const savedCustomColors = JSON.parse(localStorage.getItem('customAccentColors') || '{}');

      let colorToUse = accentColor;
      let valueToUse;

      // Load saved accent color
      if (savedAccentColor && Object.values(ACCENT_COLORS).includes(savedAccentColor)) {
        colorToUse = savedAccentColor;
        setAccentColor(savedAccentColor);
      }

      // Load saved custom colors
      const newCustomColors = { ...customColors };
      let customColorsUpdated = false;

      // Check each custom color slot
      Object.keys(newCustomColors).forEach(key => {
        if (savedCustomColors[key]) {
          newCustomColors[key] = savedCustomColors[key];
          customColorsUpdated = true;
        }
      });

      if (customColorsUpdated) {
        setCustomColors(newCustomColors);
      }

      // Load saved color names
      const savedColorNames = JSON.parse(localStorage.getItem('customColorNames') || '{}');
      const newColorNames = { ...colorNames };
      let colorNamesUpdated = false;

      // Check each color name
      Object.keys(newColorNames).forEach(key => {
        if (savedColorNames[key]) {
          newColorNames[key] = savedColorNames[key];
          colorNamesUpdated = true;
        } else if (newCustomColors[key]) {
          // If we have a color but no saved name, generate one
          newColorNames[key] = getColorName(newCustomColors[key]);
          colorNamesUpdated = true;
        }
      });

      if (colorNamesUpdated) {
        setColorNames(newColorNames);
      }

      // Determine the color value to use
      if (colorToUse.startsWith('custom') && newCustomColors[colorToUse]) {
        valueToUse = newCustomColors[colorToUse];
      } else {
        valueToUse = ACCENT_COLOR_VALUES[colorToUse];
      }

      // Apply the accent color to CSS variables
      updateCSSVariables(colorToUse, valueToUse);
    }
  }, []);

  // Change accent color and save to localStorage
  const changeAccentColor = (color, customColorValue = null) => {
    console.log('Changing accent color:', { color, customColorValue });

    setAccentColor(color);
    localStorage.setItem('accentColor', color);

    let valueToUse;

    if (color.startsWith('custom') && customColorValue) {
      // Update the specific custom color
      valueToUse = customColorValue;

      // Update custom colors state
      const newCustomColors = { ...customColors, [color]: customColorValue };
      setCustomColors(newCustomColors);

      // Save all custom colors to localStorage
      localStorage.setItem('customAccentColors', JSON.stringify(newCustomColors));

      // Update the color name
      const colorName = getColorName(customColorValue);
      const newColorNames = { ...colorNames, [color]: colorName };
      setColorNames(newColorNames);
      localStorage.setItem('customColorNames', JSON.stringify(newColorNames));
    } else if (color.startsWith('custom')) {
      // Use existing custom color
      valueToUse = customColors[color] || ACCENT_COLOR_VALUES[color];
    } else {
      // Use predefined color
      valueToUse = ACCENT_COLOR_VALUES[color];
    }

    updateCSSVariables(color, valueToUse);
  };

  // Set a specific custom color
  const setCustomColor = (customSlot, colorValue) => {
    if (!customSlot.startsWith('custom')) return;

    console.log('Setting custom color:', { customSlot, colorValue });

    // Update the custom color
    const newCustomColors = { ...customColors, [customSlot]: colorValue };
    setCustomColors(newCustomColors);
    localStorage.setItem('customAccentColors', JSON.stringify(newCustomColors));

    // Get the color name using the color naming library
    const colorName = getColorName(colorValue);
    console.log('Generated color name:', colorName, 'for color:', colorValue);

    // Update the color name in state
    const newColorNames = { ...colorNames, [customSlot]: colorName };
    setColorNames(newColorNames);

    // Save to localStorage
    localStorage.setItem('customColorNames', JSON.stringify(newColorNames));
    console.log('Updated color names:', newColorNames);

    // If this is the currently selected color, update the CSS variables
    if (accentColor === customSlot) {
      updateCSSVariables(customSlot, colorValue);
    }
  };

  return (
    <AccentColorContext.Provider
      value={{
        accentColor,
        customColors,
        colorNames,
        textColor,
        changeAccentColor,
        setCustomColor,
        getTextColorForBackground,
        getColorName
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
