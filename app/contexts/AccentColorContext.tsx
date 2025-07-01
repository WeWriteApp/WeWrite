"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getBestTextColor, meetsContrastStandards } from "../utils/accessibility";

// Import Radix colors
import {
  blue,
  red,
  green,
  amber,
  purple,
  sky,
  slate,
  grass,
  tomato,
  indigo
} from '@radix-ui/colors';

/**
 * Available accent color keys
 */
export const ACCENT_COLORS = {
  RED: 'red',
  GREEN: 'green',
  BLUE: 'blue',
  AMBER: 'amber',
  PURPLE: 'purple',
  SKY: 'sky',
  INDIGO: 'indigo',
  TOMATO: 'tomato',
  GRASS: 'grass',
  HIGH_CONTRAST: 'high-contrast', // Color that changes between black/white based on theme
  CUSTOM1: 'custom1',
  CUSTOM2: 'custom2',
  CUSTOM3: 'custom3'
} as const;

/**
 * Type for accent color values
 */
export type AccentColorKey = typeof ACCENT_COLORS[keyof typeof ACCENT_COLORS];

/**
 * Color values for each accent color using Radix colors
 */
export const ACCENT_COLOR_VALUES: Record<AccentColorKey, string> = {
  [ACCENT_COLORS.RED]: red.red9,
  [ACCENT_COLORS.GREEN]: green.green9,
  [ACCENT_COLORS.BLUE]: '#1768FF', // Updated blue color
  [ACCENT_COLORS.AMBER]: amber.amber9,
  [ACCENT_COLORS.PURPLE]: purple.purple9,
  [ACCENT_COLORS.SKY]: sky.sky9,
  [ACCENT_COLORS.INDIGO]: indigo.indigo9,
  [ACCENT_COLORS.TOMATO]: tomato.tomato9,
  [ACCENT_COLORS.GRASS]: grass.grass9,
  [ACCENT_COLORS.HIGH_CONTRAST]: '#000000', // Default to black, will be updated based on theme
  [ACCENT_COLORS.CUSTOM1]: '#FF5733', // Default to a coral/orange
  [ACCENT_COLORS.CUSTOM2]: '#9B59B6', // Default to a purple
  [ACCENT_COLORS.CUSTOM3]: '#3498DB'  // Default to a light blue
};

/**
 * Get a friendly name for a color
 *
 * @param hexColor - The hex color string to get a name for
 * @returns A human-readable color name
 */
