"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { AuthContext } from "./AuthProvider";
import { getPages } from "../firebase/database";
import { ErrorBoundary } from "../components/ErrorBoundary";

export const DataContext = createContext();

const LoadingState = () => (
  <div className="p-4">
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
    </div>
  </div>
);

const ErrorState = ({ error, onRetry }) => (
  <div className="p-4 rounded-md bg-red-50 border border-red-200">
    <h2 className="text-lg font-semibold text-red-800 mb-2">Error loading data</h2>
    <p className="text-red-600">{error?.message || 'An unexpected error occurred while loading pages'}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-500"
      >
        Try again
      </button>
    )}
  </div>
);

export const DataProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPages = async () => {
      try {
        console.log('Fetching pages for user:', user.uid);
        const fetchedPages = await getPages();
        console.log('Fetched pages:', fetchedPages.length);
        setPages(fetchedPages);
      } catch (err) {
        console.error('Error fetching pages:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [user]);

  const filtered = pages.filter(page =>
    page.isPublic || (user && (page.userId === user.uid || (user.groups && user.groups.includes(page.groupId))))
  );

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <ErrorBoundary>
      <DataContext.Provider
        value={{
          loading,
          error,
          pages,
          filtered,
          loadMorePages: () => {},
          isMoreLoading: false,
          hasMorePages: false
        }}
      >
        {children}
      </DataContext.Provider>
    </ErrorBoundary>
  );
};
