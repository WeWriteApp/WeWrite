'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { RandomPagesSkeleton } from '../ui/skeleton-loaders';
import { SectionTitle } from '../ui/section-title';
import { Button } from '../ui/button';
import { Shuffle } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import RandomPagesTable from '../pages/RandomPagesTable';
import { wewriteCard } from '../../lib/utils';

interface RandomPage {
  id: string;
  title: string;
  userId: string;
  username: string;
  lastModified: string;
  createdAt: string;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
  // Groups functionality removed
  // Note: isPublic removed - all pages are now public
}

interface RandomPagesProps {
  limit?: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * RandomPages component that fetches and displays random pages
 * with shuffle functionality and responsive table/card layout
 */
const RandomPages = React.memo(function RandomPages({
  limit = 10,
  priority = 'low'
}: RandomPagesProps) {
  const { user } = useAuth();
  const [randomPages, setRandomPages] = useState<RandomPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [shuffling, setShuffling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [denseMode, setDenseMode] = useState(false);
  const [excludeOwnPages, setExcludeOwnPages] = useState(false);

  console.log('RandomPages: Rendering with props:', { limit, priority });

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {


      const savedDenseModePreference = localStorage.getItem('randomPages_denseMode');
      if (savedDenseModePreference === 'true') {
        setDenseMode(true);
      }

      const savedExcludeOwnPreference = localStorage.getItem('randomPages_excludeOwnPages');
      if (savedExcludeOwnPreference === 'true') {
        setExcludeOwnPages(true);
      }
    }
  }, []);

  // Fetch random pages from API with throttling
  const fetchRandomPages = useCallback(async (isShuffling = false, excludeOwn = excludeOwnPages) => {
    try {
      // Prevent excessive API calls - throttle to max once per 2 seconds
      const now = Date.now();
      const lastFetchKey = `randomPages_${user?.uid || 'anonymous'}`;
      const lastFetch = parseInt(localStorage.getItem(lastFetchKey) || '0');

      if (!isShuffling && (now - lastFetch) < 2000) {
        console.log('RandomPages: Throttling API call, too recent');
        return;
      }

      localStorage.setItem(lastFetchKey, now.toString());

      if (isShuffling) {
        setShuffling(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Use higher limit for dense mode to show more results
      const effectiveLimit = denseMode ? Math.max(limit * 2, 20) : limit;

      const params = new URLSearchParams({
        limit: effectiveLimit.toString()});

      // Add user ID for access control if user is authenticated
      if (user?.uid) {
        params.append('userId', user.uid);
      }

      // Add "Not mine" filter preference
      if (excludeOwn) {
        params.append('excludeOwnPages', 'true');
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

      // Enhanced error handling with specific messages
      let errorMessage = 'Failed to fetch random pages';
      if (err instanceof Error) {
        if (err.message.includes('500')) {
          errorMessage = 'Server error - please try again';
        } else if (err.message.includes('permission')) {
          errorMessage = 'Permission error - please refresh the page';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setRandomPages([]);
    } finally {
      setLoading(false);
      setShuffling(false);
    }
  }, [limit, user?.uid, denseMode, excludeOwnPages]);

  // Handle shuffle button click
  const handleShuffle = useCallback((excludeOwn = excludeOwnPages) => {
    console.log('RandomPages: Shuffle button clicked', { excludeOwn });
    fetchRandomPages(true, excludeOwn);
  }, [fetchRandomPages, excludeOwnPages]);

  // Initial fetch on component mount
  useEffect(() => {
    fetchRandomPages();
  }, [fetchRandomPages]);

  // Listen for shuffle events from sticky header
  useEffect(() => {
    const handleShuffleEvent = (event: CustomEvent) => {
      const excludeOwn = event.detail?.excludeOwnPages ?? excludeOwnPages;
      console.log('RandomPages: Shuffle event received', { excludeOwn });

      // Update local state if settings changed
      if (excludeOwn !== excludeOwnPages) {
        setExcludeOwnPages(excludeOwn);
      }

      handleShuffle(excludeOwn);
    };

    window.addEventListener('shuffleRandomPages', handleShuffleEvent as EventListener);
    return () => {
      window.removeEventListener('shuffleRandomPages', handleShuffleEvent as EventListener);
    };
  }, [handleShuffle, excludeOwnPages]);

  // Listen for dense mode changes from header
  useEffect(() => {
    const handleDenseModeEvent = (event: CustomEvent) => {
      const newDenseMode = event.detail?.denseMode ?? false;
      console.log('RandomPages: Dense mode event received', { denseMode: newDenseMode });
      setDenseMode(newDenseMode);
    };

    window.addEventListener('randomPagesDenseModeChange', handleDenseModeEvent as EventListener);
    return () => {
      window.removeEventListener('randomPagesDenseModeChange', handleDenseModeEvent as EventListener);
    };
  }, []);

  // Re-fetch when dense mode changes to get appropriate number of results
  // Removed automatic re-fetch to prevent excessive API calls
  // Users can manually shuffle to get more results in dense mode

  // Show loading skeleton on initial load
  if (loading && !shuffling) {
    return <RandomPagesSkeleton limit={limit} />;
  }

  // Show error state
  if (error && !shuffling) {
    return (
      <div className="space-y-4">
        <div className={wewriteCard('default', 'text-center')}>
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
        <div className={wewriteCard('default', 'text-center')}>
          <p className="text-muted-foreground">No pages available to display</p>
          <Button
            variant="outline"
            onClick={() => fetchRandomPages()}
            className="mt-4 rounded-2xl"
          >
            Try Again
          </Button>
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
          denseMode={denseMode}
        />
      </Suspense>
    </div>
  );
});

export default RandomPages;