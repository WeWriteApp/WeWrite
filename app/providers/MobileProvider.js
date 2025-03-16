"use client";
// a context for mobile device detection
import { createContext, useState, useEffect } from "react";

export const MobileContext = createContext();

export const MobileProvider = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsMobile(true);
    }

    window.addEventListener("resize", () => {
      if (window.innerWidth < 768) {
        setIsMobile(true);
      }
    });

    return () => {
      window.removeEventListener("resize", () => {
        if (window.innerWidth < 768) {
          setIsMobile(true);
        }
      });
    };
  }, []);

  return (
    <MobileContext.Provider value={{ isMobile }}>
      {children}
    </MobileContext.Provider>
  );
};

export default MobileProvider;
