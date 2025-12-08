"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminSubpageHeader } from "../../components/admin/AdminSubpageHeader";
import { Card, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { CreditCard, Banknote, Bell, Filter } from "lucide-react";
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, GripVertical, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";

type FinancialInfo = {
  hasSubscription: boolean;
  subscriptionAmount?: number | null;
  subscriptionStatus?: string | null;
  subscriptionCancelReason?: string | null;
  availableEarningsUsd?: number;
  payoutsSetup: boolean;
  earningsTotalUsd?: number;
  earningsThisMonthUsd?: number;
};

type User = {
  uid: string;
  email: string;
  username?: string;
  createdAt?: any;
  lastLogin?: any;
  totalPages?: number;
  stripeConnectedAccountId?: string | null;
  isAdmin?: boolean;
  financial?: FinancialInfo;
  emailVerified?: boolean;
};

type Column = {
  id: string;
  label: string;
  sticky?: boolean;
  sortable?: boolean;
  render: (u: User) => React.ReactNode;
};

type ActivityType = 'subscription' | 'payout' | 'notification';
type ActivityFilter = ActivityType | 'all';

type Activity = {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  amount?: number;
  status?: string;
  createdAt: string;
  metadata?: Record<string, any>;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [copiedError, setCopiedError] = useState(false);
  const [search, setSearch] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | "warning"; message: string; details?: string } | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<User | null>(null);
  const [resetUserId, setResetUserId] = useState<User | null>(null);
  const [editUsernameUser, setEditUsernameUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [verifyUser, setVerifyUser] = useState<User | null>(null);
  const [userActivities, setUserActivities] = useState<Activity[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  // Drag state for column reordering in dropdown
  const [columnDragId, setColumnDragId] = useState<string | null>(null);
  const [columnDragOverId, setColumnDragOverId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setErrorDetails(null);
      try {
        const res = await fetch("/api/admin/users?includeFinancial=true&limit=300");
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

  // Column definitions
  const columns: Column[] = useMemo(() => [
    {
      id: "user",
      label: "User",
      sticky: false,
      sortable: true,
      render: (u) => (
        <div className="space-y-1 whitespace-nowrap">
          <div className="font-medium">{u.email}</div>
          <div className="text-xs text-muted-foreground">{u.username || "—"}</div>
        </div>
      )
    },
    {
      id: "username",
      label: "Username",
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap font-medium">{u.username || "—"}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={loadingAction !== null}
            onClick={() => {
              setEditUsernameUser(u);
              setNewUsername(u.username || "");
            }}
          >
            Edit
          </Button>
        </div>
      )
    },
    {
      id: "subscription",
      label: "Subscription",
      sortable: true,
      render: (u) => renderSubscription(u.financial)
    },
    {
      id: "emailVerified",
      label: "Email verified",
      sortable: true,
      render: (u) => (
        <div className="relative inline-flex">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setVerifyUser(u)}
          >
            <Badge variant={u.emailVerified ? 'success-secondary' : 'destructive-secondary'}>
              {u.emailVerified ? 'Verified' : 'Unverified'}
            </Badge>
          </Button>
        </div>
      )
    },
    {
      id: "admin",
      label: "Admin",
      sortable: true,
      render: (u) =>
        u.isAdmin ? (
          <Badge variant="success-secondary">Admin</Badge>
        ) : (
          <Badge variant="outline-static">Not admin</Badge>
        )
    },
    {
      id: "payouts",
      label: "Payouts",
      sortable: true,
      render: (u) => renderPayout(u.financial, u.stripeConnectedAccountId)
    },
    {
      id: "earningsMonth",
      label: "Earnings (month)",
      sortable: true,
      render: (u) => (
        <span className={`font-medium ${earningColor(u.financial?.earningsThisMonthUsd)}`}>
          {u.financial?.earningsThisMonthUsd !== undefined
            ? `$${(u.financial.earningsThisMonthUsd ?? 0).toFixed(2)}`
            : "—"}
        </span>
      )
    },
    {
      id: "earningsTotal",
      label: "Earnings (total)",
      sortable: true,
      render: (u) => (
        <span className={`font-medium ${earningColor(u.financial?.earningsTotalUsd)}`}>
          {u.financial?.earningsTotalUsd !== undefined
            ? `$${(u.financial.earningsTotalUsd ?? 0).toFixed(2)}`
            : "—"}
        </span>
      )
    },
    {
      id: "available",
      label: "Avail. earnings",
      sortable: true,
      render: (u) =>
        u.financial?.availableEarningsUsd !== undefined
          ? `$${(u.financial.availableEarningsUsd ?? 0).toFixed(2)}`
          : "—"
    },
    {
      id: "created",
      label: "Created",
      sortable: true,
      render: (u) => {
        const rel = formatRelative(u.createdAt);
        return <span title={rel.title}>{rel.display}</span>;
      }
    },
    {
      id: "lastLogin",
      label: "Last login",
      sortable: true,
      render: (u) => {
        const rel = formatRelative(u.lastLogin);
        return <span title={rel.title}>{rel.display}</span>;
      }
    },
    {
      id: "totalPages",
      label: "Total pages",
      sortable: true,
      render: (u) => u.totalPages !== undefined ? u.totalPages : "—"
    },
    {
      id: "allocated",
      label: "Allocated",
      sortable: true,
      render: () => "—" // TODO
    },
    {
      id: "unallocated",
      label: "Unallocated",
      sortable: true,
      render: () => "—" // TODO
    },
    {
      id: "pwa",
      label: "PWA installed",
      sortable: true,
      render: () => "—" // TODO
    },
    {
      id: "notifications",
      label: "Notifications",
      sortable: true,
      render: () => "—" // TODO
    },
    {
      id: "adminActions",
      label: "Actions",
      render: (u) => (
        <div className="space-x-2 whitespace-nowrap">
          <Button
            variant="outline"
            size="sm"
            disabled={loadingAction !== null}
            onClick={() => setResetUserId(u)}
          >
            Reset password
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={loadingAction !== null}
            onClick={() => setDeleteUserId(u)}
          >
            Delete
          </Button>
        </div>
      )
    }
  ], [loadingAction]);

  // Initialize visible columns once
  useEffect(() => {
    if (visibleColumns.length === 0) {
      setVisibleColumns(columns.map((c) => c.id));
    }
  }, [columns, visibleColumns.length]);

  const moveColumn = (fromId: string, toId: string) => {
    setVisibleColumns((prev) => {
      const from = prev.indexOf(fromId);
      const to = prev.indexOf(toId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, fromId);
      return next;
    });
  };

  const moveColumnStep = (id: string, dir: "up" | "down") => {
    setVisibleColumns((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  };

  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const activeColumns = columns.filter((c) => visibleColumns.includes(c.id));

  const getSortValue = (u: User, id: string) => {
    switch (id) {
      case "user":
        return u.email || "";
      case "username":
        return u.username || "";
      case "subscription":
        return u.financial?.subscriptionAmount ?? 0;
      case "emailVerified":
        return u.emailVerified ? 1 : 0;
      case "admin":
        return u.isAdmin ? 1 : 0;
      case "payouts":
        return u.financial?.payoutsSetup ? 1 : 0;
      case "earningsMonth":
        return u.financial?.earningsThisMonthUsd ?? 0;
      case "earningsTotal":
        return u.financial?.earningsTotalUsd ?? 0;
      case "available":
        return u.financial?.availableEarningsUsd ?? 0;
      case "created":
        // Handle both Firestore timestamps and ISO strings
        if (u.createdAt?.toDate) return u.createdAt.toDate().getTime();
        if (u.createdAt) return new Date(u.createdAt).getTime() || 0;
        return 0;
      case "lastLogin":
        // Handle both Firestore timestamps and ISO strings
        if (u.lastLogin?.toDate) return u.lastLogin.toDate().getTime();
        if (u.lastLogin) return new Date(u.lastLogin).getTime() || 0;
        return 0;
      case "totalPages":
        return u.totalPages ?? 0;
      default:
        return 0;
    }
  };

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const col = columns.find((c) => c.id === sortBy.id);
    if (!col) return filtered;
    const dir = sortBy.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = getSortValue(a, col.id);
      const vb = getSortValue(b, col.id);
      if (va === vb) return 0;
      return va > vb ? dir : -dir;
    });
  }, [filtered, sortBy, columns]);

  const handleSort = (id: string, sortable?: boolean) => {
    if (!sortable) return;
    setSortBy((prev) => {
      if (prev?.id === id) {
        return { id, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { id, dir: "asc" };
    });
  };

  const renderSubscription = (fin?: FinancialInfo) => {
    if (!fin) return <Badge variant="outline">Unknown</Badge>;
    const status = (fin.subscriptionStatus || (fin.hasSubscription ? 'active' : 'none')).toLowerCase();
    const amt = fin.subscriptionAmount ?? 0;
    const title = fin.subscriptionCancelReason || '';

    if (status === 'cancelled' || status === 'canceled') {
      return (
        <Badge
          title={title}
          variant="destructive-secondary"
        >
          Cancelled{amt ? ` • $${amt.toFixed?.(2) ?? amt}` : ''}
        </Badge>
      );
    }

    if (status === 'none' || !fin.hasSubscription) {
      return (
        <Badge
          title={title}
          variant="outline-static"
        >
          None
        </Badge>
      );
    }

    // Active/default
    return (
      <Badge
        title={title}
        variant="success-secondary"
      >
        Active{amt ? ` • $${amt.toFixed?.(2) ?? amt}` : ''}
      </Badge>
    );
  };

  const formatDateTime = (value: any) => {
    if (!value) return "—";
    const dateObj = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
    if (isNaN(dateObj.getTime())) return "—";
    return dateObj.toLocaleString();
  };

  const renderPayout = (fin?: FinancialInfo, acct?: string | null) => {
    if (fin?.payoutsSetup || acct) {
      return (
        <Badge variant="success-secondary">
          Connected
        </Badge>
      );
    }
    return (
      <Badge variant="outline-static">
        Not set up
      </Badge>
    );
  };

  const earningColor = (amt?: number) => {
    if (amt === undefined || amt === null) return "text-muted-foreground";
    if (amt >= 100) return "text-emerald-500";
    if (amt >= 10) return "text-emerald-400";
    if (amt > 0) return "text-emerald-300";
    return "text-muted-foreground";
  };

  const formatRelative = (value: any) => {
    if (!value) return { display: "—", title: "" };
    const dateObj = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
    if (isNaN(dateObj.getTime())) return { display: "—", title: "" };
    const diffMs = dateObj.getTime() - Date.now();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    return {
      display: rtf.format(diffDays, "day"),
      title: dateObj.toLocaleString()
    };
  };

  const handleDelete = async (uid: string) => {
    setStatus(null);
    setLoadingAction('delete');
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Delete failed');
      
      // Remove user from list
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      
      // Check if manual action is required (Firebase Auth user couldn't be deleted)
      if (data.manualActionRequired) {
        setStatus({ 
          type: 'warning', 
          message: `${data.message}. Firebase Auth user must be deleted manually.`,
          details: `Go to Firebase Console → Authentication → Users and delete the user with email: ${data.email || 'unknown'}`
        });
        // Open Firebase Console in new tab
        if (data.manualActionRequired.url) {
          window.open(data.manualActionRequired.url, '_blank');
        }
      } else if (data.warnings && data.warnings.length > 0) {
        setStatus({ 
          type: 'warning', 
          message: data.message,
          details: data.warnings.join('. ')
        });
      } else {
        setStatus({ type: 'success', message: data.message || 'User deleted' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Delete failed' });
    } finally {
      setLoadingAction(null);
      setDeleteUserId(null);
    }
  };

  const handleResetPassword = async (user: User) => {
    setStatus(null);
    setLoadingAction('reset');
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Reset failed');
      const msg = data.message || 'Reset link generated';
      setStatus({ type: 'success', message: `${msg} ${data.resetLink ? '(link copied to response)' : ''}` });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Reset failed' });
    } finally {
      setLoadingAction(null);
      setResetUserId(null);
    }
  };

  const handleSendEmailVerification = async (user: User) => {
    setStatus(null);
    setLoadingAction('verify');
    try {
      // Use our custom Resend verification email API
      const res = await fetch('/api/email/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: user.email, 
          userId: user.uid,
          username: user.username,
          // Admin endpoint - no idToken needed for server-side call
          idToken: 'admin-bypass'
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to send verification');
      setStatus({ type: 'success', message: 'Verification email sent via Resend' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to send verification' });
    } finally {
      setLoadingAction(null);
      setVerifyUser(null);
    }
  };

  const handleUsernameSave = async () => {
    if (!editUsernameUser) return;
    setStatus(null);
    setLoadingAction('username');
    try {
      const res = await fetch('/api/admin/users/update-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: editUsernameUser.uid, username: newUsername.trim() })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Username update failed');

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === editUsernameUser.uid ? { ...u, username: data.username } : u
        )
      );
      setStatus({ type: 'success', message: 'Username updated' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Username update failed' });
    } finally {
      setLoadingAction(null);
      setEditUsernameUser(null);
      setNewUsername('');
    }
  };

  const refreshUserNotifications = async (uid: string, filter: ActivityFilter = 'all') => {
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/admin/users/activity?uid=${uid}&filter=${filter}&limit=30`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to load activity");
      setUserActivities(data.activities || []);
    } catch (err) {
      console.error("Admin users: failed to load activity", err);
      setUserActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleSendPayoutReminder = async (user: User) => {
    setStatus(null);
    setLoadingAction("notify");
    try {
      const res = await fetch("/api/admin/users/send-payout-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          amountUsd: user.financial?.availableEarningsUsd
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to send reminder");
      setStatus({ type: "success", message: data.message || "Reminder sent" });
      await refreshUserNotifications(user.uid);
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Failed to send reminder" });
    } finally {
      setLoadingAction(null);
    }
  };

  useEffect(() => {
    if (selectedUser?.uid) {
      refreshUserNotifications(selectedUser.uid, activityFilter);
    } else {
      setUserActivities([]);
    }
  }, [selectedUser?.uid, activityFilter]);

  // Activity filter helpers
  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return userActivities;
    return userActivities.filter(a => a.type === activityFilter);
  }, [userActivities, activityFilter]);

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'subscription': return <CreditCard className="h-4 w-4" />;
      case 'payout': return <Banknote className="h-4 w-4" />;
      case 'notification': return <Bell className="h-4 w-4" />;
    }
  };

  const getActivityBadgeStyle = (type: ActivityType) => {
    switch (type) {
      case 'subscription': return 'bg-primary/15 text-primary border-primary/30';
      case 'payout': return 'bg-success/15 text-success border-success/30';
      case 'notification': return 'bg-warning/15 text-warning border-warning/30';
    }
  };

  const getStatusBadgeStyle = (status?: string) => {
    if (!status) return 'bg-neutral-10 text-foreground/60 border-neutral-20';
    switch (status) {
      case 'active':
      case 'paid':
      case 'completed':
      case 'available':
        return 'bg-success/15 text-success border-success/30';
      case 'pending':
      case 'trialing':
        return 'bg-warning/15 text-warning border-warning/30';
      case 'failed':
      case 'cancelled':
      case 'canceled':
      case 'unpaid':
      case 'past_due':
        return 'bg-error/15 text-error border-error/30';
      case 'read':
        return 'bg-neutral-10 text-foreground/60 border-neutral-20';
      case 'unread':
        return 'bg-primary/15 text-primary border-primary/30';
      default:
        return 'bg-neutral-10 text-foreground/60 border-neutral-20';
    }
  };

  return (
    <div className="p-4 pt-4 space-y-4">
      <AdminSubpageHeader
        title="Users"
        description="View user accounts and their subscription/payout setup status."
      />

      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filtered.length} of {users.length} users
          </div>
          <Input
            placeholder="Search by email or username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setShowColumnConfig((v) => !v)}>
              Columns
            </Button>
            {showColumnConfig && (
              <div className="absolute right-0 mt-2 z-50 rounded-lg border border-border/60 bg-popover p-3 shadow-lg w-56 space-y-2">
                <div className="text-sm font-medium">Visible columns</div>
                <div className="flex flex-col gap-2 max-h-72 overflow-auto">
                  {visibleColumns.map((colId) => {
                    const col = columns.find((c) => c.id === colId);
                    if (!col) return null;
                    return (
                      <div
                        key={col.id}
                        className={`flex items-center justify-between gap-2 text-xs px-2 py-1 rounded hover:bg-muted/50 ${
                          columnDragOverId === col.id ? 'ring-1 ring-primary' : ''
                        } ${columnDragId === col.id ? 'opacity-60' : ''}`}
                        draggable
                        onDragStart={() => setColumnDragId(col.id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setColumnDragOverId(col.id);
                        }}
                        onDrop={() => {
                          if (columnDragId && columnDragId !== col.id) {
                            moveColumn(columnDragId, col.id);
                          }
                          setColumnDragId(null);
                          setColumnDragOverId(null);
                        }}
                        onDragEnd={() => {
                          setColumnDragId(null);
                          setColumnDragOverId(null);
                        }}
                      >
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(col.id)}
                            onChange={() => toggleColumn(col.id)}
                          />
                          {col.label}
                        </label>
                        <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                      </div>
                    );
                  })}
                  {/* Hidden columns appear below for toggling visibility */}
                  {columns.filter(c => !visibleColumns.includes(c.id)).map((col) => (
                    <label key={col.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(col.id)}
                        onChange={() => toggleColumn(col.id)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

          {status && (
            <div className={`text-sm ${
              status.type === 'success' ? 'text-emerald-500' : 
              status.type === 'warning' ? 'text-amber-500' : 
              'text-destructive'
            }`}>
              <div>{status.message}</div>
              {status.details && (
                <div className="mt-1 text-xs opacity-80">{status.details}</div>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading users...
            </div>
          )}

          {error && (
            <Card className="border-orange-500/30 bg-orange-500/10">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="text-sm font-medium text-orange-700 dark:text-orange-400">{error}</div>
                    {errorDetails && (
                      <>
                        <pre className="text-xs bg-background/50 rounded p-2 overflow-x-auto max-h-40 text-muted-foreground border">
                          {errorDetails}
                        </pre>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(errorDetails);
                            setCopiedError(true);
                            setTimeout(() => setCopiedError(false), 2000);
                          }}
                        >
                          {copiedError ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 mr-1" />
                              Copy Error
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !error && (
            <>
              <div className="overflow-x-auto">
                <Table
                  className="hidden md:table border-separate table-auto min-w-max"
                  style={{ borderSpacing: '18px 0' }}
                >
                  <TableHeader className="sticky top-0 z-30 bg-background">
                    <TableRow className="[&>th]:px-5 [&>th]:py-3 [&>th]:align-top">
                      {activeColumns.map((col) => (
                        <TableHead
                          key={col.id}
                          className="whitespace-nowrap"
                          style={{
                            width: col.id === "user" ? "360px" : "auto",
                            minWidth: col.id === "user" ? "360px" : "150px"
                          }}
                          onClick={() => handleSort(col.id, col.sortable)}
                        >
                          <div className="flex items-center gap-2 cursor-pointer select-none">
                            {col.label}
                            {col.sortable && (
                              sortBy?.id === col.id ? (
                                sortBy.dir === "asc" ? (
                                  <ArrowUp className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <ArrowDown className="h-3 w-3 text-muted-foreground" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                              )
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&>tr>td]:px-5 [&>tr>td]:py-3 [&>tr>td]:align-top">
                    {sorted.map((u) => (
                      <TableRow
                        key={u.uid}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setSelectedUser(u)}
                      >
                        {activeColumns.map((col) => (
                          <TableCell
                            key={col.id}
                            className="whitespace-nowrap"
                            style={{
                              width: col.id === "user" ? "360px" : "auto",
                              minWidth: col.id === "user" ? "360px" : "150px"
                            }}
                          >
                            {col.render(u)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-3">
                {filtered.map((u) => (
                  <div key={u.uid} className="rounded-xl border border-border/60 p-3 space-y-2">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{u.email}</div>
                          <div className="text-xs text-muted-foreground">{u.username || "—"}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {u.createdAt?.toDate
                            ? u.createdAt.toDate().toLocaleDateString()
                            : u.createdAt || "—"}
                        </div>
                      </div>

                      <div className="flex flex-col divide-y divide-border/60 text-xs">
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Subscription</span>
                          {renderSubscription(u.financial)}
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Email verified</span>
                          {u.emailVerified ? (
                            <Badge variant="success-secondary">Verified</Badge>
                          ) : (
                            <Badge variant="destructive-secondary">Unverified</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Admin</span>
                          {u.isAdmin ? (
                            <Badge variant="success-secondary">Admin</Badge>
                          ) : (
                            <Badge variant="outline-static">Not admin</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Payouts</span>
                          {renderPayout(u.financial, u.stripeConnectedAccountId)}
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Earnings (month)</span>
                          <span className={`font-medium ${earningColor(u.financial?.earningsThisMonthUsd)}`}>
                            {u.financial?.earningsThisMonthUsd !== undefined
                              ? `$${(u.financial.earningsThisMonthUsd ?? 0).toFixed(2)}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Earnings (total)</span>
                          <span className={`font-medium ${earningColor(u.financial?.earningsTotalUsd)}`}>
                            {u.financial?.earningsTotalUsd !== undefined
                              ? `$${(u.financial.earningsTotalUsd ?? 0).toFixed(2)}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Available</span>
                          <span className="font-medium">
                            {u.financial?.availableEarningsUsd !== undefined
                              ? `$${(u.financial.availableEarningsUsd ?? 0).toFixed(2)}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Total pages</span>
                          <span className="font-medium">—</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Allocated</span>
                          <span className="font-medium">—</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Unallocated</span>
                          <span className="font-medium">—</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">PWA installed</span>
                          <span className="font-medium">—</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Notifications</span>
                          <span className="font-medium">—</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          disabled={loadingAction !== null}
                          onClick={(e) => {
                            e.stopPropagation();
                            setResetUserId(u);
                          }}
                        >
                          Reset password
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="text-xs"
                          disabled={loadingAction !== null}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteUserId(u);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
      </div>

      <Dialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This will permanently delete the user account{deleteUserId ? ` (${deleteUserId.email})` : ''}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteUserId(null)} disabled={loadingAction !== null}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUserId && handleDelete(deleteUserId.uid)}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUserId} onOpenChange={(open) => !open && setResetUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Send a password reset email and generate a reset link for this user{resetUserId ? ` (${resetUserId.email})` : ''}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetUserId(null)} disabled={loadingAction !== null}>
              Cancel
            </Button>
            <Button
              onClick={() => resetUserId && handleResetPassword(resetUserId)}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUsernameUser} onOpenChange={(open) => !open && setEditUsernameUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change username</DialogTitle>
            <DialogDescription>
              Update the username for {editUsernameUser?.email}. Please confirm to avoid accidental changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Enter new username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEditUsernameUser(null)}
              disabled={loadingAction !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUsernameSave}
              disabled={loadingAction !== null || newUsername.trim().length < 3}
            >
              {loadingAction === 'username' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!verifyUser} onOpenChange={(open) => !open && setVerifyUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send verification email</DialogTitle>
            <DialogDescription>
              Send a verification email to {verifyUser?.email}. The user must verify before payouts are allowed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setVerifyUser(null)}
              disabled={loadingAction !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() => verifyUser && handleSendEmailVerification(verifyUser)}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'verify' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send verification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User detail modal */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>User details</DialogTitle>
            <DialogDescription>
              View subscription, payout, and account metadata for {selectedUser?.email || 'user'}.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Email</div>
                  <div className="font-medium">{selectedUser.email}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Username</div>
                  <div className="font-medium">{selectedUser.username || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Admin</div>
                  {selectedUser.isAdmin ? (
                    <Badge variant="success-secondary">Admin</Badge>
                  ) : (
                    <Badge variant="outline-static">Not admin</Badge>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">Email verified</div>
                  {selectedUser.emailVerified ? (
                    <Badge variant="success-secondary">Verified</Badge>
                  ) : (
                    <Badge variant="destructive-secondary">Unverified</Badge>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">Created</div>
                  <div className="font-medium">{formatDateTime(selectedUser.createdAt)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Last login</div>
                  <div className="font-medium">{formatDateTime(selectedUser.lastLogin)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total pages</div>
                  <div className="font-medium">{selectedUser.totalPages ?? '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stripe account</div>
                  <div className="font-medium break-all">{selectedUser.stripeConnectedAccountId || '—'}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4 text-blue-400" />
                  <span className="font-medium">Subscription</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {renderSubscription(selectedUser.financial)}
                  {selectedUser.financial?.subscriptionAmount ? (
                    <span className="text-muted-foreground text-xs">
                      ${selectedUser.financial.subscriptionAmount.toFixed(2)} / mo
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="h-4 w-4 text-emerald-400" />
                  <span className="font-medium">Payouts</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {renderPayout(selectedUser.financial, selectedUser.stripeConnectedAccountId)}
                  <span className="text-muted-foreground text-xs">
                    Available: {selectedUser.financial?.availableEarningsUsd !== undefined
                      ? `$${selectedUser.financial.availableEarningsUsd.toFixed(2)}`
                      : '—'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Total: {selectedUser.financial?.earningsTotalUsd !== undefined
                      ? `$${selectedUser.financial.earningsTotalUsd.toFixed(2)}`
                      : '—'}
                  </span>
                </div>
                {(selectedUser.financial?.availableEarningsUsd ?? 0) > 0 && !(selectedUser.financial?.payoutsSetup || selectedUser.stripeConnectedAccountId) && (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={loadingAction !== null}
                      onClick={() => handleSendPayoutReminder(selectedUser)}
                    >
                      {loadingAction === "notify" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send payout reminder"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Sends a notification reminding them to add a bank for payouts.
                    </span>
                  </div>
                )}
              </div>

              {/* Unified Activity Feed */}
              <div className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Activity Feed</span>
                    {loadingActivities && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  <div className="flex gap-1">
                    {(['all', 'subscription', 'payout', 'notification'] as const).map((filter) => (
                      <Button
                        key={filter}
                        size="sm"
                        variant={activityFilter === filter ? 'secondary' : 'ghost'}
                        className="h-7 px-2 text-xs"
                        onClick={() => setActivityFilter(filter)}
                      >
                        {filter === 'all' && 'All'}
                        {filter === 'subscription' && <><CreditCard className="h-3 w-3 mr-1" />Subs</>}
                        {filter === 'payout' && <><Banknote className="h-3 w-3 mr-1" />Payouts</>}
                        {filter === 'notification' && <><Bell className="h-3 w-3 mr-1" />Notifs</>}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="max-h-80 overflow-auto">
                  {filteredActivities.length === 0 && !loadingActivities ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No activity found{activityFilter !== 'all' ? ` for ${activityFilter}` : ''}.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredActivities.map((activity) => (
                        <div key={activity.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className={`mt-0.5 p-1.5 rounded-md border ${getActivityBadgeStyle(activity.type)}`}>
                                {getActivityIcon(activity.type)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{activity.title}</span>
                                  {activity.status && (
                                    <Badge className={`text-[10px] px-1.5 py-0 h-4 ${getStatusBadgeStyle(activity.status)}`}>
                                      {activity.status}
                                    </Badge>
                                  )}
                                  {activity.amount !== undefined && (
                                    <span className="text-sm font-medium text-emerald-400">
                                      ${activity.amount.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {activity.description}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(activity.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: new Date(activity.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
