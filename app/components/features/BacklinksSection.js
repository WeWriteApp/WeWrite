"use client";

import React, { useState, useEffect, useRef } from 'react';
import { PillLink } from "../utils/PillLink";
import { Loader2, Info } from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../ui/tooltip";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";

// Import the database function with dynamic import to avoid SSR issues
const findBacklinksAsync = async (pageId, limit) => {
  const { findBacklinks } = await import('../../firebase/database');
  return findBacklinks(pageId, limit);
};

// Import navigation tracking functions
const getNavigationBacklinksAsync = async (pageId) => {
  const { getNavigationBacklinks } = await import('../../utils/navigationTracking');
  return getNavigationBacklinks(pageId);
};

// Local storage key for caching "no backlinks" state
const NO_BACKLINKS_CACHE_KEY = 'wewrite_no_backlinks_cache';
const MAX_RETRIES = 3; // Maximum number of consecutive empty results before stopping
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get cached "no backlinks" state for a page
 * @param {string} pageId - The page ID to check
 * @returns {boolean} - Whether the page has no backlinks (cached)
 */
const getNoBacklinksCache = (pageId) => {
  try {
    const cacheJson = localStorage.getItem(NO_BACKLINKS_CACHE_KEY);
    if (!cacheJson) return false;

    const cache = JSON.parse(cacheJson);
    const entry = cache[pageId];

    if (!entry) return false;

    // Check if the cache entry is still valid
    if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
      return false;
    }

    return entry.hasNoBacklinks;
  } catch (error) {
    console.error('Error reading no-backlinks cache:', error);
    return false;
  }
};

/**
 * Set cached "no backlinks" state for a page
 * @param {string} pageId - The page ID to cache
 * @param {boolean} hasNoBacklinks - Whether the page has no backlinks
 */
