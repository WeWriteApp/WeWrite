"use client";
import { createContext, useContext } from "react";
import { AuthContext } from "./AuthProvider";

// Mock data for testing without Firebase
const mockPages = [
  { id: '1', name: 'Getting Started', isPublic: true, userId: 'mock-user-1', groupId: 'default-group' },
  { id: '2', name: 'User Guide', isPublic: true, userId: 'mock-user-2', groupId: 'default-group' },
  { id: '3', name: 'Private Notes', isPublic: false, userId: 'mock-user-1', groupId: 'default-group' },
  { id: '4', name: 'Project Ideas', isPublic: false, userId: 'mock-user-1', groupId: 'default-group' },
];

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const { user } = useContext(AuthContext);

  // Use mock data instead of Firebase
  const pages = mockPages;
  const loading = false;
  const loadMorePages = () => {};
  const isMoreLoading = false;
  const hasMorePages = false;

  // Filter pages that are either public or owned by the mock user
  const filtered = pages.filter(page =>
    page.isPublic || (user && page.userId === (user.uid || 'mock-user-1'))
  );

  return (
    <DataContext.Provider
      value={{
        loading,
        pages,
        filtered,
        loadMorePages,
        isMoreLoading,
        hasMorePages
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
