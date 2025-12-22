'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Page } from '../types/database';

/**
 * Page data type - uses centralized Page type with partial fields
 */
type PageData = Partial<Page> & { [key: string]: any };

/**
 * Page context interface
 */
interface PageContextType {
  page: PageData | null;
  setPage: (page: PageData | null) => void;
  isEditMode: boolean;
  setIsEditMode: (isEditMode: boolean) => void;
}

/**
 * Page provider props interface
 */
interface PageProviderProps {
  children: ReactNode;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

/**
 * PageProvider component that manages page state and edit mode
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export function PageProvider({ children }: PageProviderProps) {
  const [currentPage, setCurrentPage] = useState<PageData | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  const value: PageContextType = {
    page: currentPage,
    setPage: setCurrentPage,
    isEditMode,
    setIsEditMode
  };

  return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
}

/**
 * Hook to use the page context
 *
 * @returns The page context value
 * @throws Error if used outside of PageProvider
 */
export function usePage(): PageContextType {
  const context = useContext(PageContext);
  if (context === undefined) {
    throw new Error('usePage must be used within a PageProvider');
  }
  return context;
}