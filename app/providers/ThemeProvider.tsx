"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme, type ThemeProviderProps as NextThemeProviderProps } from "next-themes"

type ThemeProviderProps = NextThemeProviderProps & {
  children: React.ReactNode
}

export function ThemeProvider({ 
  children, 
  ...props 
}: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// Re-export useTheme hook from next-themes
export const useTheme = useNextTheme;
