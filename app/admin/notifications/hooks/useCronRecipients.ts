import { useState, useEffect, useCallback } from 'react';
import { useAdminData } from '@/providers/AdminDataProvider';
import type { CronSchedule, CronRecipient, CronRecipientsState } from '../types';

interface UseCronRecipientsOptions {
  /** Cron schedules to load recipients for */
  cronSchedules: CronSchedule[];
  /** User must be authenticated */
  user: any;
  /** Don't fetch while auth is loading */
  authLoading: boolean;
}

interface UseCronRecipientsReturn {
  /** Map of cronId to recipients state */
  cronRecipients: Record<string, CronRecipientsState>;
  /** Check if any cron is still loading */
  isLoadingRecipients: boolean;
  /** Force refresh all cron recipients */
  refreshAllCronRecipients: () => Promise<void>;
  /** Get recipient count for a specific cron */
  getRecipientCount: (cronId: string) => number;
  /** Get recipients for a specific cron */
  getRecipients: (cronId: string) => CronRecipient[];
  /** Check if a specific cron is loading */
  isLoading: (cronId: string) => boolean;
}

/**
 * Hook for loading and managing cron job recipients
 *
 * Loads recipients for all non-system cron jobs when the user is authenticated.
 * Used by both the templates tab (for showing upcoming counts) and the upcoming tab (for listing recipients).
 */
export function useCronRecipients({
  cronSchedules,
  user,
  authLoading,
}: UseCronRecipientsOptions): UseCronRecipientsReturn {
  const { adminFetch } = useAdminData();

  const [cronRecipients, setCronRecipients] = useState<Record<string, CronRecipientsState>>({});

  // Load all cron recipients on mount
  useEffect(() => {
    const loadAllCronRecipients = async () => {
      for (const cron of cronSchedules) {
        // Skip loading recipients for system jobs - they don't send user-facing emails
        if (cron.isSystemJob) continue;

        if (!cronRecipients[cron.id]) {
          setCronRecipients(prev => ({ ...prev, [cron.id]: { loading: true, recipients: [] } }));
          try {
            const res = await adminFetch(`/api/admin/cron-recipients?cronId=${cron.id}`);
            const data = await res.json();
            setCronRecipients(prev => ({
              ...prev,
              [cron.id]: { loading: false, recipients: data.recipients || [] }
            }));
          } catch (error) {
            console.error('Failed to fetch recipients:', error);
            setCronRecipients(prev => ({
              ...prev,
              [cron.id]: { loading: false, recipients: [] }
            }));
          }
        }
      }
    };

    if (user && !authLoading) {
      loadAllCronRecipients();
    }
  }, [user, authLoading, cronSchedules, adminFetch]);

  // Force refresh all cron recipients
  const refreshAllCronRecipients = useCallback(async () => {
    // Set all to loading
    const loadingState: Record<string, CronRecipientsState> = {};
    for (const cron of cronSchedules) {
      if (!cron.isSystemJob) {
        loadingState[cron.id] = { loading: true, recipients: [] };
      }
    }
    setCronRecipients(loadingState);

    // Reload all
    for (const cron of cronSchedules) {
      if (cron.isSystemJob) continue;
      try {
        const res = await adminFetch(`/api/admin/cron-recipients?cronId=${cron.id}`);
        const data = await res.json();
        setCronRecipients(prev => ({
          ...prev,
          [cron.id]: { loading: false, recipients: data.recipients || [] }
        }));
      } catch (error) {
        console.error('Failed to fetch recipients:', error);
        setCronRecipients(prev => ({
          ...prev,
          [cron.id]: { loading: false, recipients: [] }
        }));
      }
    }
  }, [cronSchedules, adminFetch]);

  // Helper to check if any cron is loading
  const isLoadingRecipients = Object.values(cronRecipients).some(r => r.loading);

  // Helper to get recipient count
  const getRecipientCount = useCallback((cronId: string): number => {
    return cronRecipients[cronId]?.recipients?.length || 0;
  }, [cronRecipients]);

  // Helper to get recipients
  const getRecipients = useCallback((cronId: string): CronRecipient[] => {
    return cronRecipients[cronId]?.recipients || [];
  }, [cronRecipients]);

  // Helper to check if specific cron is loading
  const isLoading = useCallback((cronId: string): boolean => {
    return cronRecipients[cronId]?.loading || false;
  }, [cronRecipients]);

  return {
    cronRecipients,
    isLoadingRecipients,
    refreshAllCronRecipients,
    getRecipientCount,
    getRecipients,
    isLoading,
  };
}
