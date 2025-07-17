"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PillLink } from "../utils/PillLink";
import { Loader2, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../ui/tooltip";

// These are no longer needed - using consolidated hook

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
  const [error, setError] = useState<string | null>(null);

  // Fetch backlinks using the unified page-connections API
  const fetchBacklinks = useCallback(async () => {
    if (!page.id) return;

    try {
      setLoading(true);
      setError(null);
      console.log('🔗 BacklinksSection: Fetching backlinks for page:', page.id);

      const response = await fetch(`/api/page-connections?pageId=${page.id}&limit=20`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔗 BacklinksSection: API error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔗 BacklinksSection: API response:', data);
      console.log('🔗 BacklinksSection: Received backlinks:', data.incoming?.length || 0);

      // Use the incoming connections as backlinks
      setBacklinks(data.incoming || []);
    } catch (error) {
      console.error('🔗 BacklinksSection: Error fetching backlinks:', error);
      setError(error instanceof Error ? error.message : 'Failed to load backlinks');
      setBacklinks([]);
    } finally {
      setLoading(false);
    }
  }, [page.id]);

  useEffect(() => {
    fetchBacklinks();
  }, [fetchBacklinks]);
  // Process backlinks data
  const processedBacklinks = backlinks.map(backlink => ({
    ...backlink,
    isAlreadyLinked: linkedPageIds && linkedPageIds.includes(backlink.id)
  }));

  // Sort: non-linked pages first, then linked pages
  processedBacklinks.sort((a, b) => a.isAlreadyLinked ? 1 : -1);

  console.log('🔗 BacklinksSection: Processed backlinks:', {
    total: backlinks.length,
    processed: processedBacklinks.length,
    loading,
    error
  });

  return (
    <div className="mt-8 px-4 sm:px-6 max-w-4xl mx-auto">
      <div className="p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-medium">
            Backlinks
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Pages that link to this page</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading backlinks...</span>
          </div>
        ) : processedBacklinks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {processedBacklinks.map((page, index) => (
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
                          <div className="text-muted-foreground">by {page.username}</div>
                        )}
                        {page.isAlreadyLinked && (
                          <div className="text-blue-400">Already linked in page content</div>
                        )}
                        {page.linkText && (
                          <div className="text-muted-foreground">"{page.linkText}"</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-400">
            Error: {error}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-2">
                <button
                  onClick={async () => {
                    try {
                      console.log('🔧 Triggering backlinks index build...');
                      const response = await fetch('/api/debug/build-backlinks', { method: 'POST' });
                      const result = await response.json();
                      console.log('🔧 Backlinks build result:', result);
                      if (response.ok) {
                        // Retry fetching backlinks after building index
                        setTimeout(() => fetchBacklinks(), 2000);
                      }
                    } catch (err) {
                      console.error('🔧 Error building backlinks index:', err);
                    }
                  }}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Build Backlinks Index (Dev)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No pages link to this page
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-2">
                <button
                  onClick={async () => {
                    try {
                      console.log('🔧 Triggering backlinks index build...');
                      const response = await fetch('/api/debug/build-backlinks', { method: 'POST' });
                      const result = await response.json();
                      console.log('🔧 Backlinks build result:', result);
                      if (response.ok) {
                        // Retry fetching backlinks after building index
                        setTimeout(() => fetchBacklinks(), 2000);
                      }
                    } catch (err) {
                      console.error('🔧 Error building backlinks index:', err);
                    }
                  }}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Build Backlinks Index (Dev)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}