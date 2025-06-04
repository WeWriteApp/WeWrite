"use client";
// contexts/LoggingProvider.tsx
import React, { createContext, useContext, useEffect, ReactNode } from "react";

// Types
interface LoggingError {
  message: string;
  stack?: string;
}

interface LoggingContextType {
  logError: (error: LoggingError, path?: string) => Promise<void>;
}

interface LoggingProviderProps {
  children: ReactNode;
}

// Create a logging context
const LoggingContext = createContext<LoggingContextType | undefined>(undefined);

// Custom hook to use the Logging Context
export const useLogging = (): LoggingContextType => {
  const context = useContext(LoggingContext);
  if (!context) {
    throw new Error("useLogging must be used within a LoggingProvider");
  }
  return context;
};

// Logging Provider Component
export const LoggingProvider = ({ children }: LoggingProviderProps) => {
  // Function to log errors
  const logError = async (error: LoggingError, path?: string): Promise<void> => {
    try {
      await fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: error.message,
          stack: error.stack,
          path
        }),
      });
    } catch (e) {
      console.error("Failed to log error to backend:", e);
    }
  };

  // Global error handler
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      const error: LoggingError = event.error || {
        message: event.message || 'Unknown error',
        stack: event.error?.stack
      };
      logError(error);
    };

    // Attach the global error listener
    window.addEventListener("error", handleGlobalError);

    return () => {
      window.removeEventListener("error", handleGlobalError);
    };
  }, [logError]);

  const value: LoggingContextType = {
    logError
  };

  return (
    <LoggingContext.Provider value={value}>
      {children}
    </LoggingContext.Provider>
  );
};
