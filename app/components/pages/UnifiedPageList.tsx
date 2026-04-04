'use client';

import React, { useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { PillLink } from '../utils/PillLink';
import { Icon } from '../ui/Icon';
import EmptyState from '../ui/EmptyState';
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
  earnings?: number;
}

export type PageListView = 'wrapped' | 'list';

/** Which metadata to show alongside each pill in list view */
export type ListMetadata = 'author' | 'date' | 'earnings' | 'none';

interface ViewOption {
  value: PageListView;
  icon: IconName;
  label: string;
}

const VIEW_OPTIONS: ViewOption[] = [
  { value: 'wrapped', icon: 'LayoutGrid', label: 'Pills' },
  { value: 'list', icon: 'List', label: 'List' },
];

export interface UnifiedPageListProps {
  pages: PageItem[];
  view?: PageListView;
  onViewChange?: (view: PageListView) => void;
  showViewToggle?: boolean;
  isOwned?: boolean;
  emptyState?: React.ReactNode;
  emptyIcon?: IconName;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  /** Which metadata to display in list view */
  listMetadata?: ListMetadata;
  /** Callback when metadata selection changes */
  onListMetadataChange?: (metadata: ListMetadata) => void;
  /** Render custom content after each page item (e.g. action buttons) */
  renderItemAction?: (page: PageItem) => React.ReactNode;
}

function formatDate(value: string | number | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatEarnings(cents: number | undefined): string {
  if (cents === undefined || cents === null) return '';
  return `$${(cents / 100).toFixed(2)}`;
}

function getByline(page: PageItem, metadata: ListMetadata): string | undefined {
  switch (metadata) {
    case 'author':
      return page.username ? `by ${page.username}` : undefined;
    case 'date': {
      const d = formatDate(page.createdAt || page.lastModified);
      return d || undefined;
    }
    case 'earnings':
      return page.earnings !== undefined ? formatEarnings(page.earnings) : undefined;
    case 'none':
    default:
      return undefined;
  }
}

// --- View: Wrapped PillLinks ---
function WrappedView({ pages, isOwned }: { pages: PageItem[]; isOwned?: boolean }) {
  return (
    <div className="w-full flex flex-wrap gap-2 justify-start items-start content-start">
      {pages.map((page) => (
        <motion.div
          key={page.id}
          layout
          layoutId={page.id}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="flex-none max-w-full"
        >
          <PillLink
            href={`/${page.id}`}
            variant="primary"
            isPublic={page.isPublic}
            isOwned={isOwned}
            className="max-w-full"
          >
            {page.title || 'Untitled'}
          </PillLink>
        </motion.div>
      ))}
    </div>
  );
}

// --- View: Vertical PillLinks with optional metadata ---
function ListView({
  pages,
  isOwned,
  metadata = 'none',
  renderItemAction,
}: {
  pages: PageItem[];
  isOwned?: boolean;
  metadata?: ListMetadata;
  renderItemAction?: (page: PageItem) => React.ReactNode;
}) {
  return (
    <div className="w-full space-y-1">
      {pages.map((page) => {
        const metadataText = getByline(page, metadata);
        return (
          <motion.div
            key={page.id}
            layout
            layoutId={page.id}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="flex items-center gap-2 w-full"
          >
            <div className="min-w-0 shrink-0">
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
            {metadataText && (
              <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                {metadataText}
              </span>
            )}
            {renderItemAction && (
              <div className="shrink-0">
                {renderItemAction(page)}
              </div>
            )}
          </motion.div>
        );
      })}
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

// --- Metadata selector for list view ---
const METADATA_OPTIONS: { value: ListMetadata; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'author', label: 'Author' },
  { value: 'date', label: 'Date' },
  { value: 'earnings', label: 'Earnings' },
];

export function ListMetadataSelector({
  metadata,
  onMetadataChange,
}: {
  metadata: ListMetadata;
  onMetadataChange: (metadata: ListMetadata) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Show:</span>
      <select
        value={metadata}
        onChange={(e) => onMetadataChange(e.target.value as ListMetadata)}
        className="text-xs bg-transparent border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {METADATA_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
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
  emptyIcon = 'FileText',
  emptyTitle = 'No pages yet',
  emptyDescription,
  className,
  listMetadata: controlledListMetadata,
  onListMetadataChange,
  renderItemAction,
}: UnifiedPageListProps) {
  const [internalView, setInternalView] = useState<PageListView>('wrapped');
  const [internalMetadata, setInternalMetadata] = useState<ListMetadata>('none');
  const view = controlledView ?? internalView;
  const setView = onViewChange ?? setInternalView;
  const listMetadata = controlledListMetadata ?? internalMetadata;
  const setListMetadata = onListMetadataChange ?? setInternalMetadata;

  if (pages.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  if (pages.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        size="sm"
      />
    );
  }

  return (
    <div className={className}>
      {showViewToggle && (
        <div className="flex items-center justify-end gap-3 mb-3">
          {view === 'list' && (
            <ListMetadataSelector metadata={listMetadata} onMetadataChange={setListMetadata} />
          )}
          <PageListViewToggle view={view} onViewChange={setView} />
        </div>
      )}

      <LayoutGroup>
        {view === 'wrapped' && <WrappedView pages={pages} isOwned={isOwned} />}
        {view === 'list' && (
          <ListView
            pages={pages}
            isOwned={isOwned}
            metadata={listMetadata}
            renderItemAction={renderItemAction}
          />
        )}
      </LayoutGroup>
    </div>
  );
}
