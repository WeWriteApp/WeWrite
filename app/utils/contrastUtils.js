/**
 * Utility functions for handling contrast-aware text
 */

/**
 * Determines if a color is light or dark
 * @param {string} hexColor - Hex color code (with or without #)
 * @returns {boolean} - True if the color is light, false if dark
 */
export const isLightColor = (hexColor) => {
  // Remove # if present
  const color = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);

  // Calculate luminance using the formula for relative luminance in the sRGB color space
  // See: https://www.w3.org/TR/WCAG20/#relativeluminancedef
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return true if light (luminance > 0.5), false if dark
  return luminance > 0.5;
};

/**
 * Returns the appropriate text color class based on background color
 * @param {string} bgColorClass - Background color class (e.g., 'bg-primary')
 * @returns {string} - Text color class for contrast
 */
export const getContrastText = (bgColorClass) => {
  // Map of background classes to their hex values
  // This should match your theme colors
  const colorMap = {
    'bg-primary': '#1768FF', // Blue
    'bg-secondary': '#F5F5F5', // Light gray
    'bg-accent': '#F8F9FA', // Very light gray
    'bg-muted': '#F1F5F9', // Light blue-gray
    'bg-destructive': '#EF4444', // Red
  };

  // Extract the base class (e.g., 'bg-primary' from 'bg-primary hover:bg-primary/90')
  const baseClass = bgColorClass.split(' ')[0];

  // Get the hex color for this class
  const hexColor = colorMap[baseClass];

  // If we don't have a mapping, default to dark text
  if (!hexColor) {
    return 'text-foreground';
  }

  // Return appropriate text color based on background lightness
  return isLightColor(hexColor) ? 'text-foreground' : 'text-primary-foreground';
};

/**
 * Returns contrast-aware text classes for a button or UI element
 * @param {boolean} isActive - Whether the element is active/selected
 * @param {string} activeClass - The active background class
 * @param {string} inactiveClass - The inactive background class
 * @returns {string} - Combined classes for the element
 */
export const getContrastAwareClasses = (isActive, activeClass = 'bg-primary', inactiveClass = 'bg-muted') => {
  if (isActive) {
    // For active state, always use white text for better contrast
    // Primary color is typically dark enough to warrant white text
    return `${activeClass} text-primary-foreground`;
  } else {
    // For inactive state
    return `${inactiveClass} text-muted-foreground hover:bg-muted/80`;
  }
};
