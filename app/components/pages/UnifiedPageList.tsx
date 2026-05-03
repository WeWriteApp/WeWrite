'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PillLink } from '../utils/PillLink';
import { Icon } from '../ui/Icon';
import EmptyState from '../ui/EmptyState';
import type { IconName } from '../ui/Icon';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

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
  monthlyEarnings?: number;
  views?: number;
  viewCount?: number;
  views24h?: number;
  sponsorCount?: number;
  sponsors?: number;
  linkCount?: number;
  linksCount?: number;
  linkedPageIds?: string[];
  backlinkCount?: number;
  backlinks?: number;
  replyCount?: number;
  replies?: number;
  pageScoreFactors?: {
    backlinks?: number;
  };
}

export type PageListView = 'wrapped' | 'list';

/** Which metadata to show alongside each pill in list view */
export type ListMetadata =
  | 'none'
  | 'author'
  | 'last-edited'
  | 'created'
  | 'earnings'
  | 'views'
  | 'views-24h'
  | 'sponsors'
  | 'links'
  | 'backlinks'
  | 'replies'
  // Legacy value, treated as created date.
  | 'date';

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
  /** Render a right-aligned key/value-style value for list view rows */
  renderItemValue?: (page: PageItem) => React.ReactNode;
  /** Optional className for the right-aligned list value */
  itemValueClassName?: string;
}

const itemAnimation = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.16, ease: 'easeOut' as const },
};

const freshAuthorCache = new Map<string, string | null>();
const freshAuthorRequests = new Map<string, Promise<string | null>>();

function formatRelativeDate(value: string | number | undefined): string {
  if (!value) return '';
  const formatted = formatRelativeTime(value);
  return formatted || '';
}

function formatEarnings(cents: number | undefined): string {
  if (cents === undefined || cents === null) return '';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatNumber(value: number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  return value.toLocaleString();
}

async function getFreshAuthorUsername(userId: string): Promise<string | null> {
  if (freshAuthorCache.has(userId)) {
    return freshAuthorCache.get(userId) ?? null;
  }

  const existingRequest = freshAuthorRequests.get(userId);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetch(`/api/users/profile?id=${encodeURIComponent(userId)}&fresh=1`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const result = await response.json();
      return result?.data?.username || null;
    })
    .catch(() => null)
    .then((username) => {
      freshAuthorCache.set(userId, username);
      freshAuthorRequests.delete(userId);
      return username;
    });

  freshAuthorRequests.set(userId, request);
  return request;
}

function FreshAuthorValue({ userId, fallbackUsername }: { userId?: string; fallbackUsername?: string }) {
  const [username, setUsername] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId) {
      setUsername(fallbackUsername || null);
      return;
    }

    let cancelled = false;

    const fetchFreshUsername = async () => {
      const freshUsername = await getFreshAuthorUsername(userId);
      if (!cancelled) {
        setUsername(freshUsername);
      }
    };

    setUsername(null);
    fetchFreshUsername();

    return () => {
      cancelled = true;
    };
  }, [userId, fallbackUsername]);

  return <>{username ? `by ${username}` : '-'}</>;
}

function getListValue(page: PageItem, metadata: ListMetadata): React.ReactNode {
  switch (metadata) {
    case 'author':
      return <FreshAuthorValue userId={page.userId} fallbackUsername={page.username} />;
    case 'last-edited': {
      const d = formatRelativeDate(page.lastModified);
      return d || '-';
    }
    case 'created':
    case 'date': {
      const d = formatRelativeDate(page.createdAt || page.lastModified);
      return d || '-';
    }
    case 'earnings':
      return page.earnings !== undefined
        ? formatEarnings(page.earnings)
        : page.monthlyEarnings !== undefined
          ? formatEarnings(page.monthlyEarnings)
          : '-';
    case 'views':
      return formatNumber(page.viewCount ?? page.views) || '-';
    case 'views-24h':
      return formatNumber(page.views24h) || '-';
    case 'sponsors':
      return formatNumber(page.sponsorCount ?? page.sponsors) || '-';
    case 'links':
      return formatNumber(page.linkCount ?? page.linksCount ?? page.linkedPageIds?.length) || '-';
    case 'backlinks':
      return formatNumber(page.backlinkCount ?? page.backlinks ?? page.pageScoreFactors?.backlinks) || '-';
    case 'replies':
      return formatNumber(page.replyCount ?? page.replies) || '-';
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
          {...itemAnimation}
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
  renderItemValue,
  itemValueClassName,
}: {
  pages: PageItem[];
  isOwned?: boolean;
  metadata?: ListMetadata;
  renderItemAction?: (page: PageItem) => React.ReactNode;
  renderItemValue?: (page: PageItem) => React.ReactNode;
  itemValueClassName?: string;
}) {
  return (
    <div className="w-full space-y-1">
      {pages.map((page) => {
        const metadataValue = getListValue(page, metadata);
        const itemValue = renderItemValue?.(page);
        return (
          <motion.div
            key={page.id}
            {...itemAnimation}
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
            {(itemValue !== undefined && itemValue !== null) ? (
              <span className={`ml-auto text-xs text-muted-foreground whitespace-nowrap tabular-nums ${itemValueClassName || ''}`}>
                {itemValue}
              </span>
            ) : metadataValue !== undefined && metadataValue !== null && (
              <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                {metadataValue}
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
  { value: 'last-edited', label: 'Last edited' },
  { value: 'created', label: 'Created' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'views', label: 'Views' },
  { value: 'views-24h', label: 'Views 24h' },
  { value: 'sponsors', label: 'Sponsors' },
  { value: 'links', label: 'Links' },
  { value: 'backlinks', label: 'Backlinks' },
  { value: 'replies', label: 'Replies' },
];

function getMetadataLabel(metadata: ListMetadata): string {
  return METADATA_OPTIONS.find(option => option.value === metadata)?.label || 'Show';
}

export function ListMetadataSelector({
  metadata,
  onMetadataChange,
}: {
  metadata: ListMetadata;
  onMetadataChange: (metadata: ListMetadata) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-xs text-muted-foreground">Show:</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className="h-8 gap-2">
            <span className="truncate">{getMetadataLabel(metadata)}</span>
            <Icon name="ChevronDown" size={14} className="shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {METADATA_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onMetadataChange(opt.value)}
              className="flex items-center justify-between gap-2 cursor-pointer"
            >
              <span>{opt.label}</span>
              {metadata === opt.value && <Icon name="Check" size={14} />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
  renderItemValue,
  itemValueClassName,
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

      {view === 'wrapped' && <WrappedView pages={pages} isOwned={isOwned} />}
      {view === 'list' && (
        <ListView
          pages={pages}
          isOwned={isOwned}
          metadata={listMetadata}
          renderItemAction={renderItemAction}
          renderItemValue={renderItemValue}
          itemValueClassName={itemValueClassName}
        />
      )}
    </div>
  );
}
