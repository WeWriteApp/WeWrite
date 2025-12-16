"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Landing Page Color System
 *
 * This is a COMPLETELY ISOLATED color system for the landing page.
 * It does NOT use global CSS variables and cannot be affected by
 * AccentColorContext or NeutralColorContext.
 *
 * Colors are provided via React context and applied using inline styles.
 */

// Color constants
const DEFAULT_HUE = 230; // Blue
const LIGHTNESS = 0.50;
const CHROMA = 0.25;

export interface LandingColors {
  // Current hue (0-360)
  hue: number;

  // Pre-computed OKLCH color strings
  accent: string;
  accentHover: string;

  // Card colors (theme-aware)
  cardBg: string;
  cardBgHover: string;
  cardBorder: string;
  cardBorderHover: string;

  // Blob color
  blobColor: string;

  // Text colors
  cardText: string;
  cardTextMuted: string;

  // Is dark mode?
  isDark: boolean;
}

// Compute all colors from a hue value and dark mode state
function computeColors(hue: number, isDark: boolean): LandingColors {
  const l = LIGHTNESS;
  const c = CHROMA;

  // Main accent color
  const accent = `oklch(${l} ${c} ${hue})`;
  const accentHover = `oklch(${l - 0.05} ${c} ${hue})`;

  // Blob color (semi-transparent)
  const blobColor = `oklch(${l} ${c} ${hue} / 0.7)`;

  // Card colors depend on theme
  let cardBg: string;
  let cardBgHover: string;
  let cardBorder: string;
  let cardBorderHover: string;
  let cardText: string;
  let cardTextMuted: string;

  if (isDark) {
    // Dark mode: lighter overlays with accent tint
    const bgL = 0.98;
    const bgC = c * 0.4;
    const borderL = 0.80;
    const borderC = c * 0.5;

    cardBg = `oklch(${bgL} ${bgC} ${hue} / 0.06)`;
    cardBgHover = `oklch(${bgL} ${bgC} ${hue} / 0.08)`;
    cardBorder = `oklch(${borderL} ${borderC} ${hue} / 0.15)`;
    cardBorderHover = `oklch(${borderL} ${borderC} ${hue} / 0.20)`;
    cardText = `oklch(0.98 0.00 ${hue})`;
    cardTextMuted = `oklch(0.68 0.00 ${hue})`;
  } else {
    // Light mode: white overlays with subtle accent tint
    const bgL = 1.00;
    const bgC = c * 0.2;
    const borderL = 0.30;
    const borderC = c * 0.6;

    cardBg = `oklch(${bgL} ${bgC} ${hue} / 0.15)`;
    cardBgHover = `oklch(${bgL} ${bgC} ${hue} / 0.20)`;
    cardBorder = `oklch(${borderL} ${borderC} ${hue} / 0.15)`;
    cardBorderHover = `oklch(${borderL} ${borderC} ${hue} / 0.20)`;
    cardText = `oklch(0.16 0.00 ${hue})`;
    cardTextMuted = `oklch(0.49 0.00 ${hue})`;
  }

  return {
    hue,
    accent,
    accentHover,
    cardBg,
    cardBgHover,
    cardBorder,
    cardBorderHover,
    blobColor,
    cardText,
    cardTextMuted,
    isDark,
  };
}

// Default colors (blue, light mode)
const defaultColors = computeColors(DEFAULT_HUE, false);

const LandingColorContext = createContext<LandingColors>(defaultColors);

interface LandingColorProviderProps {
  children: React.ReactNode;
}

