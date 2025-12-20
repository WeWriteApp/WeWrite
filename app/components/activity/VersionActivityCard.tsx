"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { format } from 'date-fns';
import DiffPreview, { DiffStats } from './DiffPreview';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

/**
 * VersionActivityCard - Specialized component for versions pages
 * 
 * Layout optimized for versions:
 * - Timestamp at top right
 * - Diff content fills left side with expanded context
 * - Diff stats at bottom right
 */
export default function VersionActivityCard({ activity, className = "" }) {
  const router = useRouter();

  // Calculate diff stats
  const added = activity.lastDiff?.added || activity.diff?.added || 0;
  const removed = activity.lastDiff?.removed || activity.diff?.removed || 0;
  const isNewPage = !activity.previousContent && activity.currentContent;
  const isTitleChange = activity.type === 'title_change' ||
                        activity.changeType === 'title_change' ||
                        activity.changeType === 'content_and_title_change';

  const handleCardClick = () => {
    if (activity.pageId && activity.versionId) {
      // Navigate to the version snapshot view
      router.push(`/${activity.pageId}/versions/${activity.versionId}`);
    } else if (activity.pageId) {
      router.push(`/${activity.pageId}`);
    }
  };

  return (
    <div
      className={`
        wewrite-card cursor-pointer h-24 flex flex-col p-2
        ${className}
      `}
      onClick={handleCardClick}
    >
      {/* Top row: timestamp at top right */}
      <div className="flex justify-end mb-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                {activity.timestamp ? formatRelativeTime(activity.timestamp) : 'Unknown time'}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <span>
                {activity.timestamp ? (() => {
                  try {
                    const date = new Date(activity.timestamp);
                    return isNaN(date.getTime()) ? 'Invalid date' : format(date, 'PPpp');
                  } catch (error) {
                    console.error('Error formatting tooltip date:', error);
                    return 'Invalid date';
                  }
                })() : "Unknown date"}
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Main content area: diff preview fills the space */}
      <div className="flex-1 mb-1">
        <DiffPreview
          currentContent={activity.currentContent}
          previousContent={isNewPage ? null : activity.previousContent}
          textDiff={{
            preview: activity.lastDiff?.preview || activity.diffPreview,
            added: activity.lastDiff?.added || activity.diff?.added || 0,
            removed: activity.lastDiff?.removed || activity.diff?.removed || 0,
            hasChanges: activity.lastDiff?.hasChanges || activity.diff?.hasChanges || false
          }}
          isNewPage={isNewPage}
          className="h-full"
          expandedContext={true}
        />
      </div>

      {/* Bottom row: diff stats at bottom right */}
      <div className="flex justify-end">
        {!isTitleChange && (
          <DiffStats
            added={added}
            removed={removed}
            isNewPage={isNewPage}
            showTooltips={true}
            className="text-xs"
          />
        )}
      </div>
    </div>
  );
}
