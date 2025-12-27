'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';

type FeatureFlagMap = Record<string, boolean>;

type FeatureFlagSummary = {
  totalUsers: number;
  enabledCount: number;
  defaultEnabled: boolean;
};

type FeatureFlagContextValue = {
  flags: FeatureFlagMap;
  summary: FeatureFlagSummary | null;
  isLoading: boolean;
  error?: string | null;
  refresh: () => Promise<void>;
  isEnabled: (flag: string) => boolean;
};

const DEFAULT_FLAGS: FeatureFlagMap = {
  line_numbers: false,
  onboarding_tutorial: false,
  ui_labels: false,
};

const FeatureFlagContext = createContext<FeatureFlagContextValue>({
  flags: DEFAULT_FLAGS,
  summary: null,
  isLoading: true,
  error: null,
  refresh: async () => {},
  isEnabled: () => false,
});

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlagMap>(DEFAULT_FLAGS);
  const [summary, setSummary] = useState<FeatureFlagSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/feature-flags?summary=1', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data?.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.warn('[FeatureFlagProvider] Failed to load flag summary', err);
    }
  };

  const fetchFlags = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/feature-flags', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch feature flags');
      }
      setFlags({ ...DEFAULT_FLAGS, ...(data.flags ?? {}) });
    } catch (err: any) {
      console.error('[FeatureFlagProvider] Failed to load flags:', err);
      setError(err?.message || 'Failed to load feature flags');
      setFlags(DEFAULT_FLAGS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
    fetchSummary();
    // Re-fetch when auth user changes (login/logout)
  }, [user?.uid]);

  const value = useMemo<FeatureFlagContextValue>(
    () => ({
      flags,
      summary,
      isLoading,
      error,
      refresh: async () => {
        await Promise.all([fetchFlags(), fetchSummary()]);
      },
      isEnabled: (flag: string) => Boolean(flags?.[flag]),
    }),
    [flags, summary, isLoading, error]
  );

  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>;
}

export function useFeatureFlags(): FeatureFlagContextValue {
  return useContext(FeatureFlagContext);
}
