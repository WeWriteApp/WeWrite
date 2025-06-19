'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { PillLink } from "../utils/PillLink";
import { formatRelativeTime } from "../../utils/formatRelativeTime";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { Lock } from 'lucide-react';
import { useDateFormat } from "../../contexts/DateFormatContext";
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";
import { useBatchPageData } from "../../hooks/useBatchPageData";

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

interface RandomPagesTableProps {
  pages: RandomPage[];
  loading?: boolean;
  denseMode?: boolean;
}

/**
 * Responsive table/card component for displaying random pages
 * Desktop: Table layout with columns for Title, Author, Last Edited
 * Mobile: Stacked cards with same information
 */
export default function RandomPagesTable({ pages, loading = false, denseMode = false }: RandomPagesTableProps) {
  const { formatDateString } = useDateFormat();

  // Preload page data for all pages to reduce individual requests
  const pageIds = pages.map(page => page.id);
  useBatchPageData(pageIds, { preload: true, batchDelay: 100 });

  // Calculate minimum height based on expected content to prevent layout shifts
  const minHeight = pages.length > 0 ? `${Math.max(400, pages.length * 60 + 100)}px` : '400px';

  if (!pages || pages.length === 0) {
    return (
      <div className="border border-theme-medium rounded-2xl p-8 text-center">
        <p className="text-muted-foreground">No pages to display</p>
      </div>
    );
  }

  // Dense mode: Show only pill-style links with page titles
  if (denseMode) {
    // Calculate dynamic height based on content to reduce whitespace
    const estimatedRows = Math.ceil(pages.length / 6); // Estimate ~6 pills per row
    const dynamicHeight = Math.max(120, estimatedRows * 50 + 80); // Base height + row height + padding

    return (
      <div
        className="border border-theme-medium rounded-2xl p-6"
        style={{ minHeight: `${dynamicHeight}px` }}
      >
        <div className="flex flex-wrap gap-2">
          {pages.map((page) => (
            <PillLink
              key={page.id}
              href={`/${page.id}`}
              className="hover:scale-105 transition-transform"
            >
              {page.title && isExactDateFormat(page.title)
                ? formatDateString(page.title)
                : page.title}
            </PillLink>
          ))}
        </div>
        {loading && (
          <div className="flex justify-center mt-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    );
  }

  // Format the last modified date for tooltip
  const formatTooltipDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'PPpp'); // e.g., "Jan 1, 2024 at 12:00:00 PM"
    } catch (error) {
      return dateString;
    }
  };

  // Render author information with group support
  const renderAuthor = (page: RandomPage) => {
    if (page.groupId && page.groupName) {
      return (
        <span className="text-sm text-muted-foreground">
          in{' '}
          <Link
            href={`/group/${page.groupId}`}
            className="text-primary hover:underline"
          >
            {page.groupName}
          </Link>
        </span>
      );
    }

    return (
      <span className="text-sm text-muted-foreground">
        by{' '}
        <Link
          href={`/user/${page.userId}`}
          className="text-primary hover:underline"
        >
          {page.username}
        </Link>
      </span>
    );
  };

  return (
    <TooltipProvider>
      {/* Desktop Table Layout */}
      <div
        className="hidden md:block border border-theme-medium rounded-2xl overflow-hidden relative shadow-md dark:bg-card/90"
        style={{ minHeight }}
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-pulse text-muted-foreground">Shuffling pages...</div>
            </div>
          </div>
        )}

        <div className="border-b border-theme-medium bg-muted/30 p-4">
          <div className="grid grid-cols-[1fr_200px_150px] gap-4 text-sm font-medium text-muted-foreground">
            <div>Title</div>
            <div>Author</div>
            <div>Last Edited</div>
          </div>
        </div>
        <div className="divide-y divide-theme-medium">
          {pages.map((page) => (
            <div key={page.id} className="p-4 hover:bg-muted/30 transition-colors">
              <div className="grid grid-cols-[1fr_200px_150px] gap-4 items-center">
                {/* Title Column - Flexible width with proper truncation */}
                <div className="min-w-0 overflow-hidden">
                  <div className="max-w-full flex items-center gap-2">
                    <PillLink
                      href={`/${page.id}`}
                      isPublic={page.isPublic}
                      groupId={page.groupId}
                      className="text-sm max-w-full"
                    >
                      {page.title && isExactDateFormat(page.title)
                        ? formatDateString(page.title)
                        : page.title}
                    </PillLink>
                    {!page.isPublic && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Private page</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Author Column - Fixed width */}
                <div className="min-w-0 overflow-hidden">
                  <div className="truncate">
                    {renderAuthor(page)}
                  </div>
                </div>

                {/* Last Edited Column - Fixed width */}
                <div className="min-w-0 overflow-hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-muted-foreground cursor-help truncate block">
                        {formatRelativeTime(page.lastModified || page.createdAt)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{formatTooltipDate(page.lastModified || page.createdAt)}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div
        className="md:hidden space-y-6 relative"
        style={{ minHeight }}
      >
        {/* Loading overlay for mobile */}
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
            <div className="text-center">
              <div className="animate-pulse text-muted-foreground">Shuffling pages...</div>
            </div>
          </div>
        )}

        {pages.map((page) => (
          <div
            key={page.id}
            className={cn(
              "border border-theme-medium rounded-2xl p-5 space-y-3 shadow-md",
              "hover:bg-muted/30 transition-colors dark:bg-card/90"
            )}
          >
            {/* Title */}
            <div className="flex items-center gap-2">
              <PillLink
                href={`/${page.id}`}
                isPublic={page.isPublic}
                groupId={page.groupId}
                className="text-base font-medium"
              >
                {page.title && isExactDateFormat(page.title)
                  ? formatDateString(page.title)
                  : page.title}
              </PillLink>
              {!page.isPublic && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Private page</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Author and Last Edited */}
            <div className="space-y-2">
              <div>
                {renderAuthor(page)}
              </div>
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm text-muted-foreground cursor-help">
                      Last edited {formatRelativeTime(page.lastModified || page.createdAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{formatTooltipDate(page.lastModified || page.createdAt)}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
