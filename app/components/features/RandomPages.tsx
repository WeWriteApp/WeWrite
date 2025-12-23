'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { RandomPagesSkeleton } from '../ui/skeleton-loaders';
import { SectionTitle } from '../ui/section-title';
import { Button } from '../ui/button';
import { Icon } from '@/components/ui/Icon';
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
  onExcludeUser?: (username: string) => void;
}

/**
 * RandomPages component that fetches and displays random pages
 * with shuffle functionality and responsive table/card layout
 */
const RandomPages = React.memo(function RandomPages({
  limit = 10,
  priority = 'low',
  onExcludeUser
}: RandomPagesProps) {
  const { user } = useAuth();
  const [randomPages, setRandomPages] = useState<RandomPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [shuffling, setShuffling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [denseMode, setDenseMode] = useState(false);
  const [excludeOwnPages, setExcludeOwnPages] = useState(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      return localStorage.getItem('randomPages_excludeOwnPages') === 'true';
    }
    return false;
  });
  const [excludeUsername, setExcludeUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('randomPages_excludeUsername') || '';
    }
    return '';
  });

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

      const savedExcludeUsername = localStorage.getItem('randomPages_excludeUsername') || '';
      setExcludeUsername(savedExcludeUsername);
    }
  }, []);

  // Fetch random pages from API with throttling
  const fetchRandomPages = useCallback(async (isShuffling = false, excludeOwn = excludeOwnPages, excludedUser = excludeUsername) => {
    try {
      // Prevent excessive API calls - throttle to max once per 2 seconds
      const now = Date.now();
      const lastFetchKey = `randomPages_${user?.uid || 'anonymous'}`;
      const lastFetch = parseInt(localStorage.getItem(lastFetchKey) || '0');

      if (!isShuffling && (now - lastFetch) < 2000) {
        console.log('RandomPages: Throttling API call, too recent');
        // If we're throttling on initial load, still need to set loading to false
        // Check if we have cached data to show
        const cachedData = localStorage.getItem(`randomPages_cache_${user?.uid || 'anonymous'}`);
        if (cachedData && randomPages.length === 0) {
          try {
            const parsed = JSON.parse(cachedData);
            if (parsed && Array.isArray(parsed) && parsed.length > 0) {
              setRandomPages(parsed);
              console.log('RandomPages: Using cached data while throttled');
            }
          } catch (e) {
            console.error('Error parsing cached random pages:', e);
          }
        }
        setLoading(false);
        return;
      }

      localStorage.setItem(lastFetchKey, now.toString());

      if (isShuffling) {
        setShuffling(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Use higher limit for shuffling and dense mode to show more results
      let effectiveLimit = limit;
      if (denseMode) {
        effectiveLimit = Math.max(limit * 2, 20);
      } else if (isShuffling) {
        // When shuffling, show 50% more results to give users more variety
        effectiveLimit = Math.max(Math.floor(limit * 1.5), limit + 5);
      }

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

      if (excludedUser) {
        params.append('excludeUsername', excludedUser.trim());
      }

      // Add shuffle flag to help API provide more variety
      if (isShuffling) {
        params.append('shuffle', 'true');
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

      // Cache the fetched data for throttling scenarios
      if (data.randomPages && data.randomPages.length > 0) {
        localStorage.setItem(`randomPages_cache_${user?.uid || 'anonymous'}`, JSON.stringify(data.randomPages));
      }

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
  }, [limit, user?.uid, denseMode, excludeOwnPages, excludeUsername]);

  // Handle shuffle button click
  const handleShuffle = useCallback((excludeOwn = excludeOwnPages, excludedUser = excludeUsername) => {
    console.log('RandomPages: Shuffle button clicked', { excludeOwn, excludedUser });
    fetchRandomPages(true, excludeOwn, excludedUser);
  }, [fetchRandomPages, excludeOwnPages, excludeUsername]);

  // Load localStorage preferences on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDenseMode = localStorage.getItem('randomPages_denseMode') === 'true';
      setDenseMode(savedDenseMode);
    }
  }, []);

  // Initial fetch on component mount with correct filter settings
  useEffect(() => {
    // Use the current excludeOwnPages state (which is initialized from localStorage)
    fetchRandomPages(false, excludeOwnPages, excludeUsername);
  }, [fetchRandomPages, excludeOwnPages, excludeUsername]);

  // Listen for shuffle events from sticky header
  useEffect(() => {
    const handleShuffleEvent = (event: CustomEvent) => {
      const excludeOwn = event.detail?.excludeOwnPages ?? excludeOwnPages;
      const excludedUser = event.detail?.excludeUsername ?? excludeUsername;
      console.log('RandomPages: Shuffle event received', { excludeOwn, excludedUser });

      // Update local state if settings changed
      if (excludeOwn !== excludeOwnPages) {
        setExcludeOwnPages(excludeOwn);
      }
      if (excludedUser !== excludeUsername) {
        setExcludeUsername(excludedUser);
      }

      handleShuffle(excludeOwn, excludedUser);
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

  // Show proper loading skeleton on initial load OR while loading with no data
  if (loading) {
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
            variant="secondary"
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
            variant="secondary"
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
          onExcludeUser={onExcludeUser}
        />
      </Suspense>
    </div>
  );
});

export default RandomPages;
