"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';

import NavPageLayout from '../components/layout/NavPageLayout';
import RandomPagesTable from '../components/pages/RandomPagesTable';
import EmptyState from '../components/ui/EmptyState';
import { InlineError } from '../components/ui/InlineError';
import { getRecentlyViewedPageIds } from '../utils/recentSearches';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

/**
 * Recently Viewed Page Component
 *
 * Displays a comprehensive list of recently viewed pages for authenticated users.
 * Uses localStorage to track actually visited pages (not just recently modified).
 */
export default function RecentsPage() {
  const { user } = useAuth();
  const [recentPages, setRecentPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      window.location.href = '/auth/login';
      return;
    }
  }, [user]);

  // Fetch recently viewed pages from localStorage using batch endpoint
  useEffect(() => {
    if (!user) return;

    const fetchRecentPages = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get recent page IDs from localStorage
        const pageIds = getRecentlyViewedPageIds();

        if (!pageIds.length) {
          setRecentPages([]);
          setLoading(false);
          return;
        }

        // PERFORMANCE: Use batch endpoint instead of individual API calls
        // This reduces N API calls to a single request
        const response = await fetch('/api/pages/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageIds })
        });

        if (!response.ok) {
          throw new Error(`Batch fetch failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.pages) {
          throw new Error('Invalid batch response');
        }

        // Convert the pages object to array, preserving order from pageIds
        // and filtering out null (not found) pages
        const validPages = pageIds
          .map(id => {
            const page = result.pages[id];
            if (!page) return null;
            // Filter: only show public pages or user's own pages
            if (!page.isPublic && page.userId !== user.uid) return null;
            return {
              id,
              title: page.title || 'Untitled',
              isPublic: page.isPublic,
              userId: page.userId,
              username: page.username,
              lastModified: page.lastModified,
              createdAt: page.createdAt,
              totalPledged: page.totalPledged || 0,
              pledgeCount: page.pledgeCount || 0
            };
          })
          .filter(Boolean);

        setRecentPages(validPages);
      } catch (error) {
        console.error("Error fetching recently viewed pages:", error);
        setError("Failed to load recently viewed pages");
        setRecentPages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentPages();
  }, [user]);

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <NavPageLayout>
      <PageHeader
        title="Recently Viewed"
        description="Pages you've viewed recently"
      />

          {/* Content */}
          {loading ? (
            // Loading state
            <div className="animate-pulse space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-lg"></div>
              ))}
            </div>
          ) : error ? (
            // Error state
            <InlineError
              message={error}
              variant="error"
              size="md"
            />
          ) : recentPages.length === 0 ? (
            // Empty state
            <EmptyState
              icon="Clock"
              title="No recently viewed pages"
              description="Pages you visit will appear here for quick access"
            />
          ) : (
            // Recently viewed pages list using RandomPagesTable with UsernameBadge
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {recentPages.length} page{recentPages.length !== 1 ? 's' : ''} found
                </p>
              </div>

              <RandomPagesTable
                pages={recentPages}
                loading={false}
                denseMode={false}
              />
            </div>
          )}
    </NavPageLayout>
  );
}