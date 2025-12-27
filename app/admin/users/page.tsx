"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Icon } from '@/components/ui/Icon';
import { AdminSubpageHeader } from "../../components/admin/AdminSubpageHeader";
import { Card, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { adminFetch } from "../../utils/adminFetch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  SideDrawer,
  SideDrawerContent,
  SideDrawerHeader,
  SideDrawerBody,
  SideDrawerFooter,
  SideDrawerTitle,
  SideDrawerDescription,
} from "../../components/ui/side-drawer";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useMediaQuery } from "../../hooks/use-media-query";
import { useGlobalDrawer } from "../../providers/GlobalDrawerProvider";
import { UserDetailsDrawer } from "../../components/admin/UserDetailsDrawer";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import SimpleSparkline from "../../components/utils/SimpleSparkline";

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
  referredBy?: string;
  referredByUsername?: string; // Resolved username of referrer
  referralSource?: string;
  pwaInstalled?: boolean;
  notificationSparkline?: number[];
};

type Column = {
  id: string;
  label: string;
  sticky?: boolean;
  sortable?: boolean;
  minWidth?: number;
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
  // Enhanced fields for verbose display
  sourceUsername?: string;
  sourceUserId?: string;
  sourcePageId?: string;
  sourcePageTitle?: string;
  targetUsername?: string;
  targetUserId?: string;
  targetPageId?: string;
  targetPageTitle?: string;
  actionUrl?: string;
};

const COLUMN_TYPE = 'COLUMN';

// Draggable column header component
interface DraggableColumnHeaderProps {
  column: Column;
  index: number;
  moveColumn: (dragIndex: number, hoverIndex: number) => void;
  sortBy: { id: string; dir: "asc" | "desc" } | null;
  onSort: (id: string, sortable?: boolean) => void;
}

function DraggableColumnHeader({ column, index, moveColumn, sortBy, onSort }: DraggableColumnHeaderProps) {
  const ref = useRef<HTMLTableCellElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: COLUMN_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: COLUMN_TYPE,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverBoundingRect.left;

      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) return;

      moveColumn(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  return (
    <TableHead
      ref={ref}
      className="whitespace-nowrap px-3"
      style={{
        width: column.minWidth ? `${column.minWidth}px` : 'auto',
        minWidth: column.minWidth ? `${column.minWidth}px` : '100px',
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onClick={() => onSort(column.id, column.sortable)}
    >
      <div className="flex items-center gap-1 select-none">
        <span className="truncate">{column.label}</span>
        {column.sortable && (
          sortBy?.id === column.id ? (
            sortBy.dir === "asc" ? (
              <Icon name="ArrowUp" size={12} className="text-muted-foreground flex-shrink-0" />
            ) : (
              <Icon name="ArrowDown" size={12} className="text-muted-foreground flex-shrink-0" />
            )
          ) : (
            <Icon name="ArrowUpDown" size={12} className="text-muted-foreground flex-shrink-0" />
          )
        )}
      </div>
    </TableHead>
  );
}

// Upcoming notifications component - shows what automated emails will be sent to this user
function UpcomingNotifications({ user }: { user: User }) {
  const [loading, setLoading] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Array<{
    id: string;
    name: string;
    reason: string;
    eligible: boolean;
    nextSendDate?: string;
  }>>([]);

  React.useEffect(() => {
    const calculateUpcoming = () => {
      setLoading(true);
      const upcoming: typeof notifications = [];

      // 1. Email verification reminder - for unverified users
      if (!user.emailVerified) {
        upcoming.push({
          id: 'verification-reminder',
          name: 'Email Verification Reminder',
          reason: 'User has not verified their email',
          eligible: true,
          nextSendDate: 'Next cron run (daily)'
        });
      }

      // 2. Username reminder - for users with auto-generated usernames
      const hasAutoUsername = user.username?.startsWith('user_') || !user.username;
      if (hasAutoUsername) {
        upcoming.push({
          id: 'username-reminder',
          name: 'Choose Username Reminder',
          reason: 'User has auto-generated or no username',
          eligible: true,
          nextSendDate: 'Next cron run (daily)'
        });
      }

      // 3. Payout setup reminder - for users with earnings but no Stripe connected
      const hasEarnings = (user.financial?.availableEarningsUsd ?? 0) >= 25;
      const hasStripe = !!user.stripeConnectedAccountId || user.financial?.payoutsSetup;
      if (hasEarnings && !hasStripe) {
        upcoming.push({
          id: 'payout-setup-reminder',
          name: 'Payout Setup Reminder',
          reason: `Has $${(user.financial?.availableEarningsUsd ?? 0).toFixed(2)} available but no payout method`,
          eligible: true,
          nextSendDate: 'Next cron run (daily)'
        });
      }

      // 4. Reactivation email - for dormant users (not active in 30+ days)
      const lastActive = user.lastLogin;
      if (lastActive) {
        const lastActiveDate = lastActive?.toDate?.() ||
          (lastActive?._seconds ? new Date(lastActive._seconds * 1000) : new Date(lastActive));
        const daysSinceActive = Math.floor((Date.now() - lastActiveDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSinceActive >= 30) {
          upcoming.push({
            id: 'reactivation',
            name: 'Reactivation Email',
            reason: `User inactive for ${daysSinceActive} days`,
            eligible: true,
            nextSendDate: 'Next cron run (weekly)'
          });
        }
      }

      setNotifications(upcoming);
      setLoading(false);
    };

    calculateUpcoming();
  }, [user]);

  if (loading) {
    return <div className="flex items-center gap-2"><Icon name="Loader" /> Checking...</div>;
  }

  const eligibleNotifications = notifications.filter(n => n.eligible);

  return (
    <div className="space-y-3">
      {eligibleNotifications.length === 0 ? (
        <div className="text-center py-2">No upcoming automated emails for this user.</div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-medium text-foreground mb-2">Will receive:</div>
          {eligibleNotifications.map(n => (
            <div key={n.id} className="flex items-start justify-between gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
              <div className="flex-1">
                <div className="font-medium text-amber-600 dark:text-amber-400">{n.name}</div>
                <div className="text-xs text-muted-foreground">{n.reason}</div>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">{n.nextSendDate}</Badge>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// Props for when this page is rendered within a drawer
interface AdminUsersPageProps {
  /** When rendered in drawer, the subPath contains user ID after 'users/' */
  drawerSubPath?: string | null;
}

export default function AdminUsersPage({ drawerSubPath }: AdminUsersPageProps = {}) {
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
  const [toggleAdminUser, setToggleAdminUser] = useState<User | null>(null);
  const [userActivities, setUserActivities] = useState<Activity[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [loadingActivities, setLoadingActivities] = useState(false);
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

  // Mobile drawer navigation
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { navigateInDrawer, isGlobalDrawerActive } = useGlobalDrawer();

  // Parse user ID from drawer subPath (e.g., "users/abc123" -> "abc123")
  const drawerUserIdMatch = drawerSubPath?.match(/^users\/(.+)$/);
  const drawerUserId = drawerUserIdMatch?.[1] || null;

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

  // Column definitions with minimum widths to prevent collision
  const columns: Column[] = useMemo(() => [
    {
      id: "user",
      label: "Email",
      sticky: false,
      sortable: true,
      minWidth: 220,
      render: (u) => (
        <div className="font-medium whitespace-nowrap">{u.email}</div>
      )
    },
    {
      id: "username",
      label: "Username",
      sortable: true,
      minWidth: 160,
      render: (u) => (
        <span className="whitespace-nowrap font-medium">{u.username || "—"}</span>
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
      minWidth: 100,
      render: (u) => (
        u.isAdmin ? (
          <Badge variant="success-secondary">Admin</Badge>
        ) : (
          <Badge variant="outline-static">Not admin</Badge>
        )
      )
    },
    {
      id: "referredBy",
      label: "Referred by",
      sortable: true,
      minWidth: 140,
      render: (u) => {
        if (!u.referredBy) return <span className="text-muted-foreground">—</span>;
        const displayName = u.referredByUsername || u.referredBy.substring(0, 8) + '...';
        return (
          <div className="flex items-center gap-1">
            <a
              href={`/u/${u.referredByUsername || u.referredBy}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              @{displayName}
            </a>
            {u.referralSource && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {u.referralSource}
              </Badge>
            )}
          </div>
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
        return <span title={rel.title}>{rel.display}</span>;
      }
    },
    {
      id: "lastLogin",
      label: "Last login",
      sortable: true,
      minWidth: 100,
      render: (u) => {
        const rel = formatRelative(u.lastLogin);
        return <span title={rel.title}>{rel.display}</span>;
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
      minWidth: 90,
      render: () => "—" // TODO
    },
    {
      id: "unallocated",
      label: "Unallocated",
      sortable: true,
      minWidth: 100,
      render: () => "—" // TODO
    },
    {
      id: "pwa",
      label: "PWA installed",
      sortable: true,
      minWidth: 110,
      render: (u) => (
        u.pwaInstalled ? (
          <Badge variant="success-secondary">
            <Icon name="Smartphone" size={12} className="mr-1" />
            Installed
          </Badge>
        ) : (
          <Badge variant="outline-static">Not installed</Badge>
        )
      )
    },
    {
      id: "notifications",
      label: "Notifications",
      sortable: false,
      minWidth: 110,
      render: (u) => {
        // Show sparkline of last 7 days notification activity
        const sparklineData = u.notificationSparkline || Array(7).fill(0);
        const hasNotifications = sparklineData.some(v => v > 0);

        if (!hasNotifications) {
          return <span className="text-muted-foreground text-xs">None</span>;
        }

        return (
          <div className="flex items-center gap-2">
            <div className="h-8 w-20">
              <SimpleSparkline
                data={sparklineData}
                height={30}
                color="oklch(var(--primary))"
              />
            </div>
            <span className="text-xs text-muted-foreground">7d</span>
          </div>
        );
      }
    }
  ], [loadingAction]);

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

  // Move column by index (for drag-and-drop in table headers)
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

  // Map visibleColumns order to actual column definitions
  const activeColumns = visibleColumns
    .map((colId) => columns.find((c) => c.id === colId))
    .filter((c): c is Column => c !== undefined);

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
      case "referredBy":
        return u.referredBy ? 1 : 0;
      case "payouts":
        return u.financial?.payoutsSetup ? 1 : 0;
      case "pwa":
        return u.pwaInstalled ? 1 : 0;
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
    // Handle Firestore Timestamp with toDate method
    if (value?.toDate) return value.toDate().toLocaleString();
    // Handle serialized Firestore timestamp {_seconds, _nanoseconds}
    if (value?._seconds !== undefined) {
      return new Date(value._seconds * 1000).toLocaleString();
    }
    // Handle Date object
    if (value instanceof Date) return value.toLocaleString();
    // Handle ISO string or other formats
    const dateObj = new Date(value);
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

  // Calculate max earnings for progress bar scaling
  const maxEarningsMonth = useMemo(() => {
    return Math.max(1, ...users.map(u => u.financial?.earningsThisMonthUsd ?? 0));
  }, [users]);

  const maxEarningsTotal = useMemo(() => {
    return Math.max(1, ...users.map(u => u.financial?.earningsTotalUsd ?? 0));
  }, [users]);

  // Render earnings with progress bar
  const renderEarningsWithBar = (amt: number | undefined, maxAmt: number) => {
    if (amt === undefined || amt === null) {
      return <span className="text-muted-foreground">—</span>;
    }
    const percentage = maxAmt > 0 ? (amt / maxAmt) * 100 : 0;
    return (
      <div className="flex items-center gap-2 min-w-[100px]">
        <span className="font-medium text-foreground w-16 text-right">
          ${amt.toFixed(2)}
        </span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[40px]">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
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
      const res = await adminFetch('/api/admin/users/delete', {
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
      const res = await adminFetch('/api/admin/users/reset-password', {
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
      const res = await adminFetch('/api/email/send-verification', {
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
      const res = await adminFetch('/api/admin/users/update-username', {
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
      const res = await adminFetch(`/api/admin/users/activity?uid=${uid}&filter=${filter}&limit=30`);
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
      const res = await adminFetch("/api/admin/users/send-payout-reminder", {
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

  const handleToggleAdminStatus = async (user: User) => {
    setStatus(null);
    setLoadingAction('admin');
    const newAdminStatus = !user.isAdmin;
    try {
      const res = await adminFetch('/api/admin/users/admin-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, isAdmin: newAdminStatus })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to update admin status');

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid ? { ...u, isAdmin: newAdminStatus } : u
        )
      );
      setStatus({
        type: 'success',
        message: `Admin access ${newAdminStatus ? 'granted to' : 'revoked from'} ${user.email}`
      });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to update admin status' });
    } finally {
      setLoadingAction(null);
      setToggleAdminUser(null);
    }
  };

  useEffect(() => {
    if (selectedUser?.uid) {
      refreshUserNotifications(selectedUser.uid, activityFilter);
    } else {
      setUserActivities([]);
    }
  }, [selectedUser?.uid, activityFilter]);

  // When viewing in drawer with a user ID, set selectedUser from users list
  useEffect(() => {
    if (drawerUserId && users.length > 0) {
      const user = users.find(u => u.uid === drawerUserId);
      if (user) {
        setSelectedUser(user);
      }
    }
  }, [drawerUserId, users]);

  // Handler for selecting a user - uses drawer navigation on mobile, SideDrawer on desktop
  const handleUserSelect = (user: User) => {
    if (isGlobalDrawerActive && !isDesktop) {
      // On mobile in drawer: navigate to user details subpage
      navigateInDrawer(`users/${user.uid}`);
    } else {
      // On desktop: open SideDrawer
      setSelectedUser(user);
    }
  };

  // Activity filter helpers
  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return userActivities;
    return userActivities.filter(a => a.type === activityFilter);
  }, [userActivities, activityFilter]);

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'subscription': return <Icon name="CreditCard" size={16} />;
      case 'payout': return <Icon name="Banknote" size={16} />;
      case 'notification': return <Icon name="Bell" size={16} />;
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

  // Pill link component for clickable usernames and pages
  const PillLink = ({ href, children, type = 'user' }: { href: string; children: React.ReactNode; type?: 'user' | 'page' }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors hover:opacity-80 ${
        type === 'user'
          ? 'bg-primary/15 text-primary border border-primary/30'
          : 'bg-secondary/30 text-secondary-foreground border border-secondary/50'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {type === 'user' && '@'}{children}
    </a>
  );

  // Render verbose activity description with clickable pill links
  const renderActivityDescription = (activity: Activity) => {
    const notificationType = activity.metadata?.notificationType;

    // For link notifications: "@user linked to 'page' in their page 'page'"
    if (notificationType === 'link' && activity.sourceUsername && activity.targetPageTitle && activity.sourcePageTitle) {
      return (
        <span className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
          <PillLink href={`/u/${activity.sourceUsername}`} type="user">
            {activity.sourceUsername}
          </PillLink>
          <span>linked to</span>
          {activity.targetPageId ? (
            <PillLink href={`/${activity.targetPageId}`} type="page">
              {activity.targetPageTitle}
            </PillLink>
          ) : (
            <span className="font-medium">"{activity.targetPageTitle}"</span>
          )}
          <span>in their page</span>
          {activity.sourcePageId ? (
            <PillLink href={`/${activity.sourcePageId}`} type="page">
              {activity.sourcePageTitle}
            </PillLink>
          ) : (
            <span className="font-medium">"{activity.sourcePageTitle}"</span>
          )}
        </span>
      );
    }

    // For user mention notifications: "@user mentioned you in 'page'"
    if (notificationType === 'user_mention' && activity.sourceUsername && activity.sourcePageTitle) {
      return (
        <span className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
          <PillLink href={`/u/${activity.sourceUsername}`} type="user">
            {activity.sourceUsername}
          </PillLink>
          <span>mentioned this user in</span>
          {activity.sourcePageId ? (
            <PillLink href={`/${activity.sourcePageId}`} type="page">
              {activity.sourcePageTitle}
            </PillLink>
          ) : (
            <span className="font-medium">"{activity.sourcePageTitle}"</span>
          )}
        </span>
      );
    }

    // For follow notifications: look for follower username in metadata or message
    if (notificationType === 'follow' || activity.title?.includes('follower') || activity.title?.includes('followed')) {
      // Try to extract username from the message or metadata
      const followerMatch = activity.description?.match(/@(\w+)/);
      const followerUsername = followerMatch?.[1] || activity.sourceUsername || activity.metadata?.followerUsername;

      if (followerUsername) {
        return (
          <span className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
            <PillLink href={`/u/${followerUsername}`} type="user">
              {followerUsername}
            </PillLink>
            <span>started following this user</span>
          </span>
        );
      }
    }

    // For earnings with page info
    if (activity.type === 'payout' && activity.metadata?.pageId) {
      return (
        <span className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
          <span>{activity.description}</span>
          {activity.metadata.pageId && (
            <>
              <span>from</span>
              <PillLink href={`/${activity.metadata.pageId}`} type="page">
                {activity.metadata.pageTitle || 'page'}
              </PillLink>
            </>
          )}
        </span>
      );
    }

    // Default: return plain description
    return (
      <p className="text-xs text-muted-foreground mt-0.5">
        {activity.description}
      </p>
    );
  };

  // When viewing a specific user in mobile drawer mode, render only the user details
  // This creates the effect of a "nested" navigation within the drawer
  const isViewingUserDetails = drawerUserId && !isDesktop && isGlobalDrawerActive;

  if (isViewingUserDetails) {
    // Loading state while fetching users
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Icon name="Loader" className="text-muted-foreground" size={24} />
        </div>
      );
    }

    // User not found
    if (!selectedUser) {
      return (
        <div className="p-4 text-center">
          <Icon name="UserX" className="text-muted-foreground mx-auto mb-2" size={32} />
          <p className="text-muted-foreground">User not found</p>
        </div>
      );
    }

    // Render only the user details content (no header, search, or table)
    return (
      <div className="p-4 space-y-4">
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 grid-cols-2">
            <div>
              <div className="text-muted-foreground">Email</div>
              <div className="font-medium break-all">{selectedUser.email}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Username</div>
              <div className="font-medium">{selectedUser.username || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Admin</div>
              <button
                onClick={() => setToggleAdminUser(selectedUser)}
                className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity group"
                title={selectedUser.isAdmin ? "Click to remove admin" : "Click to make admin"}
              >
                {selectedUser.isAdmin ? (
                  <Badge variant="success-secondary">Admin</Badge>
                ) : (
                  <Badge variant="outline-static">Not admin</Badge>
                )}
                <Icon name="Pencil" size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            </div>
            <div>
              <div className="text-muted-foreground">Email verified</div>
              <div className="flex items-center gap-2">
                {selectedUser.emailVerified ? (
                  <Badge variant="success-secondary">Verified</Badge>
                ) : (
                  <>
                    <Badge variant="destructive-secondary">Unverified</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleSendEmailVerification(selectedUser)}
                      disabled={loadingAction === 'verify'}
                    >
                      {loadingAction === 'verify' ? (
                        <Icon name="Loader" className="mr-1" />
                      ) : null}
                      Send reminder
                    </Button>
                  </>
                )}
              </div>
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
              <div className="font-medium break-all text-xs">{selectedUser.stripeConnectedAccountId || '—'}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="CreditCard" size={16} className="text-blue-400" />
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
              <Icon name="Banknote" size={16} className="text-emerald-400" />
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
                  {loadingAction === "notify" ? <Icon name="Loader" /> : "Send payout reminder"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Sends a notification reminding them to add a bank for payouts.
                </span>
              </div>
            )}
          </div>

          {/* Upcoming Notifications Section */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon name="Bell" size={16} className="text-amber-400" />
                <span className="font-medium">Upcoming Notifications</span>
              </div>
            </div>
            <div className="p-4 text-sm text-muted-foreground">
              <UpcomingNotifications user={selectedUser} />
            </div>
          </div>

          {/* Unified Activity Feed */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon name="Filter" size={16} className="text-muted-foreground" />
                <span className="font-medium">Activity Feed</span>
                {loadingActivities && <Icon name="Loader" className="text-muted-foreground" />}
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
                    {filter === 'subscription' && <><Icon name="CreditCard" size={12} className="mr-1" />Subs</>}
                    {filter === 'payout' && <><Icon name="Banknote" size={12} className="mr-1" />Payouts</>}
                    {filter === 'notification' && <><Icon name="Bell" size={12} className="mr-1" />Notifs</>}
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
                            <div className="mt-0.5">
                              {renderActivityDescription(activity)}
                            </div>
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

        {/* Admin toggle dialog - needed for the toggle button to work */}
        <Dialog open={!!toggleAdminUser} onOpenChange={(open) => !open && setToggleAdminUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {toggleAdminUser?.isAdmin ? 'Revoke admin access' : 'Grant admin access'}
              </DialogTitle>
              <DialogDescription>
                {toggleAdminUser?.isAdmin
                  ? `Remove admin privileges from ${toggleAdminUser?.email}? They will lose access to the admin dashboard.`
                  : `Grant admin access to ${toggleAdminUser?.email}? They will be able to access the admin dashboard and manage users.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setToggleAdminUser(null)}
                disabled={loadingAction !== null}
              >
                Cancel
              </Button>
              <Button
                variant={toggleAdminUser?.isAdmin ? 'destructive' : 'default'}
                onClick={() => toggleAdminUser && handleToggleAdminStatus(toggleAdminUser)}
                disabled={loadingAction !== null}
              >
                {loadingAction === 'admin' ? (
                  <Icon name="Loader" className="mr-1" />
                ) : null}
                {toggleAdminUser?.isAdmin ? 'Revoke access' : 'Grant access'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Icon name="Columns3" size={16} className="mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Visible columns</span>
                <span className="text-xs text-muted-foreground font-normal">Drag to reorder</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-80 overflow-auto py-1">
                {/* Visible columns - draggable and in order */}
                {visibleColumns.map((colId) => {
                  const col = columns.find((c) => c.id === colId);
                  if (!col) return null;
                  return (
                    <div
                      key={col.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggedColumnId(col.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (draggedColumnId && draggedColumnId !== col.id) {
                          setDragOverColumnId(col.id);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverColumnId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (draggedColumnId && draggedColumnId !== col.id) {
                          reorderColumn(draggedColumnId, col.id);
                        }
                        setDraggedColumnId(null);
                        setDragOverColumnId(null);
                      }}
                      onDragEnd={() => {
                        setDraggedColumnId(null);
                        setDragOverColumnId(null);
                      }}
                      className={`
                        flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing
                        transition-all duration-150
                        ${draggedColumnId === col.id ? 'opacity-50 scale-95' : ''}
                        ${dragOverColumnId === col.id ? 'bg-accent/50 ring-2 ring-primary/30' : 'hover:bg-accent/50'}
                      `}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon name="GripVertical" size={14} className="text-muted-foreground flex-shrink-0" />
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => toggleColumn(col.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-sm flex-1">{col.label}</span>
                    </div>
                  );
                })}

                {/* Hidden columns section */}
                {columns.filter(c => !visibleColumns.includes(c.id)).length > 0 && (
                  <>
                    <DropdownMenuSeparator className="my-2" />
                    <div className="px-2 py-1 text-xs text-muted-foreground">Hidden columns</div>
                    {columns.filter(c => !visibleColumns.includes(c.id)).map((col) => (
                      <div
                        key={col.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-[14px]" /> {/* Spacer for alignment */}
                        <Checkbox
                          checked={false}
                          onCheckedChange={() => toggleColumn(col.id)}
                        />
                        <span className="text-sm text-muted-foreground flex-1">{col.label}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
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
              <Icon name="Loader" />
              Loading users...
            </div>
          )}

          {error && (
            <Card className="border-orange-500/30 bg-orange-500/10">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Icon name="AlertTriangle" size={20} className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
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
                              <Icon name="CheckCircle2" size={12} className="mr-1" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Icon name="Copy" size={12} className="mr-1" />
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
                  className="hidden md:table border-separate table-fixed"
                  style={{ borderSpacing: '8px 0' }}
                >
                  <TableHeader className="sticky top-0 z-30 bg-background">
                    <TableRow className="[&>th]:px-3 [&>th]:py-3 [&>th]:align-top">
                      {activeColumns.map((col, index) => (
                        <DraggableColumnHeader
                          key={col.id}
                          column={col}
                          index={index}
                          moveColumn={moveColumn}
                          sortBy={sortBy}
                          onSort={handleSort}
                        />
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&>tr>td]:px-3 [&>tr>td]:py-3 [&>tr>td]:align-top">
                    {sorted.map((u) => (
                      <TableRow
                        key={u.uid}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => handleUserSelect(u)}
                      >
                        {activeColumns.map((col) => (
                          <TableCell
                            key={col.id}
                            className="whitespace-nowrap"
                            style={{
                              width: col.minWidth ? `${col.minWidth}px` : 'auto',
                              minWidth: col.minWidth ? `${col.minWidth}px` : '80px'
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
                  <div
                    key={u.uid}
                    className="rounded-xl border border-border/60 p-3 space-y-2 cursor-pointer active:bg-muted/40 transition-colors"
                    onClick={() => handleUserSelect(u)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{u.email}</div>
                          <div className="text-xs text-muted-foreground">{u.username || "—"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(u.createdAt).split(',')[0]}
                          </div>
                          <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
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
                          {renderEarningsWithBar(u.financial?.earningsThisMonthUsd, maxEarningsMonth)}
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Earnings (total)</span>
                          {renderEarningsWithBar(u.financial?.earningsTotalUsd, maxEarningsTotal)}
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
                          {u.pwaInstalled ? (
                            <Badge variant="success-secondary">
                              <Icon name="Smartphone" size={12} className="mr-1" />
                              Installed
                            </Badge>
                          ) : (
                            <Badge variant="outline-static">Not installed</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Notifications</span>
                          <span className="font-medium">—</span>
                        </div>
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
              {loadingAction === 'delete' ? <Icon name="Loader" /> : 'Delete'}
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
              {loadingAction === 'reset' ? <Icon name="Loader" /> : 'Send reset'}
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
              {loadingAction === 'username' ? <Icon name="Loader" /> : 'Save'}
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
              {loadingAction === 'verify' ? <Icon name="Loader" /> : 'Send verification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin toggle confirmation dialog */}
      <Dialog open={!!toggleAdminUser} onOpenChange={(open) => !open && setToggleAdminUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleAdminUser?.isAdmin ? 'Revoke admin access' : 'Grant admin access'}
            </DialogTitle>
            <DialogDescription>
              {toggleAdminUser?.isAdmin
                ? `Remove admin privileges from ${toggleAdminUser?.email}? They will lose access to the admin dashboard.`
                : `Grant admin access to ${toggleAdminUser?.email}? They will be able to access the admin dashboard and manage users.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setToggleAdminUser(null)}
              disabled={loadingAction !== null}
            >
              Cancel
            </Button>
            <Button
              variant={toggleAdminUser?.isAdmin ? 'destructive' : 'default'}
              onClick={() => toggleAdminUser && handleToggleAdminStatus(toggleAdminUser)}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'admin' ? (
                <Icon name="Loader" className="mr-1" />
              ) : null}
              {toggleAdminUser?.isAdmin ? 'Revoke access' : 'Grant access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User detail side drawer - only on desktop - Using Shared Component */}
      {isDesktop && (
        <UserDetailsDrawer
          open={!!selectedUser}
          onOpenChange={(open) => !open && setSelectedUser(null)}
          userId={selectedUser?.uid}
          username={selectedUser?.username}
          onUserClick={(userId, username) => {
            const user = users.find(u => u.uid === userId || u.username === username);
            if (user) setSelectedUser(user);
          }}
        />
      )}
      </div>
    </DndProvider>
  );
}
