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
 * Example usage:
 * ```
 * const { theme, setTheme } = useTheme();
 * // theme will be either "light", "dark", or "system"
 * ```
 */

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
/**
 * Theme provider props interface
 */
type ThemeProviderProps = {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  themes?: string[];
};

// Simple high contrast hook implementation
function useHighContrast() {
  const [highContrast, setHighContrast] = React.useState(false);
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Set hydration state after component mounts
  React.useEffect(() => {
    setIsHydrated(true);
    // Load high contrast preference from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('high-contrast');
      if (saved) {
        setHighContrast(JSON.parse(saved));
      }
    }
  }, []);

  const toggleHighContrast = React.useCallback(() => {
    setHighContrast(prev => {
      const newValue = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('high-contrast', JSON.stringify(newValue));
      }
      return newValue;
    });
  }, []);

  // Apply high contrast mode to document
  React.useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      if (highContrast) {
        document.documentElement.setAttribute('data-high-contrast', 'true');
      } else {
        document.documentElement.removeAttribute('data-high-contrast');
      }
    }
  }, [highContrast, isHydrated]);

  return { highContrast, toggleHighContrast };
}

// Extended theme hook with high contrast mode support
export function useTheme() {
  const nextTheme = useNextTheme();
  const { highContrast, toggleHighContrast } = useHighContrast();

  return {
    ...nextTheme,
    highContrast,
    toggleHighContrast,
    setHighContrastMode: toggleHighContrast // Alias for compatibility
  };
}

/**
 * ThemeProvider component that wraps the application with theme support
 *
 * @param props - The theme provider props
 * @param props.children - Child components to render
 */
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
      {children}
    </NextThemesProvider>
  );
}