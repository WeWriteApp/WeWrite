"use client";

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Icon } from '@/components/ui/Icon';

interface ActivationTrendsProps {
  users: Array<{
    uid: string;
    createdAt: string;
    milestones: Record<string, boolean>;
  }>;
  milestones: string[];
  milestoneLabels: Record<string, string>;
}

interface MilestoneStat {
  milestone: string;
  label: string;
  count: number;
  percent: number;
  color: string;
  icon: string;
}

// Colors for each milestone (matching a nice gradient palette)
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

export function ActivationTrends({ users, milestones, milestoneLabels }: ActivationTrendsProps) {
  // Calculate current percentages and 30-day trend data
  const { currentStats, trendData } = useMemo(() => {
    if (!users.length || !milestones.length) {
      return { currentStats: [], trendData: [] };
    }

    const total = users.length;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate current percentages for each milestone
    const currentStats = milestones.map(milestone => {
      const count = users.filter(u => u.milestones[milestone]).length;
      const percent = Math.round((count / total) * 100);
      return {
        milestone,
        label: milestoneLabels[milestone] || milestone,
        count,
        percent,
        color: MILESTONE_COLORS[milestone] || '#6366f1',
        icon: MILESTONE_ICONS[milestone] || 'Circle',
      };
    });

    // Generate daily data points for the last 30 days
    // We'll calculate cumulative percentages based on users who signed up by each date
    const dailyData: Array<{
      date: string;
      displayDate: string;
      totalUsers: number;
      [key: string]: number | string;
    }> = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Get users who signed up on or before this date
      const usersToDate = users.filter(u => {
        if (!u.createdAt) return true; // Include users without date
        const userDate = new Date(u.createdAt);
        return userDate <= date;
      });

      const totalToDate = usersToDate.length;
      if (totalToDate === 0) continue;

      const dayData: Record<string, number | string> = {
        date: dateStr,
        displayDate,
        totalUsers: totalToDate,
      };

      // Calculate percentage for each milestone based on users to that date
      for (const milestone of milestones) {
        const completedCount = usersToDate.filter(u => u.milestones[milestone]).length;
        dayData[milestone] = Math.round((completedCount / totalToDate) * 100);
      }

      dailyData.push(dayData as any);
    }

    return { currentStats, trendData: dailyData };
  }, [users, milestones, milestoneLabels]);

  if (currentStats.length === 0) {
    return null;
  }

  // Get stats map for quick lookup
  const statsMap = new Map(currentStats.map(s => [s.milestone, s]));

  // Build ordered list of rows with hierarchy info
  // Child percentages are calculated relative to their parent
  type RowData = MilestoneStat & {
    isChild: boolean;
    displayPercent: number;  // Percentage to display (relative to parent for children)
    parentCount?: number;    // Parent's count for context
  };
  const orderedRows: RowData[] = [];
  const renderedMilestones = new Set<string>();

  for (const milestone of milestones) {
    if (renderedMilestones.has(milestone)) continue;

    const stat = statsMap.get(milestone);
    if (!stat) continue;

    const hierarchy = MILESTONE_HIERARCHY[milestone];

    // Skip child milestones - they're rendered after their parent
    if (hierarchy?.parent) continue;

    // Add this milestone (parent or standalone)
    orderedRows.push({ ...stat, isChild: false, displayPercent: stat.percent });
    renderedMilestones.add(milestone);

    // If it has children, add them indented with percentage relative to parent
    if (hierarchy?.children) {
      const parentCount = stat.count;
      for (const childMilestone of hierarchy.children) {
        const childStat = statsMap.get(childMilestone);
        if (childStat) {
          // Calculate percentage relative to parent (e.g., % of page creators who linked own page)
          const relativePercent = parentCount > 0
            ? Math.round((childStat.count / parentCount) * 100)
            : 0;
          orderedRows.push({
            ...childStat,
            isChild: true,
            displayPercent: relativePercent,
            parentCount
          });
          renderedMilestones.add(childMilestone);
        }
      }
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Section header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">Activation Aggregates</h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Milestone
            </th>
            <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
              Rate
            </th>
            <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
              Users
            </th>
            <th className="p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">
              {/* Pie chart column - no header */}
            </th>
            <th className="p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[100px]">
              Trend
            </th>
          </tr>
        </thead>
        <tbody>
          {orderedRows.map((row) => (
            <tr
              key={row.milestone}
              className={`border-b border-border last:border-b-0 transition-colors ${
                row.isChild ? 'bg-muted/10' : ''
              }`}
              style={{ ['--hover-bg' as string]: 'var(--neutral-alpha-10)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--neutral-alpha-10)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = row.isChild ? 'hsl(var(--muted) / 0.1)' : ''}
            >
              {/* Milestone name with icon */}
              <td className="p-3">
                <div className={`flex items-center gap-3 ${row.isChild ? 'pl-6' : ''}`}>
                  <div
                    className={`flex items-center justify-center flex-shrink-0 rounded ${
                      row.isChild ? 'w-6 h-6' : 'w-8 h-8'
                    }`}
                    style={{ backgroundColor: row.color }}
                  >
                    <Icon
                      name={row.icon}
                      size={row.isChild ? 12 : 16}
                      className="text-white"
                    />
                  </div>
                  <span className={`font-medium text-foreground ${row.isChild ? 'text-sm' : ''}`}>
                    {row.label}
                  </span>
                </div>
              </td>

              {/* Percentage */}
              <td className="p-3 text-right">
                <span
                  className={`font-bold ${row.isChild ? 'text-base' : 'text-lg'}`}
                  style={{ color: row.color }}
                >
                  {row.displayPercent}%
                </span>
              </td>

              {/* User count */}
              <td className="p-3 text-right text-sm text-muted-foreground">
                {row.count.toLocaleString()}
              </td>

              {/* Mini pie chart */}
              <td className="p-2">
                <div className={`mx-auto ${row.isChild ? 'w-8 h-8' : 'w-10 h-10'}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'completed', value: row.displayPercent },
                          { name: 'remaining', value: 100 - row.displayPercent },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={row.isChild ? 6 : 10}
                        outerRadius={row.isChild ? 14 : 18}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        startAngle={90}
                        endAngle={-270}
                      >
                        <Cell fill={row.color} />
                        <Cell fill="hsl(var(--muted))" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </td>

              {/* Area chart trend */}
              <td className="p-2">
                <div className={`${row.isChild ? 'h-6' : 'h-8'}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={trendData}
                      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id={`gradient-${row.milestone}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={row.color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={row.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey={row.milestone}
                        stroke={row.color}
                        strokeWidth={1.5}
                        fill={`url(#gradient-${row.milestone})`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => [`${value}%`, row.label]}
                        labelFormatter={(label) => {
                          const item = trendData.find(d => d.date === label);
                          return item?.displayDate || label;
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
