"use client";

import { createContext, useState, useEffect, useContext, ReactNode } from "react";

/**
 * Mobile context interface
 */
interface MobileContextType {
  isMobile: boolean;
}

/**
 * Mobile provider props interface
 */
interface MobileProviderProps {
  children: ReactNode;
}

export const MobileContext = createContext<MobileContextType | undefined>(undefined);

/**
 * MobileProvider component that provides mobile device detection
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export const MobileProvider = ({ children }: MobileProviderProps) => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    /**
     * Check if the current viewport is mobile-sized
     */
    const checkMobile = (): void => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkMobile();

    // Add event listener
    window.addEventListener("resize", checkMobile);

    // Cleanup
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const value: MobileContextType = { isMobile };

  return (
    <MobileContext.Provider value={value}>
      {children}
    </MobileContext.Provider>
  );
};

/**
 * Hook to use the mobile context
 *
 * @returns The mobile context value
 * @throws Error if used outside of MobileProvider
 */
export const useMobile = (): MobileContextType => {
  const context = useContext(MobileContext);
  if (context === undefined) {
    throw new Error('useMobile must be used within a MobileProvider');
  }
  return context;
};

export default MobileProvider;
