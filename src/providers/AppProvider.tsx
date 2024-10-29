"use client";
import { Spinner } from "@nextui-org/react";
// A context for mobile device detection
import React, { createContext, useState, useEffect, ReactNode } from "react";

// Define the context type
interface AppContextType {
  loading?: boolean;
  setLoading?: any;
  openSetting?: boolean;
  setOpenSetting?: any;
}

// Create the context with a default value
export const AppContext = createContext<AppContextType>({ loading: false });

// Define the props for the MobileProvider
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [openSetting, setOpenSetting] = useState<boolean>(true);

  useEffect(() => {

  }, []);

  return (
    <AppContext.Provider value={{ loading, setLoading, openSetting, setOpenSetting }}>
      <div className={`fixed top-0 bottom-0 left-0 right-0 z-max ${!loading ? "hidden" : ""}`}>
        <Spinner size="lg" color="primary" className="top-1/2 left-1/2 scale-150" />
      </div>
      {children}
    </AppContext.Provider>
  );
};

export default AppProvider;
