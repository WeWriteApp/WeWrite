/**
 * Shared constants for Remotion compositions
 */

// WeWrite Brand Colors (matching globals.css)
export const BRAND_COLORS = {
  primary: '#3B82F6', // Blue - matches --primary / --accent-base
  primaryDark: '#2563EB',
  purple: '#8B5CF6',
  green: '#22C55E',
  orange: '#F59E0B',
  red: '#EF4444',
} as const;

// Common dimensions
export const DIMENSIONS = {
  horizontal: {
    width: 1920,
    height: 1080,
  },
  vertical: {
    width: 1080,
    height: 1920,
  },
} as const;

// Animation timings (at 30fps)
export const TIMINGS = {
  fadeIn: 30, // 1 second
  hold: 60, // 2 seconds
  fadeOut: 30, // 1 second
  total: 150, // 5 seconds
} as const;
