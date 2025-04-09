"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthProvider";
import { initializeTracking, trackUserSession, getDeviceContext } from "../utils/deviceTracking";

// Create context
export const TrackingContext = createContext({
  deviceInfo: null,
  sessionId: null,
  isPwa: false
});

export function TrackingProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isPwa, setIsPwa] = useState(false);

  // Initialize tracking on mount
  useEffect(() => {
    initializeTracking();
    
    // Get device info
    const deviceContext = getDeviceContext();
    setDeviceInfo(deviceContext);
    setIsPwa(deviceContext.isPwa);
    
    // Log device info
    console.log("Device tracking initialized:", deviceContext);
  }, []);
  
  // Track user session when user logs in
  useEffect(() => {
    const trackSession = async () => {
      if (user?.uid) {
        const sid = await trackUserSession(user.uid);
        if (sid) {
          setSessionId(sid);
        }
      }
    };
    
    if (user) {
      trackSession();
    }
  }, [user]);

  return (
    <TrackingContext.Provider value={{ deviceInfo, sessionId, isPwa }}>
      {children}
    </TrackingContext.Provider>
  );
}
