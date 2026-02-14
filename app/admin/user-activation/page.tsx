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
import { ActivationTrends } from "../../components/admin/ActivationTrends";

// Activation milestones in order - short labels for column headers
const MILESTONE_LABELS: Record<string, string> = {
  usernameSet: 'Username',
  emailVerified: 'Email',
  pageCreated: 'Page',
  linkedOwnPage: 'Own link',
  linkedOtherPage: 'Other link',
  repliedToPage: 'Reply',
  pwaInstalled: 'PWA',
  hasSubscription: 'Subscribed',
  allocatedToWriters: 'Allocated',
  receivedEarnings: 'Earnings',
  reachedPayoutThreshold: '$25+',
  payoutsSetup: 'Payouts',
};

// Full labels for tooltips and charts
const MILESTONE_FULL_LABELS: Record<string, string> = {
  usernameSet: 'Chose a username',
  emailVerified: 'Verified email',
  pageCreated: 'Written first page',
  linkedOwnPage: 'Linked own page',
  linkedOtherPage: 'Linked another\'s page',
  repliedToPage: 'Replied to a page',
  pwaInstalled: 'Installed app',
  hasSubscription: 'Activated subscription',
  allocatedToWriters: 'Allocated to writers',
  receivedEarnings: 'Received earnings',
  reachedPayoutThreshold: 'Reached $25 threshold',
  payoutsSetup: 'Set up payouts',
};

// Detailed descriptions for tooltips
const MILESTONE_DESCRIPTIONS: Record<string, string> = {
  usernameSet: 'User has set a custom username (not auto-generated)',
  emailVerified: 'User has verified their email address',
  pageCreated: 'User has created at least one page',
  linkedOwnPage: 'User has added a link to one of their own pages in their content',
  linkedOtherPage: 'User has added a link to another user\'s page in their content',
  repliedToPage: 'User has created a reply (agree/disagree/neutral) to someone\'s page',
  pwaInstalled: 'User has installed the Progressive Web App',
  hasSubscription: 'User has an active paid subscription',
  allocatedToWriters: 'User has allocated funds to at least one writer',
  receivedEarnings: 'User has received earnings from reader allocations',
  reachedPayoutThreshold: 'User has $25 or more in available earnings, qualifying for payout',
  payoutsSetup: 'User has connected their Stripe account for receiving payouts',
};

// Colors for each milestone (matching ActivationTrends)
const MILESTONE_COLORS: Record<string, string> = {
  usernameSet: '#8b5cf6',    // violet
  emailVerified: '#a855f7',  // purple
  pageCreated: '#d946ef',    // fuchsia
  linkedOwnPage: '#ec4899',  // pink
  linkedOtherPage: '#f43f5e', // rose
  repliedToPage: '#ef4444',  // red
  pwaInstalled: '#f97316',   // orange
  hasSubscription: '#eab308', // yellow
  allocatedToWriters: '#84cc16', // lime
  receivedEarnings: '#14b8a6', // teal
  reachedPayoutThreshold: '#10b981', // emerald
  payoutsSetup: '#22c55e',   // green
};

// Icons for each milestone (Lucide icon names)
const MILESTONE_ICONS: Record<string, string> = {
  usernameSet: 'AtSign',
  emailVerified: 'MailCheck',
  pageCreated: 'FileText',
  linkedOwnPage: 'Link',
  linkedOtherPage: 'ExternalLink',
  repliedToPage: 'MessageCircle',
  pwaInstalled: 'Smartphone',
  hasSubscription: 'CreditCard',
  allocatedToWriters: 'Send',
  receivedEarnings: 'DollarSign',
  reachedPayoutThreshold: 'Award',
  payoutsSetup: 'Wallet',
};