const setNoBacklinksCache = (pageId, hasNoBacklinks) => {
  try {
    const cacheJson = localStorage.getItem(NO_BACKLINKS_CACHE_KEY);
    const cache = cacheJson ? JSON.parse(cacheJson) : {};

    cache[pageId] = {
      hasNoBacklinks,
      timestamp: Date.now()
    };

    localStorage.setItem(NO_BACKLINKS_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error setting no-backlinks cache:', error);
  }
};

/**
 * BacklinksSection Component
 *
 * Displays a list of pages that link to the current page.
 * This is also known as "What Links Here" functionality.
 * Filters out pages that are already linked in the body of the page.
 *
 * @param {Object} page - The current page object
 * @param {Array} linkedPageIds - Array of page IDs that are already linked in the page content
 * @param {number} maxPages - Maximum number of backlinks to display (default: 5)
 */
export default function BacklinksSection({ page, linkedPageIds = [], maxPages = 5 }) {
  const [backlinks, setBacklinks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [maxRetriesReached, setMaxRetriesReached] = useState(false);
  const emptyResultsCount = useRef(0);
  const pageIdRef = useRef(null);
  const { formatDateString } = useDateFormat();

  useEffect(() => {
    const fetchBacklinks = async () => {
      setIsLoading(true);

      if (!page || !page.id) {
        setIsLoading(false);
        return;
      }

      // Reset retry counter when page ID changes
      if (pageIdRef.current !== page.id) {
        pageIdRef.current = page.id;
        emptyResultsCount.current = 0;
        setMaxRetriesReached(false);
      }

      // Check if this is a fresh navigation to ensure real-time updates
      const isFromNavigation = typeof window !== 'undefined' &&
        window.performance &&
        window.performance.navigation &&
        window.performance.navigation.type === 1; // TYPE_NAVIGATE

      // Only use cache if this is not from fresh navigation
      if (!isFromNavigation && getNoBacklinksCache(page.id)) {
        console.log(`Using cached "no backlinks" state for page ${page.id}`);
        setBacklinks([]);
        setIsLoading(false);
        setMaxRetriesReached(true);
        return;
      }

      // If we've already reached max retries and this isn't from navigation, don't fetch again
      if (maxRetriesReached && !isFromNavigation) {
        setIsLoading(false);
        return;
      }

      try {
        // CRITICAL FIX: Combine content-based backlinks with navigation-based backlinks
        console.log(`Fetching backlinks for page ${page.id} using both content and navigation data`);

        // Get content-based backlinks (traditional method)
        const contentBacklinks = await findBacklinksAsync(page.id, maxPages * 2);

        // Get navigation-based backlinks (new method for real-time updates)
        const navigationBacklinkIds = await getNavigationBacklinksAsync(page.id);

        // Fetch page data for navigation backlinks
        const navigationBacklinks = [];
        if (navigationBacklinkIds.length > 0) {
          const { getPageById } = await import('../../firebase/database');

          for (const pageId of navigationBacklinkIds) {
            try {
              const pageData = await getPageById(pageId);
              if (pageData && pageData.title) {
                navigationBacklinks.push(pageData);
              }
            } catch (error) {
              console.warn(`Could not fetch navigation backlink page ${pageId}:`, error);
            }
          }
        }

        // Combine and deduplicate backlinks
        const allBacklinks = [...contentBacklinks];

        // Add navigation backlinks that aren't already in content backlinks
        navigationBacklinks.forEach(navBacklink => {
          if (!allBacklinks.find(existing => existing.id === navBacklink.id)) {
            allBacklinks.push(navBacklink);
          }
        });

        console.log(`Found ${contentBacklinks.length} content backlinks and ${navigationBacklinks.length} navigation backlinks for page ${page.id}`);

        // Mark already linked pages instead of filtering them out
        const processedBacklinks = allBacklinks.map(backlink => ({
          ...backlink,
          isAlreadyLinked: linkedPageIds && linkedPageIds.includes(backlink.id)
        }));

        // Sort to prioritize non-linked pages, then limit results
        const limitedBacklinks = processedBacklinks
          .sort((a, b) => {
            // Prioritize non-linked pages over already linked ones
            if (a.isAlreadyLinked !== b.isAlreadyLinked) {
              return a.isAlreadyLinked ? 1 : -1;
            }
            return 0;
          })
          .slice(0, maxPages);

        setBacklinks(limitedBacklinks);

        // Handle empty results tracking
        if (limitedBacklinks.length === 0) {
          emptyResultsCount.current += 1;
          console.log(`No backlinks found for page ${page.id} (attempt ${emptyResultsCount.current}/${MAX_RETRIES})`);

          // If we've reached max retries, stop trying and cache the result
          if (emptyResultsCount.current >= MAX_RETRIES) {
            console.log(`Max retries reached for page ${page.id}, stopping backlinks fetch attempts`);
            setMaxRetriesReached(true);
            setNoBacklinksCache(page.id, true);
          }
        } else {
          // Reset counter if we found backlinks
          emptyResultsCount.current = 0;
          console.log(`Found ${limitedBacklinks.length} backlinks for page ${page.id}`);
          setNoBacklinksCache(page.id, false);
        }
      } catch (error) {
        console.error('Error fetching backlinks:', error);
        // Set empty array on error to avoid undefined state
        setBacklinks([]);

        // Count errors as empty results for retry limiting
        emptyResultsCount.current += 1;
        if (emptyResultsCount.current >= MAX_RETRIES) {
          setMaxRetriesReached(true);
          setNoBacklinksCache(page.id, true);
        }
      }

      setIsLoading(false);
    };

    fetchBacklinks();
  }, [page, maxPages, linkedPageIds, maxRetriesReached]);

  // Add mounted state to prevent hydration issues
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Render a consistent height container regardless of loading state
  // Only render the full component when mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="mt-8 pt-6 min-h-[120px]">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-medium">What Links Here</h3>
          <Info className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex justify-center items-center py-4 min-h-[60px]">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 min-h-[120px]">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-medium">What Links Here</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[300px]">
              <p>Pages that contain links to this page. Pages already linked in the content appear with reduced opacity.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {isLoading && !maxRetriesReached ? (
        <div className="flex justify-center items-center py-4 min-h-[60px]">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        </div>
      ) : backlinks.length > 0 ? (
        <div className="flex flex-wrap gap-2 py-4">
          {backlinks.map(page => (
            <div key={page.id} className="flex-none max-w-full">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={page.isAlreadyLinked ? "opacity-60" : ""}>
                      <PillLink
                        key={page.id}
                        href={`/${page.id}`}
                        className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px]"
                      >
                        {page.title && isExactDateFormat(page.title)
                          ? formatDateString(page.title)
                          : (page.title || "Untitled")}
                      </PillLink>
                    </div>
                  </TooltipTrigger>
                  {page.isAlreadyLinked && (
                    <TooltipContent side="top" className="max-w-[200px]">
                      Already linked in page content
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex justify-center items-center py-4 min-h-[60px] text-muted-foreground border border-dotted border-border/30 rounded-md">
          No pages link to this page
        </div>
      )}
    </div>
  );
}
