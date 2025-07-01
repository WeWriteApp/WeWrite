/**
 * Accessibility Utilities
 * 
 * This file contains utility functions for checking and enforcing
 * accessibility standards, particularly for color contrast.
 */

// Convert RGB components to relative luminance according to WCAG 2.0
export const getLuminance = (r: number, g: number, b: number): number => {
  // Convert RGB to sRGB
  const sRGB = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  
  // Calculate luminance using the formula from WCAG 2.0
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
};

// Calculate contrast ratio between two luminance values according to WCAG 2.0
export const getContrastRatio = (luminance1: number, luminance2: number): number => {
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  return (lighter + 0.05) / (darker + 0.05);
};

// Parse any color format to RGB values
export const parseColorToRGB = (color: string): { r: number, g: number, b: number } => {
  let r = 0, g = 0, b = 0;
  
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

// Check if a color combination meets WCAG contrast standards
export const meetsContrastStandards = (
  foreground: string, 
  background: string, 
  level: 'AA' | 'AAA' = 'AA', 
  size: 'normal' | 'large' = 'normal'
): boolean => {
  try {
    // Parse colors to RGB
    const fgRGB = parseColorToRGB(foreground);
    const bgRGB = parseColorToRGB(background);
    
    // Calculate luminance
    const fgLuminance = getLuminance(fgRGB.r, fgRGB.g, fgRGB.b);
    const bgLuminance = getLuminance(bgRGB.r, bgRGB.g, bgRGB.b);
    
    // Calculate contrast ratio
    const ratio = getContrastRatio(fgLuminance, bgLuminance);
    
    // WCAG 2.0 contrast requirements:
    // AA: 4.5:1 for normal text, 3:1 for large text
    // AAA: 7:1 for normal text, 4.5:1 for large text
    const minimumRatio = 
      level === 'AAA' 
        ? (size === 'large' ? 4.5 : 7) 
        : (size === 'large' ? 3 : 4.5);
    
    return ratio >= minimumRatio;
  } catch (error) {
    console.error('Error checking contrast standards:', error);
    return false;
  }
};

// Get the best text color for a background to meet contrast standards
export const getBestTextColor = (
  background: string,
  options: {
    level?: 'AA' | 'AAA',
    size?: 'normal' | 'large',
    preferredColors?: string[]
  } = {}
): string => {
  const {
    level = 'AA',
    size = 'normal',
    preferredColors = ['#ffffff', '#000000']
  } = options;
  
  try {
    // Parse background color to RGB
    const bgRGB = parseColorToRGB(background);
    
    // Calculate background luminance
    const bgLuminance = getLuminance(bgRGB.r, bgRGB.g, bgRGB.b);
    
    // Calculate contrast ratios for each preferred color
    const contrastRatios = preferredColors.map(color => {
      const textRGB = parseColorToRGB(color);
      const textLuminance = getLuminance(textRGB.r, textRGB.g, textRGB.b);
      const ratio = getContrastRatio(bgLuminance, textLuminance);
      return { color, ratio };
    });
    
    // Sort by contrast ratio (highest first)
    contrastRatios.sort((a, b) => b.ratio - a.ratio);
    
    // Minimum required contrast ratio based on WCAG level and text size
    const minimumRatio = 
      level === 'AAA' 
        ? (size === 'large' ? 4.5 : 7) 
        : (size === 'large' ? 3 : 4.5);
    
    // Find the first color that meets the minimum contrast ratio
    const bestOption = contrastRatios.find(option => option.ratio >= minimumRatio);
    
    if (bestOption) {
      return bestOption.color;
    }
    
    // If no color meets the minimum, return the one with the highest contrast
    return contrastRatios[0].color;
  } catch (error) {
    console.error('Error finding best text color:', error);
    return '#ffffff'; // Default to white in case of error
  }
};