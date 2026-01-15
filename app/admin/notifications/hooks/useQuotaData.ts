import { useState, useEffect, useCallback } from 'react';
import { useAdminData } from '@/providers/AdminDataProvider';

/**
 * Email quota data structure from the API
 */
export interface QuotaData {
  today: {
    totalSent: number;
    remaining: number;
    percentUsed: number;
    byPriority: Record<number, number>;
  };
  thisMonth: {
    totalSent: number;
    remaining: number;
    percentUsed: number;
  };
  limits: {
    DAILY: number;
    MONTHLY: number;
  };
  scheduledBatches: Array<{
    scheduledFor: string;
    count: number;
    templateBreakdown: Record<string, number>;
  }>;
  priorityLabels: Record<number, string>;
  isDevData?: boolean;
}

interface UseQuotaDataOptions {
  /** Only fetch when this tab is active */
  activeTab: string;
  /** User must be authenticated */
  user: any;
  /** Don't fetch while auth is loading */
  authLoading: boolean;
}

interface UseQuotaDataReturn {
  quotaData: QuotaData | null;
  quotaLoading: boolean;
  quotaError: string | null;
  refetchQuota: () => Promise<void>;
  expandedBatches: Set<string>;
  toggleBatch: (batchId: string) => void;
}

/**
 * Hook for loading and managing email quota data
 *
 * Fetches quota status from /api/admin/email-quota when the 'upcoming' tab is active.
 * Includes state for managing expanded/collapsed scheduled batches.
 */
export function useQuotaData({
  activeTab,
  user,
  authLoading,
}: UseQuotaDataOptions): UseQuotaDataReturn {
  const { adminFetch } = useAdminData();

  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  const loadQuotaData = useCallback(async () => {
    if (activeTab !== 'upcoming' || !user || authLoading) return;

    setQuotaLoading(true);
    setQuotaError(null);

    try {
      const res = await adminFetch('/api/admin/email-quota');
      const data = await res.json();

      if (data.success) {
        setQuotaData(data);
      } else {
        setQuotaError(data.error || 'Failed to load quota data');
      }
    } catch (error) {
      console.error('Failed to load email quota:', error);
      setQuotaError('Failed to load quota data');
    } finally {
      setQuotaLoading(false);
    }
  }, [activeTab, user, authLoading, adminFetch]);

  // Load quota data when tab becomes active
  useEffect(() => {
    loadQuotaData();
  }, [loadQuotaData]);

  // Toggle batch expansion
  const toggleBatch = useCallback((batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  }, []);

  return {
    quotaData,
    quotaLoading,
    quotaError,
    refetchQuota: loadQuotaData,
    expandedBatches,
    toggleBatch,
  };
}
