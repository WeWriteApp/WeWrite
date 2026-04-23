"use client";

/**
 * Theme Provider for WeWrite
 *
 * IMPORTANT THEME HANDLING REQUIREMENTS:
 * 1. All components MUST use this ThemeProvider context for theme handling
 * 2. NEVER access system theme preferences directly - always use the useTheme() hook from this provider
 * 3. Theme states are: "light", "dark", and "system" - components should handle all three states
 * 4. When adding new UI elements, ensure they inherit theme colors through CSS variables
 * 5. All theme-related styling should use the CSS variables defined in globals.css
 *
 * HIGH CONTRAST MODE:
 * High contrast is managed via a shared React context (HighContrastContext) inside ThemeProvider.
 * All consumers of useTheme() share the same highContrast state. When toggled, ALL subscribers
 * (AccentColorContext, NeutralColorContext, etc.) receive the update and re-apply CSS variables.
 * The `data-high-contrast` attribute on <html> is set for CSS fallback/initial styles only;
 * the JS-managed inline styles are the source of truth at runtime.
 */

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

type ThemeProviderProps = {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  themes?: string[];
};

// Shared high contrast context — single source of truth for HC state
const HighContrastContext = React.createContext<{
  highContrast: boolean;
  toggleHighContrast: () => void;
  reduceAnimations: boolean;
  setReduceAnimations: (value: boolean) => void;
}>({
  highContrast: false,
  toggleHighContrast: () => {},
  reduceAnimations: false,
  setReduceAnimations: () => {},
});

const EINK_PREV_REDUCE_ANIMATIONS_KEY = 'eink-prev-reduce-animations';

function HighContrastProvider({ children }: { children: React.ReactNode }) {
  const [highContrast, setHighContrast] = React.useState(false);
  const [reduceAnimations, setReduceAnimationsState] = React.useState(false);
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
    const savedHC = localStorage.getItem('high-contrast');
    const savedRA = localStorage.getItem('reduce-animations');
    if (savedHC) {
      try {
        const hcValue = JSON.parse(savedHC);
        setHighContrast(hcValue);
        // If reduce-animations was never explicitly set, default to HC value
        if (savedRA === null) {
          setReduceAnimationsState(hcValue);
        }
      } catch {
        // Invalid value — ignore
      }
    }
    if (savedRA !== null) {
      try {
        setReduceAnimationsState(JSON.parse(savedRA));
      } catch {
        // Invalid value — ignore
      }
    }
  }, []);

  const toggleHighContrast = React.useCallback(() => {
    setHighContrast(prev => {
      const newValue = !prev;
      localStorage.setItem('high-contrast', JSON.stringify(newValue));

      // E-ink ON: snapshot current animation preference, then enable reduced animations.
      if (newValue) {
        localStorage.setItem(EINK_PREV_REDUCE_ANIMATIONS_KEY, JSON.stringify(reduceAnimations));
        setReduceAnimationsState(true);
        localStorage.setItem('reduce-animations', 'true');
      } else {
        // E-ink OFF: restore prior animation preference if we captured one.
        const previous = localStorage.getItem(EINK_PREV_REDUCE_ANIMATIONS_KEY);
        if (previous !== null) {
          try {
            const previousValue = JSON.parse(previous);
            setReduceAnimationsState(Boolean(previousValue));
            localStorage.setItem('reduce-animations', JSON.stringify(Boolean(previousValue)));
          } catch {
            setReduceAnimationsState(false);
            localStorage.setItem('reduce-animations', 'false');
          }
          localStorage.removeItem(EINK_PREV_REDUCE_ANIMATIONS_KEY);
        }
      }
      return newValue;
    });
  }, [reduceAnimations]);

  const setReduceAnimations = React.useCallback((value: boolean) => {
    setReduceAnimationsState(value);
    localStorage.setItem('reduce-animations', JSON.stringify(value));

    // If user explicitly changes this while e-ink is on, honor manual control
    // and cancel automatic restore behavior on e-ink exit.
    if (highContrast) {
      localStorage.removeItem(EINK_PREV_REDUCE_ANIMATIONS_KEY);
    }
  }, [highContrast]);

  // Sync attributes to DOM for CSS fallback rules
  React.useEffect(() => {
    if (isHydrated) {
      if (highContrast) {
        document.documentElement.setAttribute('data-high-contrast', 'true');
      } else {
        document.documentElement.removeAttribute('data-high-contrast');
      }
      if (reduceAnimations) {
        document.documentElement.setAttribute('data-reduce-animations', 'true');
      } else {
        document.documentElement.removeAttribute('data-reduce-animations');
      }
    }
  }, [highContrast, reduceAnimations, isHydrated]);

  const value = React.useMemo(
    () => ({ highContrast, toggleHighContrast, reduceAnimations, setReduceAnimations }),
    [highContrast, toggleHighContrast, reduceAnimations, setReduceAnimations]
  );

  return (
    <HighContrastContext.Provider value={value}>
      {children}
    </HighContrastContext.Provider>
  );
}

// Shared hook — all callers share the same HC state via context
export function useTheme() {
  const nextTheme = useNextTheme();
  const { highContrast, toggleHighContrast, reduceAnimations, setReduceAnimations } = React.useContext(HighContrastContext);

  return {
    ...nextTheme,
    highContrast,
    toggleHighContrast,
    setHighContrastMode: toggleHighContrast, // Alias for compatibility
    reduceAnimations,
    setReduceAnimations,
  };
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  themes = ["light", "dark", "system"],
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute={attribute}
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      themes={themes}
      suppressHydrationWarning
      {...props}
    >
      <HighContrastProvider>
        {children}
      </HighContrastProvider>
    </NextThemesProvider>
  );
}