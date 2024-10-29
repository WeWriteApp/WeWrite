"use client";
// A context for mobile device detection
import React, { createContext, useState, useEffect, ReactNode } from "react";

// Define the context type
interface AppContextType {
  loading?: boolean;
  setLoading?: any
}

// Create the context with a default value
export const AppContext = createContext<AppContextType>({ loading: false });

// Define the props for the MobileProvider
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {

  }, []);

  return (
    <AppContext.Provider value={{ loading, setLoading }}>
      {children}
    </AppContext.Provider>
  );
};

export default AppProvider;
