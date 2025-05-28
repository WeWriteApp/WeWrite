"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';

/**
 * Drawer context interface
 */
interface DrawerContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selected: string | null;
  setSelected: (selected: string | null) => void;
  childDrawerSelection: string | null;
  setChildDrawerSelection: (selection: string | null) => void;
}

/**
 * Drawer provider props interface
 */
interface DrawerProviderProps {
  children: ReactNode;
}

export const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

/**
 * DrawerProvider component that manages drawer state
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export const DrawerProvider = ({ children }: DrawerProviderProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [childDrawerSelection, setChildDrawerSelection] = useState<string | null>(null);

  const value: DrawerContextType = {
    isOpen,
    setIsOpen,
    selected,
    setSelected,
    childDrawerSelection,
    setChildDrawerSelection
  };

  return (
    <DrawerContext.Provider value={value}>
      {children}
    </DrawerContext.Provider>
  );
};

/**
 * Hook to use the drawer context
 *
 * @returns The drawer context value
 * @throws Error if used outside of DrawerProvider
 */
export const useDrawer = (): DrawerContextType => {
  const context = useContext(DrawerContext);
  if (context === undefined) {
    throw new Error('useDrawer must be used within a DrawerProvider');
  }
  return context;
};