"use client";

import React, { useState } from 'react';
import { Icon, IconName } from '@/components/ui/Icon';
import { PillLink } from '../utils/PillLink';
import { Button } from './button';
import { cn } from '../../lib/utils';
import Link from 'next/link';

/**
 * Unified card component for displaying lists of page links.
 * Used for: What Links Here, More by Author, Same Title, Related Pages
 *
 * Features:
 * - Consistent header with icon, title, and optional count
 * - Wrapped list layout (no accordion/collapse)
 * - "Load X more" button when list is long
 * - Loading state with Loader icon
 * - Flexible item rendering via render prop
 */

export interface PageLinkItem {
  id: string;
  title: string;
  username?: string;
  href?: string;
  // Allow any additional properties
  [key: string]: any;
}

interface PageLinksCardProps {
  /** Icon to display in header */
  icon: IconName;
  /** Title text for the header */
  title: string;
  /** Items to display */
  items: PageLinkItem[];
  /** Total count (may differ from items.length if there are more available) */
  totalCount?: number;
  /** Number of items to show initially before "Load more" */
  initialLimit?: number;
  /** Whether data is loading */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Additional className for the card */
  className?: string;
  /** Custom item renderer - defaults to PillLink */
  renderItem?: (item: PageLinkItem, index: number) => React.ReactNode;
  /** Empty state message when no items */
  emptyMessage?: string;
  /** Whether to hide the card when empty (default: true) */
  hideWhenEmpty?: boolean;
  /** Optional action button in header */
  headerAction?: React.ReactNode;
  /** Optional content between header and items (e.g., filter row) */
  subheader?: React.ReactNode;
  /** Optional footer content */
  footer?: React.ReactNode;
  /** Use pill-style counter on right instead of parentheses (matches stats card pattern) */
  pillCounter?: boolean;
}

export function PageLinksCard({
  icon,
  title,
  items,
  totalCount,
  initialLimit = 8,
  loading = false,
  error = null,
  className,
  renderItem,
  emptyMessage,
  hideWhenEmpty = true,
  headerAction,
  subheader,
  footer,
  pillCounter = false,
}: PageLinksCardProps) {
  const [showAll, setShowAll] = useState(false);

  const count = totalCount ?? items.length;
  const displayItems = showAll ? items : items.slice(0, initialLimit);
  const hasMore = items.length > initialLimit && !showAll;
  const remainingCount = items.length - initialLimit;

  // Default item renderer - uses PillLink
  const defaultRenderItem = (item: PageLinkItem) => (
    <PillLink
      key={item.id}
      href={item.href || `/${item.id}`}
      pageId={item.id}
      className="text-sm"
    >
      {item.title || 'Untitled'}
    </PillLink>
  );

  const itemRenderer = renderItem || defaultRenderItem;

  // Hide when empty (unless loading or has error)
  if (hideWhenEmpty && !loading && !error && items.length === 0) {
    return null;
  }

  return (
    <div className={cn("wewrite-card", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name={icon} size={pillCounter ? 20 : 16} className="text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          {!pillCounter && !loading && count > 0 && (
            <span className="text-xs text-muted-foreground">({count})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pillCounter && !loading && count > 0 && (
            <div
              className="text-sm font-medium px-2 py-1 rounded-md"
              style={{
                backgroundColor: 'oklch(var(--primary))',
                color: 'oklch(var(--primary-foreground))'
              }}
            >
              {count.toLocaleString()}
            </div>
          )}
          {headerAction}
        </div>
      </div>

      {/* Subheader (e.g., filter row) */}
      {subheader}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="Loader" size={16} />
          <span>Loading...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <p className="text-sm text-muted-foreground">{error}</p>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && emptyMessage && (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      )}

      {/* Items - Wrapped List */}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {displayItems.map((item, index) => itemRenderer(item, index))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowAll(true)}
            >
              Load {remainingCount} more
            </Button>
          )}
        </>
      )}

      {/* Footer */}
      {footer && (
        <div className="mt-3 pt-3 border-t border-border">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Card header component for standalone use
 * (e.g., in RepliesSection which has more complex content)
 */
interface PageLinksCardHeaderProps {
  icon: IconName;
  title: string;
  count?: number;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
  /** Use pill-style counter on right instead of parentheses (matches stats card pattern) */
  pillCounter?: boolean;
}

export function PageLinksCardHeader({
  icon,
  title,
  count,
  loading = false,
  className,
  children,
  pillCounter = false,
}: PageLinksCardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-2">
        <Icon name={icon} size={pillCounter ? 20 : 16} className="text-muted-foreground" />
        <span className="text-sm font-medium">{title}</span>
        {!pillCounter && !loading && count !== undefined && count > 0 && (
          <span className="text-xs text-muted-foreground">({count})</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {pillCounter && !loading && count !== undefined && count > 0 && (
          <div
            className="text-sm font-medium px-2 py-1 rounded-md"
            style={{
              backgroundColor: 'oklch(var(--primary))',
              color: 'oklch(var(--primary-foreground))'
            }}
          >
            {count.toLocaleString()}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export default PageLinksCard;
