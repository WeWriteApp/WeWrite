"use client";
// contexts/LoggingProvider.js
import React, { createContext, useContext, useEffect } from "react";

// Create a logging context
const LoggingContext = createContext();

// Custom hook to use the Logging Context
export const useLogging = () => useContext(LoggingContext);

// Logging Provider Component
const LoggingProvider = ({ children }) => {
  // Function to log errors
  const logError = async (error, path) => {
    try {
      await fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: error.message,
          stack: error.stack
        }),
      });
    } catch (e) {
      console.error("Failed to log error to backend:", e);
    }
  };

  // Global error handler
  useEffect(() => {
    const handleGlobalError = (event) => {
      logError(event.error || { message: event.message });
    };

    // Attach the global error listener
    window.addEventListener("error", handleGlobalError);

    return () => {
      window.removeEventListener("error", handleGlobalError);
    };
  }, []);

  return (
    <LoggingContext.Provider value={{ logError }}>
      {children}
    </LoggingContext.Provider>
  );
};

export default LoggingProvider;
