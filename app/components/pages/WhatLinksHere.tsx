"use client";

import React, { useState, useEffect } from 'react';
import { PageLinksCard, PageLinkItem } from '../ui/PageLinksCard';
import { BacklinkSummary, BacklinkEntry } from '../../firebase/database/backlinks';
import { PillLink } from '../utils/PillLink';
import Link from 'next/link';
import { collection, query, where, orderBy, limit as firestoreLimit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getCollectionName } from '../../utils/environmentConfig';

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

  useEffect(() => {
    if (!pageId) {
      setLoading(false);
      return;
    }

    // Set up real-time subscription to backlinks
    const backlinksQuery = query(
      collection(db, getCollectionName('backlinks')),
      where('targetPageId', '==', pageId),
      where('isPublic', '==', true),
      orderBy('lastModified', 'desc'),
      firestoreLimit(50)
    );

    const unsubscribe = onSnapshot(
      backlinksQuery,
      (snapshot) => {
        const links: BacklinkSummary[] = snapshot.docs.map(doc => {
          const data = doc.data() as BacklinkEntry;
          return {
            id: data.sourcePageId,
            title: data.sourcePageTitle,
            username: data.sourceUsername,
            lastModified: data.lastModified,
            isPublic: data.isPublic,
            linkText: data.linkText
          };
        });
        setBacklinks(links);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error in backlinks subscription:', err);
        // If the error is due to index building, we can't use real-time updates
        // Fall back to showing error state
        setError('Failed to load backlinks');
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [pageId]);

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
          @{item.username}
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
