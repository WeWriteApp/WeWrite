"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, FileText } from 'lucide-react';
import { getRecentlyViewedPageIds } from "../../utils/recentSearches";
// Removed direct Firebase imports - now using API endpoints
import { useAuth } from '../../providers/AuthProvider';
import { PillLink } from "../utils/PillLink";
import { Skeleton } from "../ui/skeleton";

/**
 * RecentPages Component
 *
 * Displays a list of recently viewed pages
 */
const RecentPages = React.memo(function RecentPages() {
  const [recentPages, setRecentPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Function to fetch recent pages
  const fetchRecentPages = async () => {
    setLoading(true);
    try {
      // Get recent page IDs from localStorage
      const pageIds = getRecentlyViewedPageIds();

      if (!pageIds.length) {
        setRecentPages([]);
        setLoading(false);
        return;
      }

      // Limit to 5 most recent pages
      const limitedIds = pageIds.slice(0, 5);

      // Fetch page data for each ID using API endpoint
      const pagesPromises = limitedIds.map(async (id) => {
        try {
          const response = await fetch(`/api/pages/${id}`);

          if (!response.ok) {
            if (response.status === 404) {
              return null; // Page not found
            }
            throw new Error(`Failed to fetch page: ${response.status}`);
          }

          const result = await response.json();

          if (!result.success || !result.pageData) {
            throw new Error(result.error || 'Failed to fetch page');
          }

          const page = result.pageData;
          if (!page) return null;

          // Only include pages the user has access to and that are not deleted
          if (!page.isPublic && (!user || page.userId !== user.uid)) {
            return null;
          }

          // Exclude soft-deleted pages from recent pages
          if (page.deleted === true) {
            return null;
          }

          return {
            id,
            title: page.title || 'Untitled',
            isPublic: page.isPublic,
            userId: page.userId
          };
        } catch (error) {
          console.error(`Error fetching page ${id}:`, error);
          return null;
        }
      });

      const pagesResults = await Promise.all(pagesPromises);

      // Filter out null results
      const validPages = pagesResults.filter(page => page !== null);

      setRecentPages(validPages);
    } catch (error) {
      console.error("Error fetching recently viewed pages:", error);
      setRecentPages([]);
    } finally {
      setLoading(false);
    }
  };

  // Load recently viewed pages on mount
  useEffect(() => {
    fetchRecentPages();
  }, [, user]);

  // If there are no recently viewed pages and not loading, don't render anything
  if (!loading && !recentPages.length) {
    return null;
  }

  return (
    <div className="mt-6 mb-8">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center mb-3">
        <Clock className="h-4 w-4 mr-2" />
        Recently Viewed
      </h3>

      <div className="space-y-2">
        {loading ? (
          // Loading skeletons
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-8 w-full rounded-full" />
            </div>
          ))
        ) : (
          // Recently viewed pages list
          recentPages.map(page => (
            <PillLink
              key={page.id}
              href={`/${page.id}`}
              isPublic={page.isPublic}
              className="w-full"
            >
              <span className="truncate">{page.title}</span>
            </PillLink>
          ))
        )}
      </div>
    </div>
  );
});

RecentPages.displayName = 'RecentPages';

export default RecentPages;