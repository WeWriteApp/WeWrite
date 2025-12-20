"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Users } from 'lucide-react';
import { UsernameChip, UsernameChipList } from '../ui/UsernameChip';
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
}

/**
 * SameTitlePages - Shows other users who wrote pages with the same title
 *
 * This component displays a list of usernames as chips, allowing users
 * to discover what others have written about the same topic.
 */
export default function SameTitlePages({
  pageId,
  pageTitle,
  className = '',
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

  // Handle clicking on a username chip to navigate to their page
  const handleChipClick = (page: SameTitlePage) => (e: React.MouseEvent) => {
    e.preventDefault();
    // Navigate to the specific page, not just the user profile
    router.push(`/${page.pageId}`);
  };

  // Don't render if loading, error, or no pages found
  if (loading) {
    return null; // Don't show loading state to avoid layout shift
  }

  if (error || pages.length === 0) {
    return null; // Don't show if no other users wrote about this topic
  }

  return (
    <div className={`wewrite-card ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Others who wrote about this
        </span>
        <span className="text-xs text-muted-foreground/60">
          ({pages.length})
        </span>
      </div>

      <UsernameChipList gap="sm">
        {pages.map((page) => (
          <UsernameChip
            key={page.pageId}
            userId={page.userId}
            username={page.username || `user_${page.userId.substring(0, 6)}`}
            variant="default"
            size="sm"
            tier={page.subscriptionTier}
            subscriptionStatus={page.subscriptionStatus}
            subscriptionAmount={page.subscriptionAmount}
            showBadge={true}
            onClick={handleChipClick(page)}
          />
        ))}
      </UsernameChipList>

      {pages.length > 10 && (
        <div className="mt-2 text-xs text-muted-foreground">
          Showing first 10 of {pages.length} users
        </div>
      )}
    </div>
  );
}
