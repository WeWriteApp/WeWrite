"use client";
import { createContext, ReactNode, useContext } from "react";
import { AuthContext } from "./AuthProvider";
import usePages from "@/hooks/usePages";

interface DataContextType {
  pages?: any;
  loadMorePages?: any;
  isMoreLoading?: any;
  hasMorePages?: boolean
}

interface DataProviderProps {
  children: ReactNode;
}

export const DataContext = createContext<DataContextType>({});

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { user } = useContext(AuthContext); // Get the authenticated user
  // Use the usePages hook, passing in the userId if the user is authenticated
  const {
    pages,
    loadMorePages,
    isMoreLoading,
    hasMorePages
  } = usePages(user ? user.uid : null); // Use `user.uid` to fetch pages for the logged-in user

  // Optionally: Handle filtered pages if needed

  return (
    <DataContext.Provider
      value={{
        pages,
        loadMorePages,
        isMoreLoading,
        hasMorePages,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};