"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext } from 'react';
export const DrawerContext = createContext();

export const DrawerProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [childDrawerSelection, setChildDrawerSelection] = useState(null);

    return (
    <DrawerContext.Provider value={{ isOpen, setIsOpen, selected, setSelected, childDrawerSelection, setChildDrawerSelection }}>
      {children}
    </DrawerContext.Provider>
  );
}