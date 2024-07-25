"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext } from 'react';
export const NavContext = createContext();

export const NavProvider = ({ children }) => {
  const [selectedTab, setSelectedTab] = useState("Requests");

    return (
    <NavContext.Provider value={{ 
      selectedTab,
      setSelectedTab
    }}>
      {children}
    </NavContext.Provider>
  );
}