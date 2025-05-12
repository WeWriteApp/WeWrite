"use client";
// a context for mobile device detection
import { createContext, useState, useEffect } from "react";

export const MobileContext = createContext();

export const MobileProvider = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check for mobile user agent
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

      // Check for screen width
      const isMobileWidth = window.innerWidth < 768;

      // Set as mobile if either condition is true
      const newIsMobile = isMobileDevice || isMobileWidth;
      setIsMobile(newIsMobile);

      // Debug log
      console.log("Mobile detection:", {
        isMobileDevice,
        isMobileWidth,
        userAgent,
        width: window.innerWidth,
        isMobile: newIsMobile
      });
    };

    // Initial check
    checkMobile();

    // Add event listener
    window.addEventListener("resize", checkMobile);

    // Cleanup
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <MobileContext.Provider value={{ isMobile }}>
      {children}
    </MobileContext.Provider>
  );
};

export default MobileProvider;
