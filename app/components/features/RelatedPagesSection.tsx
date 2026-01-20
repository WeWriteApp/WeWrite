"use client";

import React, { useState, useEffect } from 'react';
import { PageLinksCard, PageLinkItem } from '../ui/PageLinksCard';
import { useRelatedPages, type RelatedPage } from '../../hooks/useRelatedPages';
import { PillLink } from '../utils/PillLink';
import { Button } from '../ui/button';
import { Icon } from '@/components/ui/Icon';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { AnimatedPresenceItem, AnimatedHorizontalPresence } from '../ui/AnimatedStack';
import { UsernameBadge } from '../ui/UsernameBadge';
import { sanitizeUsername, needsUsernameRefresh } from '../../utils/usernameSecurity';

/**
 * SECURITY: Check if a username is valid and SAFE for display
 */
function isValidUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  if (needsUsernameRefresh(username)) return false;
  const sanitized = sanitizeUsername(username);
  if (sanitized !== username.trim()) return false;
  return true;
}

interface RelatedPagesSectionProps {
  page: {
    id: string;
    title: string;
    content?: string;
    username?: string;
    userId?: string;
    isPublic?: boolean;
  };
  linkedPageIds?: string[];
}

export default function RelatedPagesSection({ page, linkedPageIds = [] }: RelatedPagesSectionProps) {
  const [mounted, setMounted] = useState(false);

  // Filter state for "Related pages by others"
  const [showFiltersRow, setShowFiltersRow] = useState(false);
  const [showAuthor, setShowAuthor] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('relatedPages_showAuthor');
      return saved !== 'false'; // Default to true
    }
    return true;
  });

  // Persist showAuthor preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('relatedPages_showAuthor', String(showAuthor));
    }
  }, [showAuthor]);

  // Use Typesense-powered search
  const {
    relatedByOthers,
    relatedByAuthor,
    authorUsername,
    loading,
    error,
  } = useRelatedPages({
    pageId: page?.id || '',
    pageTitle: page?.title,
    pageContent: typeof page?.content === 'string' ? page.content : JSON.stringify(page?.content || ''),
    authorId: page?.userId,
    authorUsername: page?.username,
    excludePageIds: linkedPageIds,
    limitByOthers: 20, // Increased limit for load more functionality
    limitByAuthor: 20,
  });

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Don't render if no results and not loading
  const hasAnyResults = relatedByOthers.length > 0 || relatedByAuthor.length > 0;
  if (!loading && !hasAnyResults) {
    return null;
  }

  // Convert related pages to PageLinkItem format (with user info for "by others")
  const relatedByOthersItems: PageLinkItem[] = relatedByOthers.map((relatedPage) => ({
    id: relatedPage.id,
    title: relatedPage.title || 'Untitled',
    username: relatedPage.username,
    userId: relatedPage.authorId,
    href: `/${relatedPage.id}`
  }));

  const relatedByAuthorItems: PageLinkItem[] = relatedByAuthor.map((relatedPage) => ({
    id: relatedPage.id,
    title: relatedPage.title || 'Untitled',
    href: `/${relatedPage.id}`
  }));

  const authorName = authorUsername || page?.username || 'this author';

  // Custom renderer for "Related pages by others" to show author with UsernameBadge
  const renderRelatedByOthersItem = (item: PageLinkItem) => (
    <div key={item.id} className="flex items-center flex-wrap">
      <PillLink
        href={item.href || `/${item.id}`}
        pageId={item.id}
        className="text-sm"
      >
        {item.title || 'Untitled'}
      </PillLink>
      <AnimatedHorizontalPresence
        show={showAuthor && !!item.userId && isValidUsername(item.username)}
        gap={4}
        preset="fast"
      >
        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
          by{' '}
          <UsernameBadge
            userId={item.userId!}
            username={item.username || 'Anonymous'}
            size="sm"
            showBadge={true}
          />
        </span>
      </AnimatedHorizontalPresence>
    </div>
  );

  // Filter button for header (only show when there are items)
  const filterButton = relatedByOthersItems.length > 0 ? (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={() => setShowFiltersRow(!showFiltersRow)}
      aria-label="Toggle filters"
    >
      <Icon name="SlidersHorizontal" size={16} className={showFiltersRow ? "text-primary" : "text-muted-foreground"} />
    </Button>
  ) : null;

  // Filter row content
  const filterRow = (
    <AnimatedPresenceItem show={showFiltersRow} gap={12} preset="fast">
      <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Label htmlFor="show-author-related" className="text-sm text-muted-foreground">
            Show author
          </Label>
        </div>
        <Switch
          id="show-author-related"
          checked={showAuthor}
          onCheckedChange={setShowAuthor}
        />
      </div>
    </AnimatedPresenceItem>
  );

  return (
    <div className="space-y-4">
      {/* Related Pages by Others */}
      <PageLinksCard
        icon="Users"
        title="Related pages by others"
        items={relatedByOthersItems}
        loading={loading}
        initialLimit={8}
        hideWhenEmpty={true}
        pillCounter={true}
        renderItem={renderRelatedByOthersItem}
        headerAction={filterButton}
        subheader={filterRow}
      />

      {/* More by Same Author */}
      <PageLinksCard
        icon="User"
        title={`More by ${authorName}`}
        items={relatedByAuthorItems}
        loading={loading}
        initialLimit={5}
        hideWhenEmpty={true}
        pillCounter={true}
      />
    </div>
  );
}
