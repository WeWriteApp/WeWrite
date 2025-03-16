"use client";

import { createContext, useState, ReactNode } from "react";

interface Page {
  id: string;
  title: string;
  content: string;
  userId: string;
  isPublic: boolean;
  groupId?: string;
}

interface DataContextType {
  pages: Page[];
  groups: any[];
  loadMorePages: (userId: string) => Promise<void>;
  isMoreLoading: boolean;
  hasMorePages: boolean;
}

export const DataContext = createContext<DataContextType>({
  pages: [],
  groups: [],
  loadMorePages: async () => {},
  isMoreLoading: false,
  hasMorePages: false,
});

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);

  const loadMorePages = async (userId: string) => {
    setIsMoreLoading(true);
    // Here you would typically load more pages from your database
    // For now, we'll just simulate a loading state
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsMoreLoading(false);
    setHasMorePages(false);
  };

  return (
    <DataContext.Provider value={{ pages, groups, loadMorePages, isMoreLoading, hasMorePages }}>
      {children}
    </DataContext.Provider>
  );
} 