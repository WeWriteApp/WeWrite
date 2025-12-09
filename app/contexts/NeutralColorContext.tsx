"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { hexToOklch, formatOklchForCSSVar, type OKLCHColor } from '../lib/oklch-utils';

interface NeutralColorContextType {
  neutralColor: string; // hex color
  setNeutralColor: (color: string) => void;
  getNeutralColorValue: () => string;
}

const NeutralColorContext = createContext<NeutralColorContextType>({
  neutralColor: '#64748b', // Default slate-500
  setNeutralColor: () => {},
  getNeutralColorValue: () => '#64748b'
});

export function NeutralColorProvider({ children }: { children: React.ReactNode }) {
  const [neutralColor, setNeutralColor] = useState<string>('#64748b'); // Default slate-500

  const getNeutralColorValue = () => {
    return neutralColor;
  };

  // Load saved color
  useEffect(() => {
    const saved = localStorage.getItem('neutral-color');
    if (saved && saved.startsWith('#')) {
      setNeutralColor(saved);
    }
  }, []);

  // Save color and update CSS variables
  // Note: Landing page now uses its own isolated LandingColorContext with inline styles,
  // so this context no longer needs to check for landing page or use requestAnimationFrame
  useEffect(() => {
    localStorage.setItem('neutral-color', neutralColor);

    // Convert hex to OKLCH
    const oklch = hexToOklch(neutralColor);
    if (!oklch) return;

    const root = document.documentElement;

    // Get accent hue from CSS variables (set by AccentColorContext)
    const accentH = parseFloat(root.style.getPropertyValue('--accent-h') || '240');

    // Create neutral color with accent hue but controlled chroma
    // This makes neutral a "chroma-varied accent" - same hue, different saturation
    // Allow more chroma to show through while keeping it neutral
    const neutralWithAccentHue = {
      l: oklch.l,
      c: Math.min(oklch.c, 0.25), // Increased limit for more visible chroma (0-0.25 range)
      h: accentH // Use accent hue
    };

    // Set base neutral color for opacity-based system
    const baseNeutral = formatOklchForCSSVar(neutralWithAccentHue);
    root.style.setProperty('--neutral-base', baseNeutral);

    // Extract base values for legacy system compatibility
    const baseL = neutralWithAccentHue.l;
    const baseC = neutralWithAccentHue.c;
    const baseH = neutralWithAccentHue.h;

    // OVERLAY-BASED NEUTRAL SYSTEM
    // All neutrals now use the user's neutral color with chroma to create cohesive theming
    // This creates a unified visual system where neutrals show the user's chosen color

    // Light mode: Use neutral color overlays with varying opacity
    const lightMuted = formatOklchForCSSVar({ l: Math.max(0.2, baseL - 0.3), c: baseC * 0.3, h: baseH }) + ' / 0.04'; // Neutral overlay
    const lightMutedForeground = formatOklchForCSSVar({ l: Math.max(0.1, baseL - 0.4), c: baseC * 0.5, h: baseH }) + ' / 0.65'; // Neutral text
    const lightSecondary = formatOklchForCSSVar({ l: Math.max(0.2, baseL - 0.3), c: baseC * 0.2, h: baseH }) + ' / 0.06'; // Neutral secondary
    const lightSecondaryForeground = formatOklchForCSSVar({ l: Math.max(0.1, baseL - 0.4), c: baseC * 0.6, h: baseH }) + ' / 0.90'; // Neutral secondary text
    const lightBorder = formatOklchForCSSVar({ l: Math.max(0.2, baseL - 0.3), c: baseC * 0.4, h: baseH }) + ' / 0.10'; // Neutral borders
    const lightInput = formatOklchForCSSVar({ l: Math.max(0.2, baseL - 0.3), c: baseC * 0.1, h: baseH }) + ' / 0.02'; // Neutral inputs

    // Light mode cards: Use white overlays for elevation effect - DECIMAL format
    const lightCard = '1.00 0.00 0.0 / 0.70'; // 70% white overlay for cards
    const lightCardForeground = '0.00 0.00 0.0 / 0.90'; // 90% black overlay for card text
    const lightCardBorder = '0.00 0.00 0.0 / 0.12'; // 12% black overlay for card borders
    const lightPopover = '1.00 0.00 0.0 / 0.85'; // 85% white overlay for popovers
    const lightPopoverForeground = '0.00 0.00 0.0 / 0.90'; // 90% black overlay for popover text

    // Dark mode: Use neutral color overlays with varying opacity
    const darkMuted = formatOklchForCSSVar({ l: Math.min(0.8, baseL + 0.3), c: baseC * 0.3, h: baseH }) + ' / 0.04'; // Neutral overlay
    const darkMutedForeground = formatOklchForCSSVar({ l: Math.min(0.9, baseL + 0.4), c: baseC * 0.5, h: baseH }) + ' / 0.65'; // Neutral text
    const darkSecondary = formatOklchForCSSVar({ l: Math.min(0.8, baseL + 0.3), c: baseC * 0.2, h: baseH }) + ' / 0.06'; // Neutral secondary
    const darkSecondaryForeground = formatOklchForCSSVar({ l: Math.min(0.9, baseL + 0.4), c: baseC * 0.6, h: baseH }) + ' / 0.90'; // Neutral secondary text
    const darkBorder = formatOklchForCSSVar({ l: Math.min(0.8, baseL + 0.3), c: baseC * 0.4, h: baseH }) + ' / 0.08'; // Neutral borders
    const darkInput = formatOklchForCSSVar({ l: Math.min(0.8, baseL + 0.3), c: baseC * 0.1, h: baseH }) + ' / 0.02'; // Neutral inputs

    // Dark mode cards: Use lighter white overlays for elevation effect - DECIMAL format
    const darkCard = '1.00 0.00 0.0 / 0.06'; // 6% white overlay for cards
    const darkCardForeground = '1.00 0.00 0.0 / 0.98'; // 98% white overlay for card text
    const darkCardBorder = '1.00 0.00 0.0 / 0.08'; // 8% white overlay for card borders
    const darkPopover = '1.00 0.00 0.0 / 0.08'; // 8% white overlay for popovers
    const darkPopoverForeground = '1.00 0.00 0.0 / 0.98'; // 98% white overlay for popover text

    // Apply light mode variables
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

    // Apply dark mode variables
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

    // Update the actual CSS variables based on current theme
    const isDark = document.documentElement.classList.contains('dark');

    // Basic neutral variables
    root.style.setProperty('--muted', isDark ? darkMuted : lightMuted);
    root.style.setProperty('--muted-foreground', isDark ? darkMutedForeground : lightMutedForeground);
    root.style.setProperty('--secondary', isDark ? darkSecondary : lightSecondary);
    root.style.setProperty('--secondary-foreground', isDark ? darkSecondaryForeground : lightSecondaryForeground);
    root.style.setProperty('--border', isDark ? darkBorder : lightBorder);
    root.style.setProperty('--input', isDark ? darkInput : lightInput);

    // Card and popover variables
    root.style.setProperty('--card', isDark ? darkCard : lightCard);
    root.style.setProperty('--card-foreground', isDark ? darkCardForeground : lightCardForeground);
    root.style.setProperty('--popover', isDark ? darkPopover : lightPopover);
    root.style.setProperty('--popover-foreground', isDark ? darkPopoverForeground : lightPopoverForeground);

    // Card theme system variables (overlay-based glassmorphism cards)
    // Use user's neutral color with varying opacity levels for true color harmony
    // Increased chroma multipliers to show more color in cards and borders
    const cardBgOverlay = isDark
      ? formatOklchForCSSVar({ l: Math.min(0.98, baseL + 0.4), c: baseC * 0.6, h: baseH }) // Increased from 0.3 to 0.6 for more color
      : formatOklchForCSSVar({ l: Math.min(1.0, baseL + 0.5), c: baseC * 0.4, h: baseH }); // Increased from 0.1 to 0.4 for more color

    const cardBorderOverlay = isDark
      ? formatOklchForCSSVar({ l: Math.min(0.8, baseL + 0.3), c: baseC * 0.7, h: baseH }) // Increased from 0.4 to 0.7 for more visible borders
      : formatOklchForCSSVar({ l: Math.max(0.2, baseL - 0.3), c: baseC * 0.8, h: baseH }); // Increased from 0.6 to 0.8 for more visible borders

    // Use simple numeric opacity values - calc() cannot be nested inside oklch()
    // Read the card opacity from CSS variable or use default
    const cardOpacity = parseFloat(getComputedStyle(root).getPropertyValue('--card-opacity').trim()) || 0.15;
    const cardOpacityValue = isDark ? cardOpacity * 0.4 : cardOpacity;
    const cardHoverOpacityValue = isDark ? (cardOpacity * 0.4) + 0.02 : cardOpacity + 0.05;

    root.style.setProperty('--card-bg', `oklch(${cardBgOverlay} / ${cardOpacityValue.toFixed(3)})`);
    root.style.setProperty('--card-bg-hover', `oklch(${cardBgOverlay} / ${cardHoverOpacityValue.toFixed(3)})`);
    root.style.setProperty('--card-border', `oklch(${cardBorderOverlay} / 0.1)`);
    root.style.setProperty('--card-border-hover', `oklch(${cardBorderOverlay} / 0.15)`);
  }, [neutralColor]);

  // Listen for theme changes to update variables
  // Note: Landing page now uses its own isolated LandingColorContext with inline styles
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          const root = document.documentElement;

          // Re-apply variables for new theme
          const lightMuted = root.style.getPropertyValue('--neutral-muted-light');
          const lightMutedForeground = root.style.getPropertyValue('--neutral-muted-foreground-light');
          const lightSecondary = root.style.getPropertyValue('--neutral-secondary-light');
          const lightSecondaryForeground = root.style.getPropertyValue('--neutral-secondary-foreground-light');
          const lightBorder = root.style.getPropertyValue('--neutral-border-light');
          const lightInput = root.style.getPropertyValue('--neutral-input-light');
          const lightCard = root.style.getPropertyValue('--neutral-card-light');
          const lightCardForeground = root.style.getPropertyValue('--neutral-card-foreground-light');
          const lightCardBorder = root.style.getPropertyValue('--neutral-card-border-light');
          const lightPopover = root.style.getPropertyValue('--neutral-popover-light');
          const lightPopoverForeground = root.style.getPropertyValue('--neutral-popover-foreground-light');

          const darkMuted = root.style.getPropertyValue('--neutral-muted-dark');
          const darkMutedForeground = root.style.getPropertyValue('--neutral-muted-foreground-dark');
          const darkSecondary = root.style.getPropertyValue('--neutral-secondary-dark');
          const darkSecondaryForeground = root.style.getPropertyValue('--neutral-secondary-foreground-dark');
          const darkBorder = root.style.getPropertyValue('--neutral-border-dark');
          const darkInput = root.style.getPropertyValue('--neutral-input-dark');
          const darkCard = root.style.getPropertyValue('--neutral-card-dark');
          const darkCardForeground = root.style.getPropertyValue('--neutral-card-foreground-dark');
          const darkCardBorder = root.style.getPropertyValue('--neutral-card-border-dark');
          const darkPopover = root.style.getPropertyValue('--neutral-popover-dark');
          const darkPopoverForeground = root.style.getPropertyValue('--neutral-popover-foreground-dark');

          // Basic neutral variables
          root.style.setProperty('--muted', isDark ? darkMuted : lightMuted);
          root.style.setProperty('--muted-foreground', isDark ? darkMutedForeground : lightMutedForeground);
          root.style.setProperty('--secondary', isDark ? darkSecondary : lightSecondary);
          root.style.setProperty('--secondary-foreground', isDark ? darkSecondaryForeground : lightSecondaryForeground);
          root.style.setProperty('--border', isDark ? darkBorder : lightBorder);
          root.style.setProperty('--input', isDark ? darkInput : lightInput);

          // Card and popover variables
          root.style.setProperty('--card', isDark ? darkCard : lightCard);
          root.style.setProperty('--card-foreground', isDark ? darkCardForeground : lightCardForeground);
          root.style.setProperty('--popover', isDark ? darkPopover : lightPopover);
          root.style.setProperty('--popover-foreground', isDark ? darkPopoverForeground : lightPopoverForeground);

          // Card theme system variables (overlay-based glassmorphism cards)
          // Use user's neutral color with varying opacity levels for true color harmony
          // Recalculate base values from current neutral color
          const oklch = hexToOklch(neutralColor);
          if (oklch) {
            const accentH = parseFloat(root.style.getPropertyValue('--accent-h')) || oklch.h;
            const neutralWithAccentHue = { ...oklch, h: accentH };
            const baseL = neutralWithAccentHue.l;
            const baseC = neutralWithAccentHue.c;
            const baseH = neutralWithAccentHue.h;

            const cardBgOverlay = isDark
              ? formatOklchForCSSVar({ l: Math.min(0.98, baseL + 0.4), c: baseC * 0.6, h: baseH })
              : formatOklchForCSSVar({ l: Math.min(1.0, baseL + 0.5), c: baseC * 0.4, h: baseH });

            const cardBorderOverlay = isDark
              ? formatOklchForCSSVar({ l: Math.min(0.8, baseL + 0.3), c: baseC * 0.7, h: baseH })
              : formatOklchForCSSVar({ l: Math.max(0.2, baseL - 0.3), c: baseC * 0.8, h: baseH });

            const cardOpacity = parseFloat(getComputedStyle(root).getPropertyValue('--card-opacity').trim()) || 0.15;
            const cardOpacityValue = isDark ? cardOpacity * 0.4 : cardOpacity;
            const cardHoverOpacityValue = isDark ? (cardOpacity * 0.4) + 0.02 : cardOpacity + 0.05;

            root.style.setProperty('--card-bg', `oklch(${cardBgOverlay} / ${cardOpacityValue.toFixed(3)})`);
            root.style.setProperty('--card-bg-hover', `oklch(${cardBgOverlay} / ${cardHoverOpacityValue.toFixed(3)})`);
            root.style.setProperty('--card-border', `oklch(${cardBorderOverlay} / 0.1)`);
            root.style.setProperty('--card-border-hover', `oklch(${cardBorderOverlay} / 0.15)`);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [neutralColor]);

  return (
    <NeutralColorContext.Provider value={{
      neutralColor,
      setNeutralColor,
      getNeutralColorValue
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
