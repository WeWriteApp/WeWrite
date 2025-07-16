"use client";

import { useState, useEffect } from 'react';
import { useCurrentAccount } from "../providers/CurrentAccountProvider";

interface HomeData {
  recentPages: any[];
  trendingPages: any[];
  userStats?: any;
  batchUserData?: Record<string, any>;
}

/**
 * Simple home data hook - no bullshit
 */
export function useOptimizedHome() {
  const { session } = useCurrentAccount();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.uid) {
      setLoading(false);
      return;
    }

    fetch(`/api/home?userId=${session.uid}`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [session?.uid]);

  return { data, loading, error };
}