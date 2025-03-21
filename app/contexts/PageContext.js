'use client';

import React, { createContext, useContext, useState } from 'react';

const PageContext = createContext();

export function PageProvider({ children }) {
  const [currentPage, setCurrentPage] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const value = {
    page: currentPage,
    setPage: setCurrentPage,
    isEditMode,
    setIsEditMode
  };

  return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
}

export function usePage() {
  const context = useContext(PageContext);
  if (context === undefined) {
    throw new Error('usePage must be used within a PageProvider');
  }
  return context;
}