// Define milestone hierarchy for UI grouping
const MILESTONE_HIERARCHY: Record<string, { parent?: string; children?: string[] }> = {
  pageCreated: { children: ['linkedOwnPage', 'linkedOtherPage', 'repliedToPage'] },
  linkedOwnPage: { parent: 'pageCreated' },
  linkedOtherPage: { parent: 'pageCreated' },
  repliedToPage: { parent: 'pageCreated' },
  hasSubscription: { children: ['allocatedToWriters'] },
  allocatedToWriters: { parent: 'hasSubscription' },
  receivedEarnings: { children: ['reachedPayoutThreshold', 'payoutsSetup'] },
  reachedPayoutThreshold: { parent: 'receivedEarnings' },
  payoutsSetup: { parent: 'receivedEarnings' },
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
      navigateInDrawer(`admin/users/${user.uid}`);
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

  const formatRelativeDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const diffMs = date.getTime() - Date.now();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    return rtf.format(diffDays, 'day');
  };

  return (
    <div className="p-2 md:p-4 pt-2 md:pt-4 space-y-3 md:space-y-4">
      <AdminSubpageHeader
        title="User Activation"
        description="Dense matrix view of user activation milestones from signup to engagement."
      />

      {/* Activation Trends - Pie charts with 30-day area graphs */}
      {!loading && milestones.length > 0 && users.length > 0 && (
        <ActivationTrends
          users={users}
          milestones={milestones}
          milestoneLabels={MILESTONE_FULL_LABELS}
        />
      )}

      {/* Controls */}
      <div className="flex flex-col gap-2 md:gap-3">
        <div className="text-sm text-muted-foreground">
          {filtered.length} of {users.length} users
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <Input
            placeholder="Search username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-48"
          />
          <div className="flex gap-2">
            <Select value={filterCompleted} onValueChange={(v: any) => setFilterCompleted(v)}>
              <SelectTrigger className="flex-1 sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="complete">Completed</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="flex-1 sm:w-36">
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

      {/* Per-User Breakdown */}
      {!loading && !error && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Section header */}
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">Per-User Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            {/* Header with diagonal labels */}
            <thead>
              <tr>
                {/* User column */}
                <th className="text-left p-2 font-medium text-muted-foreground sticky left-0 bg-background z-10 min-w-[140px] border-b border-border">
                  User
                </th>
                {/* Milestone columns with icon headers */}
                {milestones.map((milestone, index) => (
                  <th
                    key={milestone}
                    className={`text-center p-2 w-10 min-w-[40px] cursor-help border-b border-border ${
                      index > 0 ? 'border-l border-border' : ''
                    }`}
                    style={{
                      backgroundColor: hoveredCol === milestone ? 'var(--neutral-alpha-10)' : undefined
                    }}
                    title={`${MILESTONE_FULL_LABELS[milestone] || milestone}\n\n${MILESTONE_DESCRIPTIONS[milestone] || ''}`}
                    onMouseEnter={() => setHoveredCol(milestone)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Icon
                        name={MILESTONE_ICONS[milestone] || 'Circle'}
                        size={18}
                        style={{ color: MILESTONE_COLORS[milestone] }}
                      />
                      <span className="text-[10px] text-muted-foreground leading-tight max-w-[40px] text-center">
                        {MILESTONE_LABELS[milestone] || milestone}
                      </span>
                    </div>
                  </th>
                ))}
                {/* Created column */}
                <th className="text-center p-2 font-medium text-muted-foreground w-16 border-b border-border border-l">
                  <div className="flex flex-col items-center gap-1">
                    <Icon name="Calendar" size={18} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      Created
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const isRowHovered = hoveredRow === user.uid;
                return (
                  <tr
                    key={user.uid}
                    className="cursor-pointer"
                    style={{
                      backgroundColor: isRowHovered ? 'var(--neutral-alpha-10)' : undefined
                    }}
                    onMouseEnter={() => setHoveredRow(user.uid)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => handleUserSelect(user)}
                  >
                    {/* User info - username only */}
                    <td
                      className="p-2 sticky left-0 z-10 border-b border-border"
                      style={{
                        backgroundColor: isRowHovered ? 'var(--neutral-alpha-10)' : 'var(--background)'
                      }}
                    >
                      <span className="font-medium text-foreground truncate block max-w-[130px]">
                        {user.username || 'No username'}
                      </span>
                    </td>
                    {/* Milestone checkmarks */}
                    {milestones.map((milestone, colIndex) => {
                      const isColHovered = hoveredCol === milestone;
                      const isIntersection = isRowHovered && isColHovered;
                      return (
                        <td
                          key={milestone}
                          className={`p-1 text-center border-b border-border ${
                            colIndex > 0 ? 'border-l border-border' : ''
                          }`}
                          style={{
                            backgroundColor: isIntersection
                              ? 'var(--neutral-alpha-20)'
                              : (isRowHovered || isColHovered)
                                ? 'var(--neutral-alpha-10)'
                                : undefined
                          }}
                          title={`${MILESTONE_FULL_LABELS[milestone]}: ${user.milestones[milestone] ? 'Completed' : 'Not completed'}\n\n${MILESTONE_DESCRIPTIONS[milestone] || ''}`}
                          onMouseEnter={() => setHoveredCol(milestone)}
                          onMouseLeave={() => setHoveredCol(null)}
                        >
                          {user.milestones[milestone] ? (
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center mx-auto"
                              style={{ backgroundColor: MILESTONE_COLORS[milestone] }}
                            >
                              <Icon
                                name={MILESTONE_ICONS[milestone] || 'Check'}
                                size={14}
                                className="text-white"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center mx-auto">
                              <Icon
                                name={MILESTONE_ICONS[milestone] || 'X'}
                                size={18}
                                className="text-muted-foreground/20"
                              />
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {/* Created date */}
                    <td className="p-2 text-center text-xs text-muted-foreground border-b border-border border-l" title={user.createdAt}>
                      {formatRelativeDate(user.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

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
