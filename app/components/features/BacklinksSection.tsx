"use client";

import React, { useState, useEffect } from 'react';
import { PillLink } from "../utils/PillLink";
import { Loader2, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../ui/tooltip";

// Import the efficient backlinks function
const getBacklinksAsync = async (pageId: string, limit?: number) => {
  const { getBacklinks } = await import('../../firebase/database/backlinks');
  return getBacklinks(pageId, limit);
};

// Import navigation tracking functions
const getNavigationBacklinksAsync = async (pageId: string) => {
  if (typeof window === 'undefined') return [];

  try {
    const { getNavigationBacklinks } = await import('../../utils/navigationTracking');
    return getNavigationBacklinks(pageId);
  } catch (error) {
    console.warn('Could not load navigation tracking:', error);
    return [];
  }
};

interface BacklinksSectionProps {
  page: {
    id: string;
    title: string;
    username?: string;
    isPublic?: boolean;
  };
  linkedPageIds?: string[];
}

export default function BacklinksSection({ page, linkedPageIds = [] }: BacklinksSectionProps) {
  const [backlinks, setBacklinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch backlinks
  useEffect(() => {
    if (!page?.id || !mounted) return;

    const fetchBacklinks = async () => {
      try {
        setLoading(true);

        // Get content-based backlinks using the efficient index
        const contentBacklinks = await getBacklinksAsync(page.id, 40);

        // Get navigation-based backlinks
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

        // Mark already linked pages
        const processedBacklinks = allBacklinks.map(backlink => ({
          ...backlink,
          isAlreadyLinked: linkedPageIds && linkedPageIds.includes(backlink.id)
        }));

        // Sort: non-linked pages first, then linked pages
        processedBacklinks.sort((a, b) => a.isAlreadyLinked ? 1 : -1);

        // Limit to 20 for display
        const limitedBacklinks = processedBacklinks.slice(0, 20);

        setBacklinks(limitedBacklinks);
      } catch (error) {
        console.error('Error fetching backlinks:', error);
        console.error('Backlinks error details:', {
          message: error.message,
          code: error.code,
          pageId: page.id
        });
        setBacklinks([]);
      }
      setLoading(false);
    };

    fetchBacklinks();
  }, [page?.id, linkedPageIds, mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Backlinks
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-gray-400 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Pages that link to this page</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading backlinks...</span>
        </div>
      ) : backlinks.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {backlinks.map((page, index) => (
            <div key={page.id} className="flex items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={page.isAlreadyLinked ? "opacity-60" : ""}>
                      <PillLink href={`/${page.id}`}>
                        {page.title || "Untitled"}
                      </PillLink>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <div className="font-medium">{page.title || "Untitled"}</div>
                      {page.username && (
                        <div className="text-gray-400">by {page.username}</div>
                      )}
                      {page.isAlreadyLinked && (
                        <div className="text-blue-400">Already linked in page content</div>
                      )}
                      {page.linkText && (
                        <div className="text-gray-400">"{page.linkText}"</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          No pages link to this page
        </div>
      )}
    </div>
  );
}