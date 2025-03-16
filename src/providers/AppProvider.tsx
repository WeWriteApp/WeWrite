"use client";

import { createContext, useState, ReactNode } from "react";

interface AppContextType {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const AppContext = createContext<AppContextType>({
  loading: true,
  setLoading: () => {},
});

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [loading, setLoading] = useState(true);

  return (
    <AppContext.Provider value={{ loading, setLoading }}>
      {children}
    </AppContext.Provider>
  );
} 