"use client";

/**
 * Utility functions for metadata components
 */

/**
 * Calculates the appropriate text color for a background color
 * @param {string} backgroundColor - Background color in hex format
 * @returns {string} - Text color in hex format (#ffffff or #000000)
 */
export const getContrastTextColor = (backgroundColor) => {
  // Default to white text if no background color is provided
  if (!backgroundColor) return '#ffffff';
  
  // Remove # if present
  const color = backgroundColor.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(color.substr(0, 2), 16) || 0;
  const g = parseInt(color.substr(2, 2), 16) || 0;
  const b = parseInt(color.substr(4, 2), 16) || 0;
  
  // Calculate luminance using the formula from WCAG 2.0
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, black for light backgrounds
  // Using a threshold of 0.55 for better contrast
  return luminance > 0.55 ? '#000000' : '#ffffff';
};

/**
 * Generates a contrast-aware style object for metadata counters
 * @param {string} backgroundColor - Background color in hex format
 * @returns {Object} - Style object with background and text colors
 */
export const getContrastAwareStyle = (backgroundColor = '#1768FF') => {
  const textColor = getContrastTextColor(backgroundColor);
  
  return {
    backgroundColor,
    color: textColor
  };
};

/**
 * Generates a contrast-aware style object for the all/following switcher
 * @param {boolean} isActive - Whether the item is active
 * @param {string} accentColor - Accent color in hex format
 * @returns {Object} - Style object with background and text colors
 */
export const getSwitcherStyle = (isActive, accentColor = '#1768FF') => {
  if (isActive) {
    const textColor = getContrastTextColor(accentColor);
    return {
      backgroundColor: accentColor,
      color: textColor
    };
  }
  
  // For inactive state, use a subtle background with good contrast
  return {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    color: 'var(--foreground)'
  };
};
