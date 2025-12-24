"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PageLinksCard, PageLinkItem } from '../ui/PageLinksCard';
import { UsernameBadge } from '../ui/UsernameBadge';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';

interface SameTitlePage {
  pageId: string;
  title: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  subscriptionAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

interface SameTitlePagesProps {
  pageId: string;
  pageTitle?: string;
  className?: string;
  isOwner?: boolean;
}

/**
 * SameTitlePages - Shows other users who wrote pages with the same title
 *
 * This component displays a list of usernames as pill badges, allowing users
 * to discover what others have written about the same topic.
 * Includes a "Write your own" button for non-owners to create their take on the topic.
 */
export default function SameTitlePages({
  pageId,
  pageTitle,
  className = '',
  isOwner = false,
}: SameTitlePagesProps) {
  const router = useRouter();
  const [pages, setPages] = useState<SameTitlePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSameTitlePages = useCallback(async () => {
    if (!pageId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/pages/${pageId}/same-title`);

      if (!response.ok) {
        throw new Error('Failed to fetch pages');
      }

      const data = await response.json();

      if (data.success && data.data?.sameTitlePages) {
        setPages(data.data.sameTitlePages);
      } else {
        setPages([]);
      }
    } catch (err) {
      console.error('Error fetching same-title pages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    fetchSameTitlePages();
  }, [fetchSameTitlePages]);

  // Handle "Write your own" click - navigate to new page with pre-filled title
  const handleWriteYourOwn = () => {
    if (pageTitle) {
      router.push(`/new?title=${encodeURIComponent(pageTitle)}`);
    } else {
      router.push('/new');
    }
  };

  // If owner and no other users have written about this topic, hide completely
  if (isOwner && !loading && pages.length === 0) {
    return null;
  }

  // Convert to PageLinkItem format with extra data for custom rendering
  const items: PageLinkItem[] = pages.map((page) => ({
    id: page.pageId,
    title: page.username || `user_${page.userId.substring(0, 6)}`,
    userId: page.userId,
    username: page.username,
    subscriptionTier: page.subscriptionTier,
    subscriptionStatus: page.subscriptionStatus,
    subscriptionAmount: page.subscriptionAmount,
    href: `/${page.pageId}`
  }));

  // Custom renderer for UsernameBadge
  const renderUserBadge = (item: PageLinkItem) => (
    <UsernameBadge
      key={item.id}
      userId={item.userId}
      username={item.username || `user_${item.userId?.substring(0, 6)}`}
      tier={item.subscriptionTier}
      subscriptionStatus={item.subscriptionStatus}
      subscriptionAmount={item.subscriptionAmount}
      variant="pill"
      pillVariant="secondary"
      size="sm"
      onClick={(e) => {
        e.preventDefault();
        router.push(`/${item.id}`);
      }}
    />
  );

  // Footer with "Write your own" button
  const footerContent = !isOwner ? (
    <Button
      variant="outline"
      size="sm"
      onClick={handleWriteYourOwn}
      className="gap-2"
    >
      <Icon name="PenLine" size={16} />
      Write your own
    </Button>
  ) : undefined;

  return (
    <PageLinksCard
      icon="Users"
      title="Others who wrote about this"
      items={items}
      loading={loading}
      error={error}
      initialLimit={10}
      className={className}
      renderItem={renderUserBadge}
      emptyMessage={`No one else has written a page titled "${pageTitle}" yet.`}
      hideWhenEmpty={isOwner} // Hide when empty only for owners
      footer={footerContent}
    />
  );
}