export function LandingColorProvider({ children }: LandingColorProviderProps) {
  const [hue, setHue] = useState(DEFAULT_HUE);
  const [isDark, setIsDark] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    // Initial check
    checkDarkMode();

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          checkDarkMode();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Handle scroll to animate hue
  useEffect(() => {
    let rafId: number | null = null;
    let pollIntervalId: number | null = null;

    const updateHue = () => {
      // Try multiple scroll measurement methods for robustness
      const docScrollHeight = document.documentElement.scrollHeight;
      const bodyScrollHeight = document.body.scrollHeight;
      const scrollHeight = Math.max(docScrollHeight, bodyScrollHeight);

      const innerHeight = window.innerHeight;
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      const maxScroll = scrollHeight - innerHeight;

      if (maxScroll <= 0) {
        return;
      }

      const scrollProgress = Math.min(scrollY / maxScroll, 1);

      // Start at blue (230°) and cycle through the full spectrum
      const newHue = (DEFAULT_HUE + scrollProgress * 360) % 360;
      setHue(newHue);
    };

    // Use RAF to ensure we read layout after browser has reflowed
    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateHue);
    };

    // Also handle resize with RAF and a small delay to let layout settle
    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      // Double RAF to ensure layout has settled after resize
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(updateHue);
      });
    };

    // Initial call with delay to let page render
    setTimeout(() => {
      handleScroll();
    }, 100);

    // Listen for scroll events
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Also recalculate on resize since maxScroll changes with viewport size
    window.addEventListener('resize', handleResize, { passive: true });

    // Watch for DOM changes that might affect scrollHeight (e.g., content loading)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(document.body);

    // Polling fallback - check every 500ms in case events don't fire properly
    pollIntervalId = window.setInterval(() => {
      updateHue();
    }, 500);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (pollIntervalId) clearInterval(pollIntervalId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  // Compute colors whenever hue or theme changes
  const colors = useMemo(() => computeColors(hue, isDark), [hue, isDark]);

  // Store original CSS variables on mount to restore when leaving landing pages
  const [originalCssVars, setOriginalCssVars] = useState<Record<string, string | null> | null>(null);

  // Capture original CSS variables on mount
  useEffect(() => {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    // Save all the CSS variables we're going to modify
    const varsToSave = [
      '--accent-h', '--accent-l', '--accent-c',
      '--accent-base', '--primary',
      '--card-bg', '--card-bg-hover', '--card-border', '--card-border-hover',
      '--neutral-base', '--primary-foreground'
    ];

    const saved: Record<string, string | null> = {};
    varsToSave.forEach(varName => {
      // Get the inline style value (what we set) or null
      saved[varName] = root.style.getPropertyValue(varName) || null;
    });

    setOriginalCssVars(saved);

    // Cleanup: restore original values when unmounting
    return () => {
      varsToSave.forEach(varName => {
        if (saved[varName]) {
          root.style.setProperty(varName, saved[varName]);
        } else {
          // Remove the inline style to let CSS cascade take over
          root.style.removeProperty(varName);
        }
      });
    };
  }, []); // Only run on mount/unmount

  // Also update CSS variables so that all page elements using CSS classes get the animated colors
  // This allows buttons, badges, and other elements to reflect the scroll-based color
  useEffect(() => {
    const root = document.documentElement;
    const l = LIGHTNESS;
    const c = CHROMA;

    // Set accent color CSS variables
    root.style.setProperty('--accent-h', hue.toFixed(1));
    root.style.setProperty('--accent-l', l.toFixed(2));
    root.style.setProperty('--accent-c', c.toFixed(2));

    // Set base accent color for opacity-based system
    const baseAccent = `${l.toFixed(2)} ${c.toFixed(2)} ${hue.toFixed(1)}`;
    root.style.setProperty('--accent-base', baseAccent);
    root.style.setProperty('--primary', baseAccent);

    // Set card CSS variables with accent-tinted colors
    const cardBgOverlay = isDark
      ? `0.98 ${(c * 0.4).toFixed(4)} ${hue.toFixed(1)}`
      : `1.00 ${(c * 0.2).toFixed(4)} ${hue.toFixed(1)}`;
    const cardBorderOverlay = isDark
      ? `0.80 ${(c * 0.5).toFixed(4)} ${hue.toFixed(1)}`
      : `0.30 ${(c * 0.6).toFixed(4)} ${hue.toFixed(1)}`;
    const cardOpacity = isDark ? 0.06 : 0.15;
    const cardHoverOpacity = isDark ? 0.08 : 0.20;

    root.style.setProperty('--card-bg', `oklch(${cardBgOverlay} / ${cardOpacity.toFixed(3)})`);
    root.style.setProperty('--card-bg-hover', `oklch(${cardBgOverlay} / ${cardHoverOpacity.toFixed(3)})`);
    root.style.setProperty('--card-border', `oklch(${cardBorderOverlay} / 0.15)`);
    root.style.setProperty('--card-border-hover', `oklch(${cardBorderOverlay} / 0.20)`);

    // Set neutral base color (same hue as accent, reduced chroma for subtle appearance)
    const neutralChroma = Math.min(c * 0.3, 0.05);
    const baseNeutral = `${l.toFixed(2)} ${neutralChroma.toFixed(2)} ${hue.toFixed(1)}`;
    root.style.setProperty('--neutral-base', baseNeutral);

    // Dynamic primary foreground color based on accent lightness
    const primaryForegroundColor = l > 0.70 ? '0.00 0.00 0.0' : '1.00 0.00 0.0';
    root.style.setProperty('--primary-foreground', primaryForegroundColor);
  }, [hue, isDark]);

  return (
    <LandingColorContext.Provider value={colors}>
      {children}
    </LandingColorContext.Provider>
  );
}

// Hook to use landing colors
export function useLandingColors(): LandingColors {
  const context = useContext(LandingColorContext);
  if (!context) {
    throw new Error('useLandingColors must be used within LandingColorProvider');
  }
  return context;
}

// Export default colors for SSR/initial render
export { defaultColors, DEFAULT_HUE, LIGHTNESS, CHROMA };
