import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import SimpleSparkline from '../../../components/utils/SimpleSparkline';
import { RiskScoreBadge } from '../../../components/admin/RiskScoreBadge';
import type { User, Column } from '../types';
import {
  calculateClientRiskScore,
  renderSubscription,
  renderPayout,
  renderEarningsWithBar,
  renderAllocationWithBar,
  formatRelative,
} from '../utils';

interface UseColumnsParams {
  maxEarningsMonth: number;
  maxEarningsTotal: number;
  maxAllocatedCents: number;
  maxUnallocatedCents: number;
  setVerifyUser: (u: User | null) => void;
}

export function useColumns({
  maxEarningsMonth,
  maxEarningsTotal,
  maxAllocatedCents,
  maxUnallocatedCents,
  setVerifyUser,
}: UseColumnsParams) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adminUsersColumnOrder');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.warn('Failed to parse saved column order:', e);
        }
      }
    }
    return [];
  });

  const [sortBy, setSortBy] = useState<{ id: string; dir: "asc" | "desc" } | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adminUsersSortBy');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.warn('Failed to parse saved sort settings:', e);
        }
      }
    }
    return null;
  });

  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const columns: Column[] = useMemo(() => [
    {
      id: "user",
      label: "Email",
      sticky: false,
      sortable: true,
      minWidth: 220,
      render: (u) => (
        React.createElement('div', { className: "font-medium whitespace-nowrap" }, u.email)
      )
    },
    {
      id: "username",
      label: "Username",
      sortable: true,
      minWidth: 160,
      render: (u) => (
        React.createElement('span', { className: "whitespace-nowrap font-medium" }, u.username || "—")
      )
    },
    {
      id: "subscription",
      label: "Subscription",
      sortable: true,
      minWidth: 150,
      render: (u) => renderSubscription(u.financial)
    },
    {
      id: "emailVerified",
      label: "Email verified",
      sortable: true,
      minWidth: 120,
      render: (u) => (
        React.createElement('div', { className: "relative inline-flex" },
          React.createElement(Button, {
            size: "sm",
            variant: "ghost",
            className: "h-7 px-2 text-xs gap-1",
            onClick: () => setVerifyUser(u)
          },
            React.createElement(Badge, { variant: u.emailVerified ? 'success-secondary' : 'destructive-secondary' },
              u.emailVerified ? 'Verified' : 'Unverified'
            )
          )
        )
      )
    },
    {
      id: "admin",
      label: "Admin",
      sortable: true,
      minWidth: 100,
      render: (u) => (
        u.isAdmin
          ? React.createElement(Badge, { variant: "success-secondary" }, "Admin")
          : React.createElement(Badge, { variant: "outline-static" }, "Not admin")
      )
    },
    {
      id: "riskScore",
      label: "Risk",
      sortable: true,
      minWidth: 80,
      render: (u) => (
        React.createElement(RiskScoreBadge, {
          score: u.riskScore ?? calculateClientRiskScore(u),
          size: "sm",
          showTooltip: true,
        })
      )
    },
    {
      id: "referredBy",
      label: "Referred by",
      sortable: true,
      minWidth: 140,
      render: (u) => {
        if (!u.referredBy) return React.createElement('span', { className: "text-muted-foreground" }, "—");
        const displayName = u.referredByUsername || u.referredBy.substring(0, 8) + '...';
        return React.createElement('div', { className: "flex items-center gap-1" },
          React.createElement('a', {
            href: `/u/${u.referredByUsername || u.referredBy}`,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-primary hover:underline text-sm font-medium",
            onClick: (e: React.MouseEvent) => e.stopPropagation()
          }, `@${displayName}`),
          u.referralSource && React.createElement(Badge, {
            variant: "outline",
            className: "text-[10px] px-1 py-0"
          }, u.referralSource)
        );
      }
    },
    {
      id: "payouts",
      label: "Payouts",
      sortable: true,
      minWidth: 110,
      render: (u) => renderPayout(u.financial, u.stripeConnectedAccountId)
    },
    {
      id: "earningsMonth",
      label: "Earnings (month)",
      sortable: true,
      minWidth: 160,
      render: (u) => renderEarningsWithBar(u.financial?.earningsThisMonthUsd, maxEarningsMonth)
    },
    {
      id: "earningsTotal",
      label: "Earnings (total)",
      sortable: true,
      minWidth: 160,
      render: (u) => renderEarningsWithBar(u.financial?.earningsTotalUsd, maxEarningsTotal)
    },
    {
      id: "available",
      label: "Avail. earnings",
      sortable: true,
      minWidth: 120,
      render: (u) =>
        u.financial?.availableEarningsUsd !== undefined
          ? `$${(u.financial.availableEarningsUsd ?? 0).toFixed(2)}`
          : "—"
    },
    {
      id: "created",
      label: "Created",
      sortable: true,
      minWidth: 100,
      render: (u) => {
        const rel = formatRelative(u.createdAt);
        return React.createElement('span', { title: rel.title }, rel.display);
      }
    },
    {
      id: "lastLogin",
      label: "Last login",
      sortable: true,
      minWidth: 100,
      render: (u) => {
        const rel = formatRelative(u.lastLogin);
        return React.createElement('span', { title: rel.title }, rel.display);
      }
    },
    {
      id: "totalPages",
      label: "Total pages",
      sortable: true,
      minWidth: 100,
      render: (u) => u.totalPages !== undefined ? u.totalPages : "—"
    },
    {
      id: "allocated",
      label: "Allocated",
      sortable: true,
      minWidth: 140,
      render: (u) => renderAllocationWithBar(u.financial?.allocatedUsdCents, maxAllocatedCents, 'bg-primary')
    },
    {
      id: "unallocated",
      label: "Unallocated",
      sortable: true,
      minWidth: 140,
      render: (u) => renderAllocationWithBar(u.financial?.unallocatedUsdCents, maxUnallocatedCents, 'bg-amber-500')
    },
    {
      id: "pwa",
      label: "PWA installed",
      sortable: true,
      minWidth: 110,
      render: (u) => (
        u.pwaInstalled
          ? React.createElement(Badge, { variant: "success-secondary" },
              React.createElement(Icon, { name: "Smartphone", size: 12, className: "mr-1" }),
              "Installed"
            )
          : React.createElement(Badge, { variant: "outline-static" }, "Not installed")
      )
    },
    {
      id: "notifications",
      label: "Notifications",
      sortable: false,
      minWidth: 110,
      render: (u) => {
        const sparklineData = u.notificationSparkline || Array(7).fill(0);
        const hasNotifications = sparklineData.some(v => v > 0);
        if (!hasNotifications) {
          return React.createElement('span', { className: "text-muted-foreground text-xs" }, "None");
        }
        return React.createElement('div', { className: "flex items-center gap-2" },
          React.createElement('div', { className: "h-8 w-20" },
            React.createElement(SimpleSparkline, {
              data: sparklineData,
              height: 30,
              color: "oklch(var(--primary))"
            })
          ),
          React.createElement('span', { className: "text-xs text-muted-foreground" }, "7d")
        );
      }
    }
  ], [maxEarningsMonth, maxEarningsTotal, maxAllocatedCents, maxUnallocatedCents, setVerifyUser]);

  // Initialize visible columns once
  useEffect(() => {
    if (visibleColumns.length === 0) {
      setVisibleColumns(columns.map((c) => c.id));
    }
  }, [columns, visibleColumns.length]);

  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const reorderColumn = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setVisibleColumns((prev) => {
      const fromIndex = prev.indexOf(fromId);
      const toIndex = prev.indexOf(toId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const newOrder = [...prev];
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, fromId);
      return newOrder;
    });
  };

  const moveColumn = (dragIndex: number, hoverIndex: number) => {
    setVisibleColumns((prev) => {
      const newOrder = [...prev];
      const [draggedColumn] = newOrder.splice(dragIndex, 1);
      newOrder.splice(hoverIndex, 0, draggedColumn);
      return newOrder;
    });
  };

  // Persist column order to localStorage
  useEffect(() => {
    if (visibleColumns.length > 0 && typeof window !== 'undefined') {
      localStorage.setItem('adminUsersColumnOrder', JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  // Persist sort settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sortBy) {
        localStorage.setItem('adminUsersSortBy', JSON.stringify(sortBy));
      } else {
        localStorage.removeItem('adminUsersSortBy');
      }
    }
  }, [sortBy]);

  const activeColumns = visibleColumns
    .map((colId) => columns.find((c) => c.id === colId))
    .filter((c): c is Column => c !== undefined);

  const handleSort = (id: string, sortable?: boolean) => {
    if (!sortable) return;
    setSortBy((prev) => {
      if (prev?.id === id) {
        return { id, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { id, dir: "asc" };
    });
  };

  return {
    columns,
    visibleColumns,
    sortBy,
    draggedColumnId,
    setDraggedColumnId,
    dragOverColumnId,
    setDragOverColumnId,
    activeColumns,
    toggleColumn,
    reorderColumn,
    moveColumn,
    handleSort,
  };
}
