"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageLinksCard, PageLinkItem } from '../ui/PageLinksCard';
import { WhatLinksHereSummary } from '../../firebase/database/whatLinksHere';
import { PillLink } from '../utils/PillLink';
import { Button } from '../ui/button';
import { Icon } from '@/components/ui/Icon';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { AnimatedPresenceItem, AnimatedHorizontalPresence } from '../ui/AnimatedStack';
import AddToPageButton from '../utils/AddToPageButton';
import type { Page } from '../../types/database';
import { UsernameBadge } from '../ui/UsernameBadge';
import { sanitizeUsername, needsUsernameRefresh } from '../../utils/usernameSecurity';

interface WhatLinksHereProps {
  pageId: string;
  pageTitle: string;
  className?: string;
  /** Whether the current user is the page owner */
  isOwner?: boolean;
  /** Page data (needed for AddToPageButton when showing empty state CTA) */
  page?: Page | null;
}

/**
 * SECURITY: Check if a username is valid and SAFE for display
 * Returns false for:
 * - Empty, null, undefined values
 * - Invalid placeholder values
 * - Email addresses or email prefixes (NEVER display these)
 */
function isValidUsername(username: string | null | undefined): boolean {
  if (!username) return false;

  // Use centralized security check
  if (needsUsernameRefresh(username)) return false;

  const sanitized = sanitizeUsername(username);
  // If sanitization changes it, it's not valid for direct display
  if (sanitized !== username.trim()) return false;

  return true;
}

export default function WhatLinksHere({ pageId, pageTitle, className = "", isOwner = false, page }: WhatLinksHereProps) {
  const [linkedPages, setLinkedPages] = useState<WhatLinksHereSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isAddToPageOpen, setIsAddToPageOpen] = useState(false);

  // Filter state
  const [showFiltersRow, setShowFiltersRow] = useState(false);
  const [showAuthor, setShowAuthor] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('whatLinksHere_showAuthor');
      return saved !== 'false'; // Default to true
    }
    return true;
  });

  // Persist showAuthor preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('whatLinksHere_showAuthor', String(showAuthor));
    }
  }, [showAuthor]);

  // Fetch pages that link to this page
  const fetchLinkedPages = useCallback(async () => {
    if (!pageId) {
      setLoading(false);
      return;
    }

    try {
      // Add cache-busting param when refreshing to bypass any HTTP caches
      const cacheBuster = refreshCounter > 0 ? `&_t=${Date.now()}` : '';
      const response = await fetch(`/api/links/backlinks?pageId=${encodeURIComponent(pageId)}&limit=50${cacheBuster}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data?.backlinks) {
        setLinkedPages(data.data.backlinks);
      } else {
        setLinkedPages([]);
      }
      setError(null);
    } catch (err) {
      console.warn('Failed to fetch what links here:', err);
      setLinkedPages([]);
      setError(null); // Don't show error UI, just empty state
    } finally {
      setLoading(false);
    }
  }, [pageId, refreshCounter]);

  // Initial fetch on mount and when pageId changes
  useEffect(() => {
    fetchLinkedPages();
  }, [fetchLinkedPages]);

  // Listen for page save events globally - any page save could create a new link to this page
  useEffect(() => {
    const handlePageSaved = () => {
      // Debounce: wait a bit for the index to be updated server-side
      setTimeout(() => {
        setRefreshCounter(prev => prev + 1);
      }, 500);
    };

    const handlePageCreated = () => {
      // New page created - could contain a link to this page
      setTimeout(() => {
        setRefreshCounter(prev => prev + 1);
      }, 500);
    };

    window.addEventListener('pageSaved', handlePageSaved);
    window.addEventListener('page-created-immediate', handlePageCreated);

    return () => {
      window.removeEventListener('pageSaved', handlePageSaved);
      window.removeEventListener('page-created-immediate', handlePageCreated);
    };
  }, []);

  // Convert linked pages to PageLinkItem format
  const items: PageLinkItem[] = linkedPages.map(linkedPage => ({
    id: linkedPage.id,
    title: linkedPage.title,
    username: linkedPage.username,
    userId: linkedPage.userId,
    href: `/${linkedPage.id}`
  }));

  // Custom renderer to show username alongside the pill
  // SECURITY: Uses UsernameBadge which safely fetches/displays usernames and subscription status
  const renderLinkedPageItem = (item: PageLinkItem) => (
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

  // Filter button for header
  const filterButton = items.length > 0 ? (
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
          <Label htmlFor="show-author-wlh" className="text-sm text-muted-foreground">
            Show author
          </Label>
        </div>
        <Switch
          id="show-author-wlh"
          checked={showAuthor}
          onCheckedChange={setShowAuthor}
        />
      </div>
    </AnimatedPresenceItem>
  );

  // For page owners, show empty state with CTA instead of hiding
  const showEmptyStateForOwner = isOwner && !loading && !error && items.length === 0;

  // Footer content - shown for owners during both loading and empty state to prevent layout shift
  // Only render the footer wrapper when we actually have content to show
  const showFooter = isOwner && page && (loading || showEmptyStateForOwner);

  const ownerFooter = showFooter ? (
    <div className="flex flex-col items-center gap-2 py-2">
      {loading ? (
        // Loading placeholder with same structure as empty state
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="Loader" size={16} />
          <span>Loading...</span>
        </div>
      ) : (
        // Empty state with CTA
        <>
          <p className="text-sm text-muted-foreground text-center">
            No pages link here yet
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsAddToPageOpen(true)}
          >
            <Icon name="Copy" size={16} />
            Add this page to another page
          </Button>
          <AddToPageButton
            page={page}
            isOpen={isAddToPageOpen}
            setIsOpen={setIsAddToPageOpen}
            hideButton={true}
          />
        </>
      )}
    </div>
  ) : null;

  // For owners, use custom loading in footer instead of PageLinksCard's default loading
  const showDefaultLoading = loading && !isOwner;

  return (
    <PageLinksCard
      icon="Link2"
      title="What links here"
      items={items}
      loading={showDefaultLoading}
      error={error}
      initialLimit={8}
      className={className}
      renderItem={renderLinkedPageItem}
      hideWhenEmpty={!isOwner}
      headerAction={filterButton}
      subheader={filterRow}
      footer={ownerFooter}
    />
  );
}
