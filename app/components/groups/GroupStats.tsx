'use client';

import React from 'react';
import { Icon } from '@/components/ui/Icon';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) {
    return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
  }
  if (diffMonths > 0) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  }
  if (diffDays > 0) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
  return 'today';
}

function StatItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div
      className="inline-flex items-center gap-3 px-3 py-2 rounded-xl bg-neutral-alpha-5"
      style={{ flexShrink: 0, minWidth: 'max-content' }}
    >
      {icon}
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
        <span className="text-sm font-medium whitespace-nowrap">{value}</span>
      </div>
    </div>
  );
}

export interface GroupStatsProps {
  memberCount: number;
  pageCount: number;
  createdAt?: string;
  visibility?: 'public' | 'private';
}

export default function GroupStats({
  memberCount,
  pageCount,
  createdAt,
  visibility,
}: GroupStatsProps) {
  const createdLabel = createdAt ? formatRelativeTime(createdAt) : '—';

  return (
    <div className="mt-4 overflow-hidden rounded-xl">
      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
        <StatItem
          label="Members"
          value={memberCount.toString()}
          icon={<Icon name="Users" size={18} className="text-muted-foreground flex-shrink-0" />}
        />
        <StatItem
          label="Pages"
          value={pageCount.toString()}
          icon={<Icon name="FileText" size={18} className="text-muted-foreground flex-shrink-0" />}
        />
        <StatItem
          label="Created"
          value={createdLabel}
          icon={<Icon name="Calendar" size={18} className="text-muted-foreground flex-shrink-0" />}
        />
        {visibility === 'private' && (
          <StatItem
            label="Visibility"
            value="Private"
            icon={<Icon name="Lock" size={18} className="text-muted-foreground flex-shrink-0" />}
          />
        )}
      </div>
    </div>
  );
}
