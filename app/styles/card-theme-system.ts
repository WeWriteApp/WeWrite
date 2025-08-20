/**
 * WeWrite Card Theme System
 * 
 * Centralized card styling system based on Radix Colors design principles.
 * This provides semantic color tokens for consistent card backgrounds across
 * floating cards, regular cards, daily notes, and all other card components.
 * 
 * Design Principles:
 * - Single source of truth for all card styling
 * - Semantic color tokens (not hardcoded values)
 * - Consistent opacity levels across light/dark themes
 * - Industry-standard color scales from Radix
 * - Theme-aware with automatic dark mode support
 * 
 * Reference: https://www.radix-ui.com/themes/docs/theme/color
 */

import {
  slate,
  slateDark,
  gray,
  grayDark,
  blue,
  blueDark,
  mauve,
  mauveDark
} from '@radix-ui/colors';

/**
 * Card Background Semantic Tokens
 * 
 * Following Radix Colors naming convention:
 * - 1-2: App backgrounds
 * - 3-5: Component backgrounds (our cards)
 * - 6-8: Borders and separators
 * - 9-10: Solid colors
 * - 11-12: Text colors
 */
export const cardThemeTokens = {
  // Light theme card backgrounds
  light: {
    // Primary card background - subtle, elevated feel
    cardBackground: slate.slate2,        // Very light gray-blue
    cardBackgroundHover: slate.slate3,   // Slightly darker on hover
    
    // Floating card background - translucent for glassmorphism
    floatingBackground: 'rgba(255, 255, 255, 0.85)',
    floatingBackgroundHover: 'rgba(255, 255, 255, 0.95)',
    
    // Card borders
    cardBorder: slate.slate6,            // Subtle border
    cardBorderHover: slate.slate7,       // More visible on hover
    
    // Card text
    cardForeground: slate.slate12,       // High contrast text
    cardForegroundMuted: slate.slate11,  // Muted text
  },
  
  // Dark theme card backgrounds
  dark: {
    // Primary card background - subtle, elevated feel (neutral grey)
    cardBackground: grayDark.gray3,        // Dark but not black
    cardBackgroundHover: grayDark.gray4,   // Slightly lighter on hover
    
    // Floating card background - translucent for glassmorphism
    floatingBackground: 'rgba(20, 20, 20, 0.85)',  // Neutral dark grey with transparency
    floatingBackgroundHover: 'rgba(20, 20, 20, 0.95)',
    
    // Card borders (neutral grey)
    cardBorder: grayDark.gray6,            // Subtle border
    cardBorderHover: grayDark.gray7,       // More visible on hover

    // Card text (neutral grey)
    cardForeground: grayDark.gray12,       // High contrast text
    cardForegroundMuted: grayDark.gray11,  // Muted text
  }
};

/**
 * CSS Custom Properties for Card Theme
 * 
 * These will be injected into the root CSS to provide
 * theme-aware card styling throughout the application.
 */
export const cardThemeCSSVariables = {
  light: {
    '--card-bg': cardThemeTokens.light.cardBackground,
    '--card-bg-hover': cardThemeTokens.light.cardBackgroundHover,
    '--card-floating-bg': cardThemeTokens.light.floatingBackground,
    '--card-floating-bg-hover': cardThemeTokens.light.floatingBackgroundHover,
    '--card-border': cardThemeTokens.light.cardBorder,
    '--card-border-hover': cardThemeTokens.light.cardBorderHover,
    '--card-text': cardThemeTokens.light.cardForeground,
    '--card-text-muted': cardThemeTokens.light.cardForegroundMuted,
  },
  dark: {
    '--card-bg': cardThemeTokens.dark.cardBackground,
    '--card-bg-hover': cardThemeTokens.dark.cardBackgroundHover,
    '--card-floating-bg': cardThemeTokens.dark.floatingBackground,
    '--card-floating-bg-hover': cardThemeTokens.dark.floatingBackgroundHover,
    '--card-border': cardThemeTokens.dark.cardBorder,
    '--card-border-hover': cardThemeTokens.dark.cardBorderHover,
    '--card-text': cardThemeTokens.dark.cardForeground,
    '--card-text-muted': cardThemeTokens.dark.cardForegroundMuted,
  }
};

/**
 * Tailwind CSS Classes for Card Components
 * 
 * Pre-defined classes that use our semantic tokens.
 * These should be used instead of hardcoded colors.
 */
export const cardThemeClasses = {
  // Standard card styling
  card: [
    'bg-[var(--card-bg)]',
    'hover:bg-[var(--card-bg-hover)]',
    'border-[var(--card-border)]',
    'hover:border-[var(--card-border-hover)]',
    'text-[var(--card-text)]',
    'transition-all duration-200 ease-in-out'
  ].join(' '),
  
  // Floating card styling (glassmorphism)
  floatingCard: [
    'bg-[var(--card-floating-bg)]',
    'hover:bg-[var(--card-floating-bg-hover)]',
    'backdrop-blur-xl saturate-180',
    'border border-[var(--card-border)]',
    'text-[var(--card-text)]',
    'transition-all duration-300 ease-in-out'
  ].join(' '),
  
  // Card content text
  cardText: 'text-[var(--card-text)]',
  cardTextMuted: 'text-[var(--card-text-muted)]',
};

/**
 * Helper function to generate CSS for injection
 */
export function generateCardThemeCSS(): string {
  return `
    :root {
      ${Object.entries(cardThemeCSSVariables.light)
        .map(([key, value]) => `${key}: ${value};`)
        .join('\n      ')}
    }
    
    .dark {
      ${Object.entries(cardThemeCSSVariables.dark)
        .map(([key, value]) => `${key}: ${value};`)
        .join('\n      ')}
    }
    
    /* Standard card component */
    .wewrite-card-v2 {
      ${cardThemeClasses.card}
      border-radius: 1rem;
      padding: 1rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    }
    
    /* Floating card component */
    .wewrite-floating-card-v2 {
      ${cardThemeClasses.floatingCard}
      border-radius: 1rem;
      padding: 1rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    
    .dark .wewrite-floating-card-v2 {
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
  `;
}

/**
 * Migration Guide
 * 
 * Replace these old classes with new semantic ones:
 * 
 * OLD → NEW
 * =====================================
 * bg-white dark:bg-card → wewrite-card-v2
 * bg-white/15 dark:bg-black/15 → wewrite-floating-card-v2
 * border-theme-strong → (handled by card classes)
 * text-card-foreground → text-[var(--card-text)]
 * text-muted-foreground → text-[var(--card-text-muted)]
 */
