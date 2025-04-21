/**
 * Radix Colors Utility Functions
 * 
 * This file provides utility functions for working with Radix Colors.
 */

import {
  blue,
  blueDark,
  slate,
  slateDark,
  red,
  redDark,
  amber,
  amberDark,
  green,
  greenDark,
  gray,
  grayDark,
} from '@radix-ui/colors';

/**
 * Get a Radix color by scale and step
 * 
 * @param scale The color scale (e.g., 'blue', 'red')
 * @param step The step in the scale (1-12)
 * @param isDark Whether to use the dark variant
 * @returns The CSS color value
 */
export function getRadixColor(scale: string, step: number, isDark: boolean = false): string {
  // Validate step
  if (step < 1 || step > 12) {
    console.warn(`Invalid Radix color step: ${step}. Must be between 1-12.`);
    step = Math.max(1, Math.min(12, step));
  }

  // Get the appropriate color scale
  const colorScales: Record<string, Record<string, string>> = {
    blue: isDark ? blueDark : blue,
    slate: isDark ? slateDark : slate,
    red: isDark ? redDark : red,
    amber: isDark ? amberDark : amber,
    green: isDark ? greenDark : green,
    gray: isDark ? grayDark : gray,
  };

  // Get the color scale
  const colorScale = colorScales[scale];
  if (!colorScale) {
    console.warn(`Unknown Radix color scale: ${scale}`);
    return isDark ? blueDark.blue9 : blue.blue9;
  }

  // Get the color value
  const colorKey = `${scale}${step}`;
  const colorValue = colorScale[colorKey];
  if (!colorValue) {
    console.warn(`Unknown Radix color: ${colorKey}`);
    return isDark ? blueDark.blue9 : blue.blue9;
  }

  return colorValue;
}

/**
 * Convert a Radix color to a CSS variable
 * 
 * @param color The Radix color value
 * @returns The CSS variable value (e.g., '217 91% 60%')
 */
export function radixColorToCssVar(color: string): string {
  // Extract HSL values from the color string
  const hslMatch = color.match(/hsl\((\d+)deg\s+(\d+)%\s+(\d+)%\)/i);
  
  if (hslMatch) {
    const [_, h, s, l] = hslMatch;
    return `${h} ${s}% ${l}%`;
  }
  
  // Return the original color if it's not in HSL format
  return color;
}

/**
 * Get a CSS variable for a Radix color
 * 
 * @param scale The color scale (e.g., 'blue', 'red')
 * @param step The step in the scale (1-12)
 * @param isDark Whether to use the dark variant
 * @returns The CSS variable value (e.g., '217 91% 60%')
 */
export function getRadixColorVar(scale: string, step: number, isDark: boolean = false): string {
  const color = getRadixColor(scale, step, isDark);
  return radixColorToCssVar(color);
}
