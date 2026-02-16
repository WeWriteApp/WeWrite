import { useEffect, useMemo, useState } from 'react';
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const emailMatch = u.email?.toLowerCase().includes(term);
      const usernameMatch = u.username?.toLowerCase().includes(term);
      return emailMatch || usernameMatch;
    });
  }, [users, search]);

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
    filtered,
    maxEarningsMonth,
    maxEarningsTotal,
    maxAllocatedCents,
    maxUnallocatedCents,
    getSorted,
  };
}
