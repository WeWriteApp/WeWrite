"use client";

import React, { createContext, useContext, useEffect } from 'react';

/**
 * NeutralColorContext
 *
 * Simplified neutral color system that uses completely colorless (zero chroma) neutrals.
 * All neutrals are pure grayscale for a clean, consistent UI.
 * No user customization - just consistent, colorless grays.
 */

interface NeutralColorContextType {
  // Keep the interface for backwards compatibility, but it's now a no-op
  neutralColor: string;
  setNeutralColor: (color: string) => void;
  getNeutralColorValue: () => string;
}

const NeutralColorContext = createContext<NeutralColorContextType>({
  neutralColor: '#808080', // Pure gray (no chroma)
  setNeutralColor: () => {},
  getNeutralColorValue: () => '#808080'
});

export function NeutralColorProvider({ children }: { children: React.ReactNode }) {
  // Set up pure gray (zero chroma) neutral colors
  useEffect(() => {
    const root = document.documentElement;

    // PURE GRAYSCALE NEUTRALS - Zero chroma for all neutral colors
    // Light mode: Use pure black overlays with varying opacity
    const lightMuted = '0.00 0.00 0.0 / 0.04';
    const lightMutedForeground = '0.00 0.00 0.0 / 0.55';
    const lightSecondary = '0.00 0.00 0.0 / 0.06';
    const lightSecondaryForeground = '0.00 0.00 0.0 / 0.85';
    const lightBorder = '0.00 0.00 0.0 / 0.10';
    const lightInput = '0.00 0.00 0.0 / 0.02';

    // Light mode cards: Pure white/black overlays
    const lightCard = '1.00 0.00 0.0 / 0.70';
    const lightCardForeground = '0.00 0.00 0.0 / 0.90';
    const lightCardBorder = '0.00 0.00 0.0 / 0.12';
    const lightPopover = '1.00 0.00 0.0 / 0.85';
    const lightPopoverForeground = '0.00 0.00 0.0 / 0.90';

    // Dark mode: Use pure white overlays with varying opacity
    const darkMuted = '1.00 0.00 0.0 / 0.04';
    const darkMutedForeground = '1.00 0.00 0.0 / 0.55';
    const darkSecondary = '1.00 0.00 0.0 / 0.06';
    const darkSecondaryForeground = '1.00 0.00 0.0 / 0.85';
    const darkBorder = '1.00 0.00 0.0 / 0.08';
    const darkInput = '1.00 0.00 0.0 / 0.02';

    // Dark mode cards: Pure white overlays
    const darkCard = '1.00 0.00 0.0 / 0.06';
    const darkCardForeground = '1.00 0.00 0.0 / 0.98';
    const darkCardBorder = '1.00 0.00 0.0 / 0.08';
    const darkPopover = '1.00 0.00 0.0 / 0.08';
    const darkPopoverForeground = '1.00 0.00 0.0 / 0.98';

    // Store both light and dark variants
    root.style.setProperty('--neutral-muted-light', lightMuted);
    root.style.setProperty('--neutral-muted-foreground-light', lightMutedForeground);
    root.style.setProperty('--neutral-secondary-light', lightSecondary);
    root.style.setProperty('--neutral-secondary-foreground-light', lightSecondaryForeground);
    root.style.setProperty('--neutral-border-light', lightBorder);
    root.style.setProperty('--neutral-input-light', lightInput);
    root.style.setProperty('--neutral-card-light', lightCard);
    root.style.setProperty('--neutral-card-foreground-light', lightCardForeground);
    root.style.setProperty('--neutral-card-border-light', lightCardBorder);
    root.style.setProperty('--neutral-popover-light', lightPopover);
    root.style.setProperty('--neutral-popover-foreground-light', lightPopoverForeground);

    root.style.setProperty('--neutral-muted-dark', darkMuted);
    root.style.setProperty('--neutral-muted-foreground-dark', darkMutedForeground);
    root.style.setProperty('--neutral-secondary-dark', darkSecondary);
    root.style.setProperty('--neutral-secondary-foreground-dark', darkSecondaryForeground);
    root.style.setProperty('--neutral-border-dark', darkBorder);
    root.style.setProperty('--neutral-input-dark', darkInput);
    root.style.setProperty('--neutral-card-dark', darkCard);
    root.style.setProperty('--neutral-card-foreground-dark', darkCardForeground);
    root.style.setProperty('--neutral-card-border-dark', darkCardBorder);
    root.style.setProperty('--neutral-popover-dark', darkPopover);
    root.style.setProperty('--neutral-popover-foreground-dark', darkPopoverForeground);

    // Apply based on current theme
    const applyThemeVariables = () => {
      const isDark = document.documentElement.classList.contains('dark');

      root.style.setProperty('--muted', isDark ? darkMuted : lightMuted);
      root.style.setProperty('--muted-foreground', isDark ? darkMutedForeground : lightMutedForeground);
      root.style.setProperty('--secondary', isDark ? darkSecondary : lightSecondary);
      root.style.setProperty('--secondary-foreground', isDark ? darkSecondaryForeground : lightSecondaryForeground);
      root.style.setProperty('--border', isDark ? darkBorder : lightBorder);
      root.style.setProperty('--input', isDark ? darkInput : lightInput);

      root.style.setProperty('--card', isDark ? darkCard : lightCard);
      root.style.setProperty('--card-foreground', isDark ? darkCardForeground : lightCardForeground);
      root.style.setProperty('--popover', isDark ? darkPopover : lightPopover);
      root.style.setProperty('--popover-foreground', isDark ? darkPopoverForeground : lightPopoverForeground);

      // Card theme system variables - solid backgrounds
      root.style.setProperty('--card-bg', isDark ? 'oklch(0.16 0.00 0)' : 'oklch(1.00 0.00 0)');
      root.style.setProperty('--card-bg-hover', isDark ? 'oklch(0.20 0.00 0)' : 'oklch(0.97 0.00 0)');

      // Pure grayscale borders
      const borderL = isDark ? 1.0 : 0.0;
      root.style.setProperty('--card-border', `oklch(${borderL.toFixed(2)} 0.00 0.0 / 0.1)`);
      root.style.setProperty('--card-border-hover', `oklch(${borderL.toFixed(2)} 0.00 0.0 / 0.15)`);
    };

    // Apply immediately
    applyThemeVariables();

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          applyThemeVariables();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Clean up old localStorage value if it exists
  useEffect(() => {
    localStorage.removeItem('neutral-color');
  }, []);

  return (
    <NeutralColorContext.Provider value={{
      neutralColor: '#808080',
      setNeutralColor: () => {}, // No-op - neutrals are fixed
      getNeutralColorValue: () => '#808080'
    }}>
      {children}
    </NeutralColorContext.Provider>
  );
}

export const useNeutralColor = () => {
  const context = useContext(NeutralColorContext);
  if (!context) {
    throw new Error('useNeutralColor must be used within NeutralColorProvider');
  }
  return context;
};
