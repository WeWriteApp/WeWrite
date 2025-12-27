"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ADMIN_DATA_STORAGE_KEY } from '../utils/adminFetch';

type DataSource = 'dev' | 'production';

interface AdminDataContextType {
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
  isProduction: boolean;
  isHydrated: boolean;
  // Fetch wrapper that adds the X-Force-Production-Data header when needed
  adminFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  // Helper for JSON responses
  adminFetchJson: <T = any>(input: RequestInfo | URL, init?: RequestInit) => Promise<T>;
}

const AdminDataContext = createContext<AdminDataContextType | null>(null);

/**
 * Determine the default data source based on the current environment.
 * - In production/preview deployments: default to 'production'
 * - In local development: default to 'dev'
 */
function getEnvironmentDefault(): DataSource {
  // VERCEL_ENV is 'production' or 'preview' on Vercel, undefined locally
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercelEnv === 'production' || vercelEnv === 'preview') {
    return 'production';
  }
  // Local development defaults to dev
  return 'dev';
}

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  // Always start with environment default on server to avoid hydration mismatch
  const [dataSource, setDataSourceState] = useState<DataSource>(getEnvironmentDefault);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read from localStorage ONLY after hydration, with environment-aware default
  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_DATA_STORAGE_KEY);
    if (stored === 'production' || stored === 'dev') {
      setDataSourceState(stored);
    }
    // If no stored preference, keep the environment default (already set)
    setIsHydrated(true);
  }, []);

  // Persist to localStorage when changed and trigger page reload to refetch data
  const setDataSource = useCallback((source: DataSource) => {
    localStorage.setItem(ADMIN_DATA_STORAGE_KEY, source);
    // Reload page to refetch all data with new data source
    window.location.reload();
  }, []);

  const isProduction = dataSource === 'production';

  // Fetch wrapper that adds the production data header when needed
  const adminFetch = useCallback(async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const headers = new Headers(init?.headers);

    if (isProduction) {
      headers.set('X-Force-Production-Data', 'true');
    }

    return fetch(input, { ...init, headers });
  }, [isProduction]);

  // JSON fetch helper
  const adminFetchJson = useCallback(async <T = any>(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<T> => {
    const response = await adminFetch(input, init);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }, [adminFetch]);

  return (
    <AdminDataContext.Provider
      value={{
        dataSource,
        setDataSource,
        isProduction,
        isHydrated,
        adminFetch,
        adminFetchJson,
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error('useAdminData must be used within an AdminDataProvider');
  }
  return context;
}

// Optional hook that doesn't throw if not in provider (for components that might be used outside admin)
export function useAdminDataOptional() {
  return useContext(AdminDataContext);
}
