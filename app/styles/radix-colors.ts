/**
 * Radix Colors Configuration
 *
 * This file defines the color scales used throughout the application.
 * We're using Radix Colors for consistent, accessible color palettes.
 * Updated to use OKLCH color space for better perceptual uniformity.
 *
 * Reference: https://www.radix-ui.com/colors
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

import { radixColorToCssVar } from '../lib/radix-utils';

// Define our color scales
export const radixColors = {
  // Main colors
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
  grayDark};

// Map Radix colors to our OKLCH CSS variables
export const lightModeColors = {
  // Base colors
  '--background': radixColorToCssVar(gray.gray1),
  '--foreground': radixColorToCssVar(gray.gray12),

  // Card colors
  '--card': radixColorToCssVar('white'),
  '--card-foreground': radixColorToCssVar(gray.gray12),

  // Popover colors
  '--popover': radixColorToCssVar('white'),
  '--popover-foreground': radixColorToCssVar(gray.gray12),

  // Primary colors - will be overridden by accent color system (using neutral gray as fallback)
  '--primary': radixColorToCssVar(gray.gray9),
  '--primary-foreground': radixColorToCssVar('white'),

  // Secondary colors - using neutral gray
  '--secondary': radixColorToCssVar(gray.gray3),
  '--secondary-foreground': radixColorToCssVar(gray.gray11),

  // Muted colors - using neutral gray
  '--muted': radixColorToCssVar(gray.gray3),
  '--muted-foreground': radixColorToCssVar(gray.gray11),

  // Accent colors - will be overridden by accent color system (using neutral gray as fallback)
  '--accent': radixColorToCssVar(gray.gray3),
  '--accent-foreground': radixColorToCssVar(gray.gray11),

  // Destructive colors
  '--destructive': radixColorToCssVar(red.red9),
  '--destructive-foreground': radixColorToCssVar('white'),

  // Border colors - using neutral gray
  '--border': radixColorToCssVar(gray.gray6),
  '--input': radixColorToCssVar(gray.gray7),
  '--ring': radixColorToCssVar(gray.gray7),

  // Radius
  '--radius': '0.5rem'};

export const darkModeColors = {
  // Base colors
  '--background': radixColorToCssVar(grayDark.gray1),
  '--foreground': radixColorToCssVar(grayDark.gray12),

  // Card colors
  '--card': radixColorToCssVar(grayDark.gray2),
  '--card-foreground': radixColorToCssVar(grayDark.gray12),

  // Popover colors
  '--popover': radixColorToCssVar(grayDark.gray2),
  '--popover-foreground': radixColorToCssVar(grayDark.gray12),

  // Primary colors - will be overridden by accent color system (using neutral gray as fallback)
  '--primary': radixColorToCssVar(grayDark.gray9),
  '--primary-foreground': radixColorToCssVar('white'),

  // Secondary colors - using neutral grey instead of slate
  '--secondary': radixColorToCssVar(grayDark.gray3),
  '--secondary-foreground': radixColorToCssVar(grayDark.gray11),

  // Muted colors - using neutral grey instead of slate
  '--muted': radixColorToCssVar(grayDark.gray3),
  '--muted-foreground': radixColorToCssVar(grayDark.gray11),

  // Accent colors - will be overridden by accent color system (using neutral gray as fallback)
  '--accent': radixColorToCssVar(grayDark.gray3),
  '--accent-foreground': radixColorToCssVar(grayDark.gray11),

  // Destructive colors
  '--destructive': radixColorToCssVar(redDark.red9),
  '--destructive-foreground': radixColorToCssVar('white'),

  // Border colors - using neutral grey instead of slate
  '--border': radixColorToCssVar(grayDark.gray6),
  '--input': radixColorToCssVar(grayDark.gray7),
  '--ring': radixColorToCssVar(grayDark.gray7)};

// Helper function to convert Radix color to OKLCH format for Tailwind
export function radixToOklch(color: string): string {
  return radixColorToCssVar(color);
}

// Backward compatibility alias
export const radixToHsl = radixToOklch;