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

import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";

export { useTheme };

export function ThemeProvider({ children, ...props }) {
  return (
    <NextThemeProvider 
      attribute="class" 
      defaultTheme="system" 
      enableSystem={true}
      themes={["light", "dark", "system"]}
      {...props}
    >
      {children}
    </NextThemeProvider>
  );
}
