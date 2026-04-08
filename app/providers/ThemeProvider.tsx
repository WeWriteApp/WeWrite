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
}>({
  highContrast: false,
  toggleHighContrast: () => {},
});

function HighContrastProvider({ children }: { children: React.ReactNode }) {
  const [highContrast, setHighContrast] = React.useState(false);
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
    const saved = localStorage.getItem('high-contrast');
    if (saved) {
      try {
        setHighContrast(JSON.parse(saved));
      } catch {
        // Invalid value — ignore
      }
    }
  }, []);

  const toggleHighContrast = React.useCallback(() => {
    setHighContrast(prev => {
      const newValue = !prev;
      localStorage.setItem('high-contrast', JSON.stringify(newValue));
      return newValue;
    });
  }, []);

  // Sync attribute to DOM for CSS fallback rules
  React.useEffect(() => {
    if (isHydrated) {
      if (highContrast) {
        document.documentElement.setAttribute('data-high-contrast', 'true');
      } else {
        document.documentElement.removeAttribute('data-high-contrast');
      }
    }
  }, [highContrast, isHydrated]);

  const value = React.useMemo(
    () => ({ highContrast, toggleHighContrast }),
    [highContrast, toggleHighContrast]
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
  const { highContrast, toggleHighContrast } = React.useContext(HighContrastContext);

  return {
    ...nextTheme,
    highContrast,
    toggleHighContrast,
    setHighContrastMode: toggleHighContrast // Alias for compatibility
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