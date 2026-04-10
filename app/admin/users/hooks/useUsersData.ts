import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminFetch } from '../../../utils/adminFetch';
import type { User, Column } from '../types';
import { getSortValue } from '../utils';

export function useUsersData() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [copiedError, setCopiedError] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load: fetch recent users (no search)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setErrorDetails(null);
      try {
        const res = await adminFetch("/api/admin/users?includeFinancial=true&limit=300");
        const data = await res.json();
        if (!res.ok || data.error) {
          const errorMsg = data.error || `HTTP ${res.status}: ${res.statusText}`;
          const details = JSON.stringify({
            status: res.status,
            statusText: res.statusText,
            error: data.error,
            details: data.details,
            timestamp: new Date().toISOString(),
            url: "/api/admin/users?includeFinancial=true&limit=300"
          }, null, 2);
          setError(errorMsg);
          setErrorDetails(details);
          return;
        }
        setUsers(data.users || []);
      } catch (err: any) {
        const errorMsg = err.message || "Failed to load users";
        const details = JSON.stringify({
          error: err.message,
          name: err.name,
          stack: err.stack?.split('\n').slice(0, 5).join('\n'),
          timestamp: new Date().toISOString(),
          url: "/api/admin/users?includeFinancial=true&limit=300"
        }, null, 2);
        setError(errorMsg);
        setErrorDetails(details);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Server-side search when search term is >= 2 chars (debounced)
  const serverSearch = useCallback(async (term: string) => {
    // Cancel any in-flight search
    searchAbortRef.current?.abort();

    if (term.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearchLoading(true);

    try {
      const encoded = encodeURIComponent(term);
      const res = await adminFetch(
        `/api/admin/users?includeFinancial=true&search=${encoded}&limit=50`,
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      const data = await res.json();
      if (!res.ok || data.error) {
        console.warn('[useUsersData] Server search failed:', data.error);
        // Fall back to client-side filtering
        setSearchResults(null);
      } else {
        setSearchResults(data.users || []);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('[useUsersData] Server search error:', err);
      setSearchResults(null);
    } finally {
      if (!controller.signal.aborted) {
        setSearchLoading(false);
      }
    }
  }, []);

  // Debounce the search
  useEffect(() => {
    const term = search.trim();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (term.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimerRef.current = setTimeout(() => {
      serverSearch(term);
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, serverSearch]);

  // Client-side filter for instant feedback, server results take over when ready
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;

    // If server search returned results, use those
    if (searchResults !== null) return searchResults;

    // While server search is loading, show client-side filtered results as preview
    return users.filter((u) => {
      const emailMatch = u.email?.toLowerCase().includes(term);
      const usernameMatch = u.username?.toLowerCase().includes(term);
      return emailMatch || usernameMatch;
    });
  }, [users, search, searchResults]);

  // Calculate max values for progress bar scaling
  const maxEarningsMonth = useMemo(() => {
    return Math.max(1, ...users.map(u => u.financial?.earningsThisMonthUsd ?? 0));
  }, [users]);

  const maxEarningsTotal = useMemo(() => {
    return Math.max(1, ...users.map(u => u.financial?.earningsTotalUsd ?? 0));
  }, [users]);

  const maxAllocatedCents = useMemo(() => {
    return Math.max(1, ...users.map(u => u.financial?.allocatedUsdCents ?? 0));
  }, [users]);

  const maxUnallocatedCents = useMemo(() => {
    return Math.max(1, ...users.map(u => u.financial?.unallocatedUsdCents ?? 0));
  }, [users]);

  const getSorted = (
    data: User[],
    sortBy: { id: string; dir: "asc" | "desc" } | null,
    columns: Column[]
  ) => {
    if (!sortBy) return data;
    const col = columns.find((c) => c.id === sortBy.id);
    if (!col) return data;
    const dir = sortBy.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = getSortValue(a, col.id);
      const vb = getSortValue(b, col.id);
      if (va === vb) return 0;
      return va > vb ? dir : -dir;
    });
  };

  return {
    users,
    setUsers,
    loading,
    error,
    errorDetails,
    copiedError,
    setCopiedError,
    search,
    setSearch,
    searchLoading,
    filtered,
    maxEarningsMonth,
    maxEarningsTotal,
    maxAllocatedCents,
    maxUnallocatedCents,
    getSorted,
  };
}
