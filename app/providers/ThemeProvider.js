"use client";

import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";

export { useTheme };

export function ThemeProvider({ children, ...props }) {
  return (
    <NextThemeProvider {...props}>
      {children}
    </NextThemeProvider>
  );
}
