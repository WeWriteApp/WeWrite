"use client";

import React, { useState, useEffect } from 'react';
import { PillLink } from "../utils/PillLink";
import { Loader2, Info, RefreshCw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../ui/tooltip";
import { usePageConnections } from '../../hooks/usePageConnections';

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
  // Use consolidated page connections hook
  const { incoming, loading, error, refresh } = usePageConnections(page.id, page.title);
  // Process backlinks data from consolidated hook
  const processedBacklinks = incoming.map(backlink => ({
    ...backlink,
    isAlreadyLinked: linkedPageIds && linkedPageIds.includes(backlink.id)
  }));

  // Sort: non-linked pages first, then linked pages
  processedBacklinks.sort((a, b) => a.isAlreadyLinked ? 1 : -1);

  // Limit to 20 for display
  const backlinks = processedBacklinks.slice(0, 20);

  console.log('🔗 BacklinksSection: Using consolidated hook data:', {
    incoming: incoming.length,
    processed: backlinks.length,
    loading,
    error
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
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

        <button
          onClick={refresh}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          title="Refresh backlinks"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
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