"use client";
import React, { useState, createContext, useCallback } from 'react';

// Create the context with default values
export const DrawerContext = createContext({
  isOpen: false,
  setIsOpen: () => {}
});

export const DrawerProvider = ({ children }) => {
  const [isOpen, setIsOpenState] = useState(false);

  // Use useCallback to ensure the function reference is stable
  const setIsOpen = useCallback((value) => {
    console.log("DrawerProvider: setIsOpen called with value:", value);
    setIsOpenState(value);
  }, []);

  console.log("DrawerProvider initialized, isOpen:", isOpen);

  // Create a stable value object with memoization to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    isOpen,
    setIsOpen
  }), [isOpen, setIsOpen]);

  return (
    <DrawerContext.Provider value={contextValue}>
      {children}
    </DrawerContext.Provider>
  );
}