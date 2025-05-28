'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { RandomPagesSkeleton } from '../ui/skeleton-loaders';
import { SectionTitle } from '../ui/section-title';
import { Button } from '../ui/button';
import { Shuffle } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import RandomPagesTable from '../pages/RandomPagesTable';

interface RandomPage {
  id: string;
  title: string;
  userId: string;
  username: string;
  lastModified: string;
  createdAt: string;
  isPublic: boolean;
  groupId?: string;
  groupName?: string;
  groupIsPublic?: boolean;
}

interface RandomPagesOptimizedProps {
  limit?: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Optimized RandomPages component that fetches and displays random pages
 * with shuffle functionality and responsive table/card layout
 */
const RandomPagesOptimized = React.memo(function RandomPagesOptimized({
  limit = 10,
  priority = 'low'
}: RandomPagesOptimizedProps) {
  const { user } = useAuth();
  const [randomPages, setRandomPages] = useState<RandomPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [shuffling, setShuffling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includePrivatePages, setIncludePrivatePages] = useState(false);

  console.log('RandomPagesOptimized: Rendering with props:', { limit, priority });

  // Load privacy preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPreference = localStorage.getItem('randomPages_includePrivate');
      if (savedPreference === 'true') {
        setIncludePrivatePages(true);
      }
    }
  }, []);

  // Fetch random pages from API
  const fetchRandomPages = useCallback(async (isShuffling = false, includePrivate = includePrivatePages) => {
    try {
      if (isShuffling) {
        setShuffling(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams({
        limit: limit.toString(),
      });

      // Add user ID for access control if user is authenticated
      if (user?.uid) {
        params.append('userId', user.uid);
      }

      // Add privacy preference
      if (includePrivate) {
        params.append('includePrivate', 'true');
      }

      const response = await fetch(`/api/random-pages?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setRandomPages(data.randomPages || []);
      console.log(`RandomPages: Fetched ${data.randomPages?.length || 0} random pages`);

    } catch (err) {
      console.error('Error fetching random pages:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch random pages');
      setRandomPages([]);
    } finally {
      setLoading(false);
      setShuffling(false);
    }
  }, [limit, user?.uid]);

  // Handle shuffle button click
  const handleShuffle = useCallback((includePrivate = includePrivatePages) => {
    console.log('RandomPages: Shuffle button clicked', { includePrivate });
    fetchRandomPages(true, includePrivate);
  }, [fetchRandomPages, includePrivatePages]);

  // Initial fetch on component mount
  useEffect(() => {
    fetchRandomPages();
  }, [fetchRandomPages]);

  // Listen for shuffle events from sticky header
  useEffect(() => {
    const handleShuffleEvent = (event: CustomEvent) => {
      const includePrivate = event.detail?.includePrivate ?? includePrivatePages;
      console.log('RandomPages: Shuffle event received', { includePrivate });

      // Update local state if privacy setting changed
      if (includePrivate !== includePrivatePages) {
        setIncludePrivatePages(includePrivate);
      }

      handleShuffle(includePrivate);
    };

    window.addEventListener('shuffleRandomPages', handleShuffleEvent as EventListener);
    return () => {
      window.removeEventListener('shuffleRandomPages', handleShuffleEvent as EventListener);
    };
  }, [handleShuffle, includePrivatePages]);

  // Show loading skeleton on initial load
  if (loading && !shuffling) {
    return <RandomPagesSkeleton limit={limit} />;
  }

  // Show error state
  if (error && !shuffling) {
    return (
      <div className="space-y-4">
        <div className="border border-theme-medium rounded-2xl p-8 text-center">
          <p className="text-muted-foreground mb-4">Failed to load random pages</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button
            variant="outline"
            onClick={() => fetchRandomPages()}
            className="rounded-2xl"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Show empty state
  if (!loading && !shuffling && randomPages.length === 0) {
    return (
      <div className="space-y-4">
        <div className="border border-theme-medium rounded-2xl p-8 text-center">
          <p className="text-muted-foreground">No pages available to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Suspense fallback={<RandomPagesSkeleton limit={limit} />}>
        <RandomPagesTable
          pages={randomPages}
          loading={shuffling}
        />
      </Suspense>
    </div>
  );
});

export default RandomPagesOptimized;
