'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { PillLink } from "../utils/PillLink";
import { formatRelativeTime } from "../../utils/formatRelativeTime";

import { format } from 'date-fns';
import { cn, wewriteCard } from '../../lib/utils';

import { useAuth } from '../../providers/AuthProvider';
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";
import { useDateFormat } from '../../contexts/DateFormatContext';
import { SubscriptionTierBadge } from '../ui/SubscriptionTierBadge';
import { UsernameBadge } from '../ui/UsernameBadge';
import { EmbeddedAllocationBar } from '../payments/EmbeddedAllocationBar';
import { MoreVertical, UserMinus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';

interface RandomPage {
  id: string;
  title: string;
  userId: string;
  username: string;
  lastModified: string;
  createdAt: string;
  groupId?: string;
  groupName?: string;
  groupIsPublic?: boolean;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
  // Note: isPublic removed - all pages are now public
}

interface RandomPagesTableProps {
  pages: RandomPage[];
  loading?: boolean;
  denseMode?: boolean;
  onExcludeUser?: (username: string) => void;
}

/**
 * Responsive table/card component for displaying random pages
 * Desktop: Table layout with columns for Title, Author, Last Edited
 * Mobile: Stacked cards with same information
 */
export default function RandomPagesTable({ pages, loading = false, denseMode = false, onExcludeUser }: RandomPagesTableProps) {
  const { formatDateString } = useDateFormat();

  // Note: Batch page data preloading was removed with user management cleanup

  // Calculate minimum height based on expected content to prevent layout shifts
  const minHeight = pages.length > 0 ? `${Math.max(400, pages.length * 60 + 100)}px` : '400px';

  if (!pages || pages.length === 0) {
    return (
      <div className={wewriteCard('default', 'text-center')}>
        <p className="text-muted-foreground">No pages to display</p>
      </div>
    );
  }

  // Dense mode: Show only pill-style links with page titles (no container for full page)
  if (denseMode) {
    return (
      <div className="space-y-4">
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
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    );
  }



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
        <UsernameBadge
          userId={page.userId}
          username={page.username}
          tier={page.tier}
          subscriptionStatus={page.subscriptionStatus}
          subscriptionAmount={page.subscriptionAmount}
          size="sm"
          className="inline-flex"
        />
      </span>
    );
  };

  return (
    <div>
      {/* Desktop Table Layout - only show when NOT in dense mode */}
      {!denseMode && (
        <div
          className={cn("hidden md:block relative", wewriteCard('default', 'p-0'))}
          style={{ minHeight }}
        >
        {/* Loading overlay - higher z-index to blur all content including stars */}
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-pulse text-muted-foreground">Shuffling pages...</div>
            </div>
          </div>
        )}

        <div className="border-b border-theme-medium bg-muted/30 p-4">
          <div className="grid grid-cols-[1fr_200px_150px_200px_40px] gap-4 text-sm font-medium text-muted-foreground">
            <div>Title</div>
            <div>Author</div>
            <div>Last Edited</div>
            <div>Allocation</div>
            <div></div>
          </div>
        </div>
        <div className="divide-y divide-theme-medium">
          {pages.map((page) => (
            <div key={page.id} className="p-4 hover:bg-muted/30 transition-colors">
              <div className="grid grid-cols-[1fr_200px_150px_200px_40px] gap-4 items-center">
                {/* Title Column - Flexible width with proper truncation */}
                <div className="min-w-0 overflow-hidden">
                  <div className="max-w-full flex items-center gap-2">
                    <PillLink
                      href={`/${page.id}`}
                      groupId={page.groupId}
                      className="text-sm hover:scale-105 transition-transform"
                    >
                      {page.title && isExactDateFormat(page.title)
                        ? formatDateString(page.title)
                        : page.title}
                    </PillLink>
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
                  <span className="text-sm text-muted-foreground truncate block">
                    {(() => {
                      try {
                        const timestamp = page.lastModified || page.createdAt;
                        return timestamp ? formatRelativeTime(timestamp) : 'Unknown';
                      } catch (error) {
                        console.error('Error formatting page time:', error);
                        return 'Unknown';
                      }
                    })()}
                  </span>
                </div>

                {/* Allocation Column */}
                <div className="min-w-0">
                  <EmbeddedAllocationBar
                    pageId={page.id}
                    authorId={page.userId}
                    pageTitle={page.title}
                    source="RandomPages"
                  />
                </div>

                {/* Menu Column */}
                <div className="flex justify-end">
                  {onExcludeUser && page.username && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full hover:bg-muted"
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Page options</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onExcludeUser(page.username)}
                          className="text-destructive focus:text-destructive"
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Filter out {page.username}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Mobile Card Layout - only show when NOT in dense mode */}
      {!denseMode && (
        <div
          className="md:hidden space-y-3 relative"
          style={{ minHeight }}
        >
        {/* Loading overlay for mobile - higher z-index to blur all content including stars */}
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex items-center justify-center rounded-2xl">
            <div className="text-center">
              <div className="animate-pulse text-muted-foreground">Shuffling pages...</div>
            </div>
          </div>
        )}

        {pages.map((page) => (
          <div
            key={page.id}
            className={cn(wewriteCard('interactive'), "space-y-1.5 relative p-3")}
          >
            {/* Menu button in top right */}
            {onExcludeUser && page.username && (
              <div className="absolute top-2 right-2 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full hover:bg-muted"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                      <span className="sr-only">Page options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => onExcludeUser(page.username)}
                      className="text-destructive focus:text-destructive"
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Filter out {page.username}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Title */}
            <div className="flex items-center gap-2 pr-6">
              <PillLink
                href={`/${page.id}`}
                groupId={page.groupId}
                className="text-sm font-medium"
              >
                {page.title && isExactDateFormat(page.title)
                  ? formatDateString(page.title)
                  : page.title}
              </PillLink>
            </div>

            {/* Author and Last Edited - inline */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {renderAuthor(page)}
              <span>·</span>
              <span>
                {(() => {
                  try {
                    const timestamp = page.lastModified || page.createdAt;
                    return timestamp ? formatRelativeTime(timestamp) : 'unknown';
                  } catch (error) {
                    console.error('Error formatting page time:', error);
                    return 'unknown';
                  }
                })()}
              </span>
            </div>

            {/* Embedded Allocation Bar */}
            <div className="pt-1">
              <EmbeddedAllocationBar
                pageId={page.id}
                authorId={page.userId}
                pageTitle={page.title}
                source="RandomPages"
              />
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
