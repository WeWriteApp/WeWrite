import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { useAdminData } from '../../../providers/AdminDataProvider';
import type { FinancialsResponse } from '../types';

export function useFinancialsData() {
  const { user, isLoading: authLoading } = useAuth();
  const { adminFetch, isHydrated, dataSource } = useAdminData();
  const router = useRouter();

  const [data, setData] = useState<FinancialsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      if (!user.isAdmin) {
        router.push('/');
      }
    } else {
      router.push('/auth/login?redirect=/admin/monthly-financials');
    }
  }, [user, authLoading, router]);

  const fetchData = useCallback(async (sync: boolean = false) => {
    try {
      if (sync) {
        setIsSyncing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const url = sync ? '/api/admin/monthly-financials?sync=true' : '/api/admin/monthly-financials';
      const response = await adminFetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch financial data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [adminFetch]);

  const handleSync = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    if (user && !authLoading && isHydrated && user.isAdmin) {
      fetchData();
    }
  }, [user, authLoading, isHydrated, dataSource, fetchData]);

  return {
    data,
    isLoading,
    error,
    isSyncing,
    fetchData,
    handleSync,
    user,
    authLoading,
  };
}
