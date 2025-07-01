/**
 * Radix Colors Configuration
 * 
 * This file defines the color scales used throughout the application.
 * We're using Radix Colors for consistent, accessible color palettes.
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

// Map Radix colors to our CSS variables
export const lightModeColors = {
  // Base colors
  '--background': gray.gray1,
  '--foreground': gray.gray12,
  
  // Card colors
  '--card': 'white',
  '--card-foreground': gray.gray12,
  
  // Popover colors
  '--popover': 'white',
  '--popover-foreground': gray.gray12,
  
  // Primary colors (blue)
  '--primary': blue.blue9,
  '--primary-foreground': 'white',
  
  // Secondary colors
  '--secondary': slate.slate3,
  '--secondary-foreground': slate.slate11,
  
  // Muted colors
  '--muted': slate.slate3,
  '--muted-foreground': slate.slate11,
  
  // Accent colors
  '--accent': blue.blue3,
  '--accent-foreground': blue.blue11,
  
  // Destructive colors
  '--destructive': red.red9,
  '--destructive-foreground': 'white',
  
  // Border colors
  '--border': slate.slate6,
  '--input': slate.slate7,
  '--ring': blue.blue7,
  
  // Radius
  '--radius': '0.5rem'};

export const darkModeColors = {
  // Base colors
  '--background': gray.gray1,
  '--foreground': gray.gray12,
  
  // Card colors
  '--card': grayDark.gray2,
  '--card-foreground': grayDark.gray12,
  
  // Popover colors
  '--popover': grayDark.gray2,
  '--popover-foreground': grayDark.gray12,
  
  // Primary colors (blue)
  '--primary': blueDark.blue9,
  '--primary-foreground': 'white',
  
  // Secondary colors
  '--secondary': slateDark.slate3,
  '--secondary-foreground': slateDark.slate11,
  
  // Muted colors
  '--muted': slateDark.slate3,
  '--muted-foreground': slateDark.slate11,
  
  // Accent colors
  '--accent': blueDark.blue3,
  '--accent-foreground': blueDark.blue11,
  
  // Destructive colors
  '--destructive': redDark.red9,
  '--destructive-foreground': 'white',
  
  // Border colors
  '--border': slateDark.slate6,
  '--input': slateDark.slate7,
  '--ring': blueDark.blue7};

// Helper function to convert Radix color to HSL format for Tailwind
export function radixToHsl(color: string): string {
  // Extract the HSL values from the Radix color
  const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  
  if (hslMatch) {
    const [_, h, s, l] = hslMatch;
    return `${h} ${s}% ${l}%`;
  }
  
  // Return a default value if the color is not in HSL format
  return color;
}