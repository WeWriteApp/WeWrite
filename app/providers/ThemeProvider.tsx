"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes"

type ThemeProviderProps = {
  children: React.ReactNode
  attribute?: string
  defaultTheme?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

// Extended theme hook with high contrast mode support
export function useTheme() {
  const nextTheme = useNextTheme();
  const [highContrast, setHighContrast] = React.useState<boolean>(false);

  // Initialize high contrast mode from localStorage on mount
  React.useEffect(() => {
    const storedHighContrast = localStorage.getItem('high-contrast-mode');
    if (storedHighContrast === 'true') {
      setHighContrast(true);
      document.documentElement.setAttribute('data-high-contrast', 'true');
    }
  }, []);

  // Toggle high contrast mode
  const toggleHighContrast = React.useCallback(() => {
    setHighContrast(prev => {
      const newValue = !prev;
      localStorage.setItem('high-contrast-mode', String(newValue));

      if (newValue) {
        document.documentElement.setAttribute('data-high-contrast', 'true');
      } else {
        document.documentElement.removeAttribute('data-high-contrast');
      }

      return newValue;
    });
  }, []);

  // Set high contrast mode
  const setHighContrastMode = React.useCallback((value: boolean) => {
    setHighContrast(value);
    localStorage.setItem('high-contrast-mode', String(value));

    if (value) {
      document.documentElement.setAttribute('data-high-contrast', 'true');
    } else {
      document.documentElement.removeAttribute('data-high-contrast');
    }
  }, []);

  return {
    ...nextTheme,
    highContrast,
    toggleHighContrast,
    setHighContrastMode
  };
}

export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
