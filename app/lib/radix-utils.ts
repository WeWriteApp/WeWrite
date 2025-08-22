/**
 * Radix Colors Utility Functions
 *
 * This file provides utility functions for working with Radix Colors.
 * Updated to support OKLCH color space for better perceptual uniformity.
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
  grayDark} from '@radix-ui/colors';

import { hslToOklch, formatOklchForCSSVar, parseOklch } from './oklch-utils';

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
    gray: isDark ? grayDark : gray};

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
 * Convert a Radix color to an OKLCH CSS variable
 *
 * @param color The Radix color value (HSL format)
 * @returns The OKLCH CSS variable value (e.g., '55.93% 0.6617 284.9')
 */
export function radixColorToCssVar(color: string): string {
  // Handle special cases for white and transparent colors
  if (color === 'white' || color === '#ffffff') {
    return '100.00% 0.0000 158.2';
  }
  if (color === 'black' || color === '#000000') {
    return '0.00% 0.0000 0.0';
  }
  if (color === 'transparent') {
    return '0.00% 0.0000 0.0';
  }

  // Extract HSL values from the Radix color string
  const hslMatch = color.match(/hsl\((\d+(?:\.\d+)?)(?:deg)?\s*,?\s*(\d+(?:\.\d+)?)%\s*,?\s*(\d+(?:\.\d+)?)%\)/i);

  if (hslMatch) {
    const [_, h, s, l] = hslMatch;
    const hslColor = {
      h: parseFloat(h),
      s: parseFloat(s),
      l: parseFloat(l)
    };

    const oklchColor = hslToOklch(hslColor);
    return formatOklchForCSSVar(oklchColor);
  }

  // If it's already in OKLCH format, return as is
  const oklchMatch = color.match(/oklch\(/);
  if (oklchMatch) {
    const parsed = parseOklch(color);
    return parsed ? formatOklchForCSSVar(parsed) : color;
  }

  // Return a fallback value for unrecognized formats
  console.warn(`Unable to convert Radix color to OKLCH: ${color}`);
  return '50.00% 0.0000 0.0';
}

/**
 * Get an OKLCH CSS variable for a Radix color
 *
 * @param scale The color scale (e.g., 'blue', 'red')
 * @param step The step in the scale (1-12)
 * @param isDark Whether to use the dark variant
 * @returns The OKLCH CSS variable value (e.g., '55.93% 0.6617 284.9')
 */
export function getRadixColorVar(scale: string, step: number, isDark: boolean = false): string {
  const color = getRadixColor(scale, step, isDark);
  return radixColorToCssVar(color);
}

/**
 * Convert HSL format to OKLCH for Radix colors
 * Helper function for backward compatibility
 *
 * @param color HSL color string
 * @returns OKLCH CSS variable format
 */
export function radixToOklch(color: string): string {
  return radixColorToCssVar(color);
}