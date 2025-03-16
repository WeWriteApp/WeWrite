"use client"

import * as React from "react"

interface AppContextType {
  loading: boolean
  setLoading: (loading: boolean) => void
}

export const AppContext = React.createContext<AppContextType>({
  loading: true,
  setLoading: () => {},
})

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true)

  return (
    <AppContext.Provider value={{ loading, setLoading }}>
      {children}
    </AppContext.Provider>
  )
} 