"use client"

import * as React from "react"
import { createTheme, ThemeProvider } from '@mui/material/styles';

// Create a theme instance
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2'},
    secondary: {
      main: '#dc004e'}}});

interface AppContextType {
  loading: boolean
  setLoading: (loading: boolean) => void
}

export const AppContext = React.createContext<AppContextType>({
  loading: true,
  setLoading: () => {}})

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true)

  return (
    <ThemeProvider theme={theme}>
      <AppContext.Provider value={{ loading, setLoading }}>
        {children}
      </AppContext.Provider>
    </ThemeProvider>
  )
}