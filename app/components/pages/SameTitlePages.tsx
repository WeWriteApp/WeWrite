"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
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
      // Navigate to new page creation with the title as a query param
      router.push(`/new?title=${encodeURIComponent(pageTitle)}`);
    } else {
      router.push('/new');
    }
  };

  // Don't render if loading or error
  if (loading) {
    return null; // Don't show loading state to avoid layout shift
  }

  if (error) {
    return null; // Don't show on error
  }

  // Show card even when empty (with empty state)
  return (
    <div className={`wewrite-card ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name="Users" size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Others who wrote about this
          </span>
          {pages.length > 0 && (
            <span className="text-xs text-muted-foreground/60">
              ({pages.length})
            </span>
          )}
        </div>
      </div>

      {pages.length > 0 ? (
        <div className="flex flex-wrap gap-2 items-center">
          {pages.map((page) => (
            <UsernameBadge
              key={page.pageId}
              userId={page.userId}
              username={page.username || `user_${page.userId.substring(0, 6)}`}
              tier={page.subscriptionTier}
              subscriptionStatus={page.subscriptionStatus}
              subscriptionAmount={page.subscriptionAmount}
              variant="pill"
              pillVariant="secondary"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                router.push(`/${page.pageId}`);
              }}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No one else has written a page titled "{pageTitle}" yet.
        </p>
      )}

      {pages.length > 10 && (
        <div className="mt-2 text-xs text-muted-foreground">
          Showing first 10 of {pages.length} users
        </div>
      )}

      {/* Write your own button - only show for non-owners */}
      {!isOwner && (
        <div className="mt-3 pt-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleWriteYourOwn}
            className="gap-2"
          >
            <Icon name="PenLine" size={16} />
            Write your own
          </Button>
        </div>
      )}
    </div>
  );
}
