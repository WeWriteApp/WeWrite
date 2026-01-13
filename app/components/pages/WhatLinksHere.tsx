"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageLinksCard, PageLinkItem } from '../ui/PageLinksCard';
import { BacklinkSummary } from '../../firebase/database/backlinks';
import { PillLink } from '../utils/PillLink';
import Link from 'next/link';

interface WhatLinksHereProps {
  pageId: string;
  pageTitle: string;
  className?: string;
}

/**
 * Helper to check if a username is valid for display
 * Returns false for empty, null, undefined, "anonymous", "unknown", etc.
 */
function isValidUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  const invalidUsernames = ['anonymous', 'unknown', 'undefined', 'null', ''];
  return !invalidUsernames.includes(username.toLowerCase().trim());
}

export default function WhatLinksHere({ pageId, pageTitle, className = "" }: WhatLinksHereProps) {
  const [backlinks, setBacklinks] = useState<BacklinkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Fetch backlinks function - extracted for reuse
  const fetchBacklinks = useCallback(async () => {
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
        setBacklinks(data.data.backlinks);
      } else {
        setBacklinks([]);
      }
      setError(null);
    } catch (err) {
      console.warn('Failed to fetch backlinks:', err);
      setBacklinks([]);
      setError(null); // Don't show error UI, just empty state
    } finally {
      setLoading(false);
    }
  }, [pageId, refreshCounter]);

  // Initial fetch on mount and when pageId changes
  useEffect(() => {
    fetchBacklinks();
  }, [fetchBacklinks]);

  // Listen for page save events globally - any page save could create a new backlink
  useEffect(() => {
    const handlePageSaved = () => {
      // Debounce: wait a bit for the backlink index to be updated server-side
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

  // Convert backlinks to PageLinkItem format
  const items: PageLinkItem[] = backlinks.map(backlink => ({
    id: backlink.id,
    title: backlink.title,
    username: backlink.username,
    href: `/${backlink.id}`
  }));

  // Custom renderer to show username alongside the pill
  const renderBacklinkItem = (item: PageLinkItem) => (
    <div key={item.id} className="flex items-center gap-1">
      <PillLink
        href={item.href || `/${item.id}`}
        pageId={item.id}
        className="text-sm"
      >
        {item.title || 'Untitled'}
      </PillLink>
      {isValidUsername(item.username) && (
        <Link
          href={`/users/${item.username}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {item.username}
        </Link>
      )}
    </div>
  );

  return (
    <PageLinksCard
      icon="Link2"
      title="What links here"
      items={items}
      loading={loading}
      error={error}
      initialLimit={8}
      className={className}
      renderItem={renderBacklinkItem}
      hideWhenEmpty={true}
    />
  );
}
