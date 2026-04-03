'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PillLink } from '../utils/PillLink';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/button';
import type { IconName } from '../ui/Icon';

// Shared page data shape — minimal required fields with optional metadata
export interface PageItem {
  id: string;
  title: string;
  isPublic?: boolean;
  userId?: string;
  username?: string;
  lastModified?: string | number;
  createdAt?: string | number;
  groupId?: string;
  groupName?: string;
}

export type PageListView = 'wrapped' | 'list' | 'compact';

interface ViewOption {
  value: PageListView;
  icon: IconName;
  label: string;
}

const VIEW_OPTIONS: ViewOption[] = [
  { value: 'wrapped', icon: 'LayoutGrid', label: 'Pills' },
  { value: 'list', icon: 'List', label: 'List' },
  { value: 'compact', icon: 'Menu', label: 'Compact' },
];

export interface UnifiedPageListProps {
  pages: PageItem[];
  view?: PageListView;
  onViewChange?: (view: PageListView) => void;
  showViewToggle?: boolean;
  isOwned?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
  /** Render custom content after each page item (e.g. action buttons) */
  renderItemAction?: (page: PageItem) => React.ReactNode;
}

function formatDate(value: string | number | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- View: Wrapped PillLinks ---
function WrappedView({ pages, isOwned }: { pages: PageItem[]; isOwned?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2 justify-start items-start content-start">
      {pages.map((page) => (
        <div key={page.id} className="flex-none max-w-full">
          <PillLink
            href={`/${page.id}`}
            variant="primary"
            isPublic={page.isPublic}
            isOwned={isOwned}
            className="max-w-full"
          >
            {page.title || 'Untitled'}
          </PillLink>
        </div>
      ))}
    </div>
  );
}

// --- View: Detailed list with metadata ---
function ListView({
  pages,
  renderItemAction,
}: {
  pages: PageItem[];
  renderItemAction?: (page: PageItem) => React.ReactNode;
}) {
  return (
    <div className="divide-y divide-border">
      {pages.map((page) => (
        <div key={page.id} className="flex items-center justify-between py-3 px-1 group">
          <Link
            href={`/${page.id}`}
            className="flex-1 min-w-0 hover:underline"
          >
            <div className="font-medium truncate">{page.title || 'Untitled'}</div>
            <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
              {page.username && <span>by {page.username}</span>}
              {page.lastModified && <span>{formatDate(page.lastModified)}</span>}
            </div>
          </Link>
          {renderItemAction && (
            <div className="shrink-0 ml-2">
              {renderItemAction(page)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- View: Compact vertical PillLinks ---
function CompactView({ pages, isOwned }: { pages: PageItem[]; isOwned?: boolean }) {
  return (
    <div className="space-y-1">
      {pages.map((page) => (
        <div key={page.id}>
          <PillLink
            href={`/${page.id}`}
            variant="primary"
            isPublic={page.isPublic}
            isOwned={isOwned}
            className="max-w-full"
          >
            {page.title || 'Untitled'}
          </PillLink>
        </div>
      ))}
    </div>
  );
}

// --- View toggle control ---
export function PageListViewToggle({
  view,
  onViewChange,
}: {
  view: PageListView;
  onViewChange: (view: PageListView) => void;
}) {
  return (
    <div className="flex items-center border border-border rounded-lg overflow-hidden">
      {VIEW_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onViewChange(opt.value)}
          className={`p-1.5 transition-colors ${
            view === opt.value
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
          title={opt.label}
        >
          <Icon name={opt.icon} size={16} />
        </button>
      ))}
    </div>
  );
}

// --- Main component ---
export function UnifiedPageList({
  pages,
  view: controlledView,
  onViewChange,
  showViewToggle = false,
  isOwned = false,
  emptyState,
  className,
  renderItemAction,
}: UnifiedPageListProps) {
  const [internalView, setInternalView] = useState<PageListView>('wrapped');
  const view = controlledView ?? internalView;
  const setView = onViewChange ?? setInternalView;

  if (pages.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  if (pages.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No pages yet
      </div>
    );
  }

  return (
    <div className={className}>
      {showViewToggle && (
        <div className="flex justify-end mb-3">
          <PageListViewToggle view={view} onViewChange={setView} />
        </div>
      )}

      {view === 'wrapped' && <WrappedView pages={pages} isOwned={isOwned} />}
      {view === 'list' && <ListView pages={pages} renderItemAction={renderItemAction} />}
      {view === 'compact' && <CompactView pages={pages} isOwned={isOwned} />}
    </div>
  );
}
