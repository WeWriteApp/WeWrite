"use client";
// A context for mobile device detection
import React, { createContext, useState, useEffect, ReactNode } from "react";

// Define the context type
interface MobileContextType {
  isMobile: boolean;
}

// Create the context with a default value
export const MobileContext = createContext<MobileContextType | undefined>(undefined);

// Define the props for the MobileProvider
interface MobileProviderProps {
  children: ReactNode;
}

export const MobileProvider: React.FC<MobileProviderProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile(); // Check on initial load

    window.addEventListener("resize", checkMobile); // Check on resize

    return () => {
      window.removeEventListener("resize", checkMobile); // Cleanup the event listener
    };
  }, []);

  return (
    <MobileContext.Provider value={{ isMobile }}>
      {children}
    </MobileContext.Provider>
  );
};

export default MobileProvider;