export const getColorName = (hexColor: string): string => {
  try {
    // Basic color name mapping for common colors
    const basicColorMap: Record<string, string> = {
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

    // Fallback: Generate a name based on RGB values
    if (hexColor.startsWith('#') && (hexColor.length === 7 || hexColor.length === 4)) {
      let r: number, g: number, b: number;

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

/**
 * RGB color interface
 */
interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Convert RGB components to relative luminance according to WCAG 2.0
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Relative luminance value
 */
const getLuminance = (r: number, g: number, b: number): number => {
  // Convert RGB to sRGB
  const sRGB = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  // Calculate luminance using the formula from WCAG 2.0
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
};

/**
 * Calculate contrast ratio between two luminance values according to WCAG 2.0
 *
 * @param luminance1 - First luminance value
 * @param luminance2 - Second luminance value
 * @returns Contrast ratio
 */
const getContrastRatio = (luminance1: number, luminance2: number): number => {
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Parse any color format to RGB values
 *
 * @param color - Color string in hex, hsl, or other format
 * @returns RGB color object
 */
const parseColorToRGB = (color: string): RGBColor => {
  let r: number, g: number, b: number;

  if (color.startsWith('#')) {
    // Hex color
    const hex = color.replace(/^#/, '');
    if (hex.length === 3) {
      r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
      g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
      b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (color.startsWith('hsl')) {
    // HSL color - convert to RGB
    const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/) ||
                    color.match(/hsl\((\d+),\s*(\d+\.?\d*)%,\s*(\d+\.?\d*)%\)/);

    if (hslMatch) {
      const h = parseInt(hslMatch[1]) / 360;
      const s = parseInt(hslMatch[2]) / 100;
      const l = parseInt(hslMatch[3]) / 100;

      if (s === 0) {
        r = g = b = Math.round(l * 255);
      } else {
        const hue2rgb = (p: number, q: number, t: number): number => {
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
    } else {
      // Default to middle gray if parsing fails
      r = g = b = 128;
    }
  } else {
    // Default to middle gray for unknown formats
    r = g = b = 128;
  }

  return { r, g, b };
};

/**
 * Get the best text color for a background color using accessibility utilities
 *
 * @param bgColor - Background color string
 * @param options - Options object (optional)
 * @returns Best text color for the background
 */
export const getTextColorForBackground = (bgColor: string, options: any = {}): string => {
  return getBestTextColor(bgColor, {
    level: 'AA',
    size: 'normal',
    preferredColors: ['#ffffff', '#000000']
  });
};

/**
 * HSL color interface
 */
interface HSLColor {
  h: number;
  s: number;
  l: number;
}

/**
 * Accent color context interface
 */
interface AccentColorContextType {
  accentColor: AccentColorKey;
  customColors: Record<string, string>;
  colorNames: Record<string, string>;
  textColor: string;
  changeAccentColor: (color: AccentColorKey, customColorValue?: string | null) => void;
  setCustomColor: (customSlot: string, colorValue: string) => void;
  getTextColorForBackground: (bgColor: string, options?: any) => string;
  getColorName: (hexColor: string) => string;
  getBestTextColor: typeof getBestTextColor;
  meetsContrastStandards: typeof meetsContrastStandards;
}

/**
 * Accent color provider props interface
 */
interface AccentColorProviderProps {
  children: ReactNode;
}

const AccentColorContext = createContext<AccentColorContextType | undefined>(undefined);

/**
 * AccentColorProvider component that manages accent color state and operations
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export function AccentColorProvider({ children }: AccentColorProviderProps) {
  // Try to load from localStorage, default to blue
  const [accentColor, setAccentColor] = useState<AccentColorKey>(ACCENT_COLORS.BLUE);
  const [customColors, setCustomColors] = useState<Record<string, string>>({
    [ACCENT_COLORS.CUSTOM1]: ACCENT_COLOR_VALUES[ACCENT_COLORS.CUSTOM1],
    [ACCENT_COLORS.CUSTOM2]: ACCENT_COLOR_VALUES[ACCENT_COLORS.CUSTOM2],
    [ACCENT_COLORS.CUSTOM3]: ACCENT_COLOR_VALUES[ACCENT_COLORS.CUSTOM3]
  });
  // Store color names
  const [colorNames, setColorNames] = useState<Record<string, string>>({
    [ACCENT_COLORS.CUSTOM1]: 'Custom 1',
    [ACCENT_COLORS.CUSTOM2]: 'Custom 2',
    [ACCENT_COLORS.CUSTOM3]: 'Custom 3'
  });
  const [textColor, setTextColor] = useState<string>('#ffffff'); // Default text color
  const [isHydrated, setIsHydrated] = useState(false); // Track hydration state

  /**
   * Convert hex color to HSL
   *
   * @param hex - Hex color string
   * @returns HSL color object
   */
  const hexToHSL = (hex: string): HSLColor => {
    // Remove the # if present
    hex = hex.replace(/^#/, '');

    // Parse the hex values
    let r: number, g: number, b: number;
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
    let h: number, s: number, l: number = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: h = 0; break;
      }

      h = Math.round(h * 60);
    }

    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return { h, s, l };
  };

  /**
   * Update CSS variables when accent color changes
   *
   * @param color - The accent color key
   * @param colorValue - The color value string
   */
  const updateCSSVariables = (color: AccentColorKey, colorValue: string): void => {
    // Only update CSS variables after hydration to prevent hydration mismatches
    if (!isHydrated || typeof window === 'undefined') {
      console.log('Skipping CSS variable update - not hydrated yet');
      return;
    }

    console.log('Updating CSS variables with:', { color, colorValue });

    // Special handling for high contrast color that changes based on theme
    if (color === ACCENT_COLORS.HIGH_CONTRAST) {
      // Check if we're in dark mode by looking at the document class
      const isDarkMode = document.documentElement.classList.contains('dark');

      // Set the color value based on the current theme
      colorValue = isDarkMode ? '#FFFFFF' : '#000000';

      console.log('High contrast color mode detected, using:', { isDarkMode, colorValue });
    }

    let h: number, s: number, l: number;

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

    // Update accent color in Radix color system
    document.documentElement.style.setProperty('--accent-1', `hsl(${h}, ${Math.max(5, s-85)}%, ${Math.min(99, l+30)}%)`);
    document.documentElement.style.setProperty('--accent-2', `hsl(${h}, ${Math.max(10, s-75)}%, ${Math.min(97, l+25)}%)`);
    document.documentElement.style.setProperty('--accent-3', `hsl(${h}, ${Math.max(15, s-65)}%, ${Math.min(95, l+20)}%)`);
    document.documentElement.style.setProperty('--accent-4', `hsl(${h}, ${Math.max(20, s-55)}%, ${Math.min(92, l+15)}%)`);
    document.documentElement.style.setProperty('--accent-5', `hsl(${h}, ${Math.max(25, s-45)}%, ${Math.min(90, l+10)}%)`);
    document.documentElement.style.setProperty('--accent-6', `hsl(${h}, ${Math.max(30, s-35)}%, ${Math.min(85, l+5)}%)`);
    document.documentElement.style.setProperty('--accent-7', `hsl(${h}, ${Math.max(35, s-25)}%, ${Math.min(80, l)}%)`);
    document.documentElement.style.setProperty('--accent-8', `hsl(${h}, ${Math.max(40, s-15)}%, ${Math.max(55, l-5)}%)`);
    document.documentElement.style.setProperty('--accent-9', `hsl(${h}, ${Math.max(45, s-5)}%, ${Math.max(50, l-10)}%)`);
    document.documentElement.style.setProperty('--accent-10', `hsl(${h}, ${Math.max(50, s)}%, ${Math.max(45, l-15)}%)`);
    document.documentElement.style.setProperty('--accent-11', `hsl(${h}, ${Math.max(55, s+5)}%, ${Math.max(40, l-20)}%)`);
    document.documentElement.style.setProperty('--accent-12', `hsl(${h}, ${Math.max(60, s+10)}%, ${Math.max(35, l-25)}%)`);

    // Calculate and set text colors with proper contrast for different UI elements

    // Primary/accent color text (buttons, etc)
    // Use a more aggressive approach to ensure contrast
    let primaryTextColor;
    try {
      // Parse the color to determine its brightness
      let r, g, b;

      if (colorValue.startsWith('#')) {
        // Handle hex colors
        const hex = colorValue.replace('#', '');
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      } else if (colorValue.startsWith('hsl')) {
        // Handle HSL colors - convert to RGB first
        const hslMatch = colorValue.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
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
      } else if (colorValue.startsWith('rgb')) {
        // Handle RGB colors
        const rgbMatch = colorValue.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
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
      primaryTextColor = brightness < 0.6 ? '#ffffff' : '#000000';
    } catch (error) {
      console.error('Error determining text color:', error);
      // Fall back to the standard contrast function if there's an error
      primaryTextColor = getBestTextColor(colorValue, {
        level: 'AAA',
        size: 'normal',
        preferredColors: ['#ffffff', '#000000']
      });
    }
    setTextColor(primaryTextColor);
    document.documentElement.style.setProperty('--accent-text', primaryTextColor);
    document.documentElement.style.setProperty('--primary-foreground', primaryTextColor);
    document.documentElement.style.setProperty('--btn-text-color', primaryTextColor);

    // Calculate text colors for each accent shade to ensure proper contrast
    const accentShades = [
      { name: '--accent-1-foreground', bg: `hsl(${h}, ${Math.max(5, s-85)}%, ${Math.min(99, l+30)}%)` },
      { name: '--accent-2-foreground', bg: `hsl(${h}, ${Math.max(10, s-75)}%, ${Math.min(97, l+25)}%)` },
      { name: '--accent-3-foreground', bg: `hsl(${h}, ${Math.max(15, s-65)}%, ${Math.min(95, l+20)}%)` },
      { name: '--accent-4-foreground', bg: `hsl(${h}, ${Math.max(20, s-55)}%, ${Math.min(92, l+15)}%)` },
      { name: '--accent-5-foreground', bg: `hsl(${h}, ${Math.max(25, s-45)}%, ${Math.min(90, l+10)}%)` },
      { name: '--accent-6-foreground', bg: `hsl(${h}, ${Math.max(30, s-35)}%, ${Math.min(85, l+5)}%)` },
      { name: '--accent-7-foreground', bg: `hsl(${h}, ${Math.max(35, s-25)}%, ${Math.min(80, l)}%)` },
      { name: '--accent-8-foreground', bg: `hsl(${h}, ${Math.max(40, s-15)}%, ${Math.max(55, l-5)}%)` },
      { name: '--accent-9-foreground', bg: `hsl(${h}, ${Math.max(45, s-5)}%, ${Math.max(50, l-10)}%)` },
      { name: '--accent-10-foreground', bg: `hsl(${h}, ${Math.max(50, s)}%, ${Math.max(45, l-15)}%)` },
      { name: '--accent-11-foreground', bg: `hsl(${h}, ${Math.max(55, s+5)}%, ${Math.max(40, l-20)}%)` },
      { name: '--accent-12-foreground', bg: `hsl(${h}, ${Math.max(60, s+10)}%, ${Math.max(35, l-25)}%)` }
    ];

    // Set foreground colors for each accent shade using brightness calculation
    accentShades.forEach(shade => {
      // Convert HSL to RGB to calculate brightness
      const hslValues = shade.bg.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      let textColor = '#000000'; // Default to black

      if (hslValues) {
        const h = parseInt(hslValues[1]) / 360;
        const s = parseInt(hslValues[2]) / 100;
        const l = parseInt(hslValues[3]) / 100;

        // Simple brightness check - if luminance is below 60%, use white text
        if (l < 0.6) {
          textColor = '#ffffff';
        }
      }

      document.documentElement.style.setProperty(shade.name, textColor);
    });

    // Set destructive button foreground to ensure contrast
    // Destructive is typically red, so we calculate specifically for it
    const destructiveColor = '#ff4d4f'; // Standard red for destructive actions
    const destructiveTextColor = getBestTextColor(destructiveColor, {
      level: 'AA',
      size: 'normal',
      preferredColors: ['#ffffff', '#000000']
    });
    document.documentElement.style.setProperty('--destructive-foreground', destructiveTextColor);
  };

  // Set hydration state after component mounts
  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
  }, [isHydrated]);

  // Listen for theme changes to update high contrast color if it's selected
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Create a mutation observer to watch for theme changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class' && accentColor === ACCENT_COLORS.HIGH_CONTRAST) {
            // If the high contrast color is selected, update it when theme changes
            console.log('Theme changed, updating high contrast color');
            updateCSSVariables(ACCENT_COLORS.HIGH_CONTRAST, ACCENT_COLOR_VALUES[ACCENT_COLORS.HIGH_CONTRAST]);
          }
        });
      });

      // Start observing the document element for class changes
      observer.observe(document.documentElement, { attributes: true });

      // Clean up the observer when the component unmounts
      return () => observer.disconnect();
    }
  }, [accentColor]);

  /**
   * Change accent color and save to localStorage
   *
   * @param color - The accent color key to change to
   * @param customColorValue - Optional custom color value for custom colors
   */
  const changeAccentColor = (color: AccentColorKey, customColorValue: string | null = null): void => {
    console.log('Changing accent color:', { color, customColorValue });

    setAccentColor(color);
    localStorage.setItem('accentColor', color);

    let valueToUse: string;

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

  /**
   * Set a specific custom color
   *
   * @param customSlot - The custom color slot to update
   * @param colorValue - The color value to set
   */
  const setCustomColor = (customSlot: string, colorValue: string): void => {
    if (!customSlot.startsWith('custom')) return;

    console.log('Setting custom color:', { customSlot, colorValue });

    // Handle HSL color format
    let processedColorValue = colorValue;

    // If the color is in HSL format, we'll store it as is but also generate a hex version for compatibility
    if (colorValue.startsWith('hsl')) {
      // We'll still use the HSL value directly for CSS variables
      processedColorValue = colorValue;
    }

    // Update the custom color
    const newCustomColors = { ...customColors, [customSlot]: processedColorValue };
    setCustomColors(newCustomColors);
    localStorage.setItem('customAccentColors', JSON.stringify(newCustomColors));

    // Get the color name using the color naming library
    // For HSL colors, we'll extract the hue to generate a more meaningful name
    let colorName: string;
    if (colorValue.startsWith('hsl')) {
      const hslMatch = colorValue.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (hslMatch) {
        const h = parseInt(hslMatch[1]);
        const s = parseInt(hslMatch[2]);
        const l = parseInt(hslMatch[3]);

        // Generate a name based on hue
        if (h >= 0 && h < 30) colorName = 'Red-Orange';
        else if (h >= 30 && h < 60) colorName = 'Orange';
        else if (h >= 60 && h < 90) colorName = 'Yellow';
        else if (h >= 90 && h < 150) colorName = 'Green';
        else if (h >= 150 && h < 210) colorName = 'Cyan';
        else if (h >= 210 && h < 270) colorName = 'Blue';
        else if (h >= 270 && h < 330) colorName = 'Purple';
        else colorName = 'Red';

        // Add saturation and lightness info
        if (s < 30) colorName = 'Desaturated ' + colorName;
        if (l < 30) colorName = 'Dark ' + colorName;
        else if (l > 70) colorName = 'Light ' + colorName;
      } else {
        colorName = 'Custom HSL';
      }
    } else {
      colorName = getColorName(processedColorValue);
    }

    console.log('Generated color name:', colorName, 'for color:', colorValue);

    // Update the color name in state
    const newColorNames = { ...colorNames, [customSlot]: colorName };
    setColorNames(newColorNames);

    // Save to localStorage
    localStorage.setItem('customColorNames', JSON.stringify(newColorNames));
    console.log('Updated color names:', newColorNames);

    // If this is the currently selected color, update the CSS variables
    if (accentColor === customSlot) {
      updateCSSVariables(customSlot as AccentColorKey, processedColorValue);
    }
  };

  const value: AccentColorContextType = {
    accentColor,
    customColors,
    colorNames,
    textColor,
    changeAccentColor,
    setCustomColor,
    getTextColorForBackground, // Keep for backward compatibility
    getColorName,
    // Export accessibility utilities
    getBestTextColor,
    meetsContrastStandards
  };

  return (
    <AccentColorContext.Provider value={value}>
      {children}
    </AccentColorContext.Provider>
  );
}

/**
 * Hook to use the accent color context
 *
 * @returns The accent color context value
 * @throws Error if used outside of AccentColorProvider
 */
export function useAccentColor(): AccentColorContextType {
  const context = useContext(AccentColorContext);
  if (context === undefined) {
    throw new Error('useAccentColor must be used within an AccentColorProvider');
  }
  return context;
}