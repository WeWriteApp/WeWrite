"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Icon } from '@/components/ui/Icon';
import { AdminSubpageHeader } from "../../components/admin/AdminSubpageHeader";
import { useGlobalDrawer } from "../../providers/GlobalDrawerProvider";
import { useMediaQuery } from "../../hooks/use-media-query";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { adminFetch } from "../../utils/adminFetch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { UserDetailsDrawer } from "../../components/admin/UserDetailsDrawer";

// Activation milestones in order - short labels for column headers
const MILESTONE_LABELS: Record<string, string> = {
  accountCreated: 'Account',
  usernameSet: 'Username',
  emailVerified: 'Email',
  pageCreated: 'Page',
  linkedOwnPage: 'Own Link',
  linkedOtherPage: 'Other Link',
  repliedToPage: 'Reply',
  pwaInstalled: 'PWA',
  hasSubscription: 'Subscriber',
  payoutsSetup: 'Payouts',
};

// Full labels for tooltips
const MILESTONE_FULL_LABELS: Record<string, string> = {
  accountCreated: 'Account Created',
  usernameSet: 'Username Set',
  emailVerified: 'Email Verified',
  pageCreated: 'Page Created',
  linkedOwnPage: 'Linked to Own Page',
  linkedOtherPage: 'Linked to Another User\'s Page',
  repliedToPage: 'Replied to a Page',
  pwaInstalled: 'PWA Installed',
  hasSubscription: 'Active Subscription',
  payoutsSetup: 'Payouts Setup',
};

// Detailed descriptions for tooltips
const MILESTONE_DESCRIPTIONS: Record<string, string> = {
  accountCreated: 'User has created an account on the platform',
  usernameSet: 'User has set a custom username (not auto-generated)',
  emailVerified: 'User has verified their email address',
  pageCreated: 'User has created at least one page',
  linkedOwnPage: 'User has added a link to one of their own pages in their content',
  linkedOtherPage: 'User has added a link to another user\'s page in their content',
  repliedToPage: 'User has created a reply (agree/disagree/neutral) to someone\'s page',
  pwaInstalled: 'User has installed the Progressive Web App',
  hasSubscription: 'User has an active paid subscription',
  payoutsSetup: 'User has connected their Stripe account for receiving payouts',
};

type UserActivationData = {
  uid: string;
  email: string;
  username?: string;
  createdAt: string;
  milestones: Record<string, boolean>;
  completedCount: number;
};

export default function UserActivationPage() {
  const [users, setUsers] = useState<UserActivationData[]>([]);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<'createdAt' | 'completedCount'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterCompleted, setFilterCompleted] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // For drawer navigation
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { navigateInDrawer, isGlobalDrawerActive } = useGlobalDrawer();

  // Handler for selecting a user - uses drawer navigation on mobile, SideDrawer on desktop
  const handleUserSelect = (user: UserActivationData) => {
    if (isGlobalDrawerActive && !isDesktop) {
      // On mobile in drawer: navigate to user details subpage
      navigateInDrawer(`users/${user.uid}`);
    } else {
      // On desktop: open SideDrawer
      setSelectedUserId(user.uid);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminFetch(`/api/admin/user-activation?limit=500&sortBy=${sortBy}&sortDir=${sortDir}`);
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error || `HTTP ${res.status}`);
          return;
        }
        setUsers(data.users || []);
        setMilestones(data.milestones || []);
      } catch (err: any) {
        setError(err.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sortBy, sortDir]);

  // Filter users
  const filtered = useMemo(() => {
    let result = users;

    // Search filter (username only)
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter((u) => {
        return u.username?.toLowerCase().includes(term);
      });
    }

    // Completion filter
    if (filterCompleted === 'complete') {
      result = result.filter(u => u.completedCount === milestones.length);
    } else if (filterCompleted === 'incomplete') {
      result = result.filter(u => u.completedCount < milestones.length);
    }

    return result;
  }, [users, search, filterCompleted, milestones.length]);

  // Calculate funnel stats
  const funnelStats = useMemo(() => {
    const stats: Record<string, { count: number; percent: number }> = {};
    const total = users.length;

    for (const milestone of milestones) {
      const count = users.filter(u => u.milestones[milestone]).length;
      stats[milestone] = {
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    }

    return stats;
  }, [users, milestones]);

  const formatRelativeDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const diffMs = date.getTime() - Date.now();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    return rtf.format(diffDays, 'day');
  };

  return (
    <div className="p-4 pt-4 space-y-4">
      <AdminSubpageHeader
        title="User Activation"
        description="Dense matrix view of user activation milestones from signup to engagement."
      />

      {/* Funnel Summary */}
      {!loading && milestones.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center justify-center">
              {milestones.map((milestone, index) => (
                <React.Fragment key={milestone}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">
                      {funnelStats[milestone]?.percent ?? 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {MILESTONE_LABELS[milestone] || milestone}
                    </div>
                    <div className="text-xs text-muted-foreground/60">
                      ({funnelStats[milestone]?.count ?? 0})
                    </div>
                  </div>
                  {index < milestones.length - 1 && (
                    <Icon name="ChevronRight" size={20} className="text-muted-foreground/40" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {filtered.length} of {users.length} users
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Select value={filterCompleted} onValueChange={(v: any) => setFilterCompleted(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="complete">Completed</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Sort by Date</SelectItem>
              <SelectItem value="completedCount">Sort by Progress</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          >
            {sortDir === 'asc' ? (
              <Icon name="ArrowUp" size={16} />
            ) : (
              <Icon name="ArrowDown" size={16} />
            )}
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Icon name="Loader" />
          Loading activation data...
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <Icon name="AlertTriangle" size={16} />
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dense Matrix Table */}
      {!loading && !error && (
        <div className="overflow-x-auto border border-border rounded-lg bg-card">
          <table className="w-full text-sm">
            {/* Header with diagonal labels */}
            <thead>
              <tr className="border-b border-border">
                {/* User column */}
                <th className="text-left p-2 font-medium text-muted-foreground sticky left-0 bg-card z-10 min-w-[140px]">
                  User
                </th>
                {/* Milestone columns with diagonal headers */}
                {milestones.map((milestone) => (
                  <th
                    key={milestone}
                    className={`text-center p-0 w-8 min-w-[32px] transition-colors cursor-help ${
                      hoveredCol === milestone ? 'bg-muted/50' : ''
                    }`}
                    title={`${MILESTONE_FULL_LABELS[milestone] || milestone}\n\n${MILESTONE_DESCRIPTIONS[milestone] || ''}`}
                    onMouseEnter={() => setHoveredCol(milestone)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    <div className="h-20 relative">
                      <span
                        className={`absolute bottom-1 left-1/2 text-xs whitespace-nowrap origin-bottom-left transition-colors ${
                          hoveredCol === milestone ? 'text-foreground font-medium' : 'text-muted-foreground'
                        }`}
                        style={{
                          transform: 'rotate(-45deg) translateX(-50%)',
                        }}
                      >
                        {MILESTONE_LABELS[milestone] || milestone}
                      </span>
                    </div>
                  </th>
                ))}
                {/* Created column */}
                <th className="text-center p-2 font-medium text-muted-foreground w-20">
                  <div className="h-20 flex items-end justify-center pb-1">
                    <span
                      className="text-xs whitespace-nowrap origin-bottom-left"
                      style={{
                        transform: 'rotate(-45deg) translateX(-50%)',
                        display: 'inline-block',
                      }}
                    >
                      Created
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.uid}
                  className={`border-b border-border/50 transition-colors cursor-pointer ${
                    hoveredRow === user.uid ? 'bg-muted/40' : 'hover:bg-muted/30'
                  }`}
                  onMouseEnter={() => setHoveredRow(user.uid)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => handleUserSelect(user)}
                >
                  {/* User info - username only */}
                  <td className="p-2 sticky left-0 bg-card z-10">
                    <span className="font-medium text-foreground truncate block max-w-[130px]">
                      {user.username || 'No username'}
                    </span>
                  </td>
                  {/* Milestone checkmarks */}
                  {milestones.map((milestone) => {
                    const isHighlighted = hoveredRow === user.uid || hoveredCol === milestone;
                    const isIntersection = hoveredRow === user.uid && hoveredCol === milestone;
                    return (
                      <td
                        key={milestone}
                        className={`p-1 text-center transition-colors ${
                          isIntersection
                            ? 'bg-primary/20'
                            : isHighlighted
                              ? 'bg-muted/50'
                              : ''
                        }`}
                        title={`${MILESTONE_FULL_LABELS[milestone]}: ${user.milestones[milestone] ? 'Completed' : 'Not completed'}\n\n${MILESTONE_DESCRIPTIONS[milestone] || ''}`}
                        onMouseEnter={() => setHoveredCol(milestone)}
                        onMouseLeave={() => setHoveredCol(null)}
                      >
                        {user.milestones[milestone] ? (
                          <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center mx-auto">
                            <Icon
                              name="Check"
                              size={14}
                              className="text-white"
                            />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded bg-muted/40 flex items-center justify-center mx-auto">
                            <Icon
                              name="X"
                              size={12}
                              className="text-muted-foreground/40"
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {/* Created date */}
                  <td className="p-2 text-center text-xs text-muted-foreground" title={user.createdAt}>
                    {formatRelativeDate(user.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              {search || filterCompleted !== 'all' ? 'No users match your filters.' : 'No users found.'}
            </div>
          )}
        </div>
      )}

      {/* User detail side drawer - only on desktop */}
      {isDesktop && (
        <UserDetailsDrawer
          open={!!selectedUserId}
          onOpenChange={(open) => !open && setSelectedUserId(null)}
          userId={selectedUserId ?? undefined}
          username={users.find(u => u.uid === selectedUserId)?.username}
          onUserClick={(userId) => {
            setSelectedUserId(userId);
          }}
        />
      )}
    </div>
  );
}
