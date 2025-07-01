"use client";

import React from 'react';

/**
 * WeWrite Activity Diff Standardization - DiffPreview Component
 *
 * A reusable component for displaying diff previews with consistent styling
 * across all ActivityCard implementations. This component is part of the
 * comprehensive diff standardization that ensures consistent diff display
 * throughout the WeWrite application.
 *
 * Standardization Requirements Met:
 * ✅ Green background for text additions
 * ✅ Red background with strikethrough for text deletions
 * ✅ Display up to 3 lines of context around changes
 * ✅ Show both added and deleted text simultaneously in previews
 * ✅ All diff logic consolidated into a single utility file
 *
 * Styling Standards Applied:
 * - Addition Styling: bg-green-50 dark:bg-green-900/40, text-green-600 dark:text-green-400
 * - Deletion Styling: bg-red-50 dark:bg-red-900/40, text-red-600 dark:text-red-400, line-through
 * - Context Styling: text-muted-foreground dark:text-slate-300
 *
 * Activity Card Locations Using This Component:
 * 1. Main Activity Page (/activity) - ActivityPageClient.tsx → ActivityCard.js
 * 2. User Profile Pages (/user/[id]) - UserProfileTabs.js → RecentActivity.js → ActivityCard.js
 * 3. Home Page Activity Section - ActivitySection.js → RecentActivity.js → ActivityCard.js
 * 4. Landing Page Carousels - ActivityCarousel.tsx → ActivityCard.js
 * 5. Page History Views (/[id]/history) - history/page.js → ActivityCard.js
 *
 * Benefits of Standardization:
 * - Consistency: All activity cards display diffs identically
 * - Maintainability: Single source of truth for diff display logic
 * - Reusability: Components can be easily reused in new contexts
 * - Accessibility: Consistent color coding and styling across the app
 * - Performance: Optimized diff algorithm with proper context handling
 *
 * @param {Object} props
 * @param {Object} props.textDiff - The diff object from generateTextDiff
 * @param {boolean} props.isNewPage - Whether this is a new page creation
 * @param {string} props.className - Additional CSS classes
 */
export default function DiffPreview({ textDiff, isNewPage = false, className = "" }) {
  // If no diff data, show fallback message
  if (!textDiff || !textDiff.preview) {
    return (
      <div className={`text-xs text-muted-foreground h-full flex items-center ${className}`}>
        {isNewPage ? "New page created" : "Page edited"}
      </div>
    );
  }

  const { preview } = textDiff;

  return (
    <div className={`text-xs overflow-hidden h-full ${className}`}>
      {/* Text content with enhanced diff display */}
      <div className="overflow-x-hidden text-ellipsis line-clamp-3">
        {/* Before context */}
        {preview.beforeContext && (
          <>
            <span className="text-muted-foreground dark:text-slate-300">...</span>
            <span className="text-muted-foreground dark:text-slate-300">{preview.beforeContext}</span>
          </>
        )}

        {/* Show removed text with strikethrough and red background */}
        {preview.hasRemovals && preview.removedText && (
          <span className="bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-0.5 rounded line-through">
            {preview.removedText}
          </span>
        )}

        {/* Show added text with green background */}
        {preview.hasAdditions && preview.addedText && (
          <span className="bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-0.5 rounded">
            {preview.addedText}
          </span>
        )}

        {/* After context */}
        {preview.afterContext && (
          <>
            <span className="text-muted-foreground dark:text-slate-300">{preview.afterContext}</span>
            <span className="text-muted-foreground dark:text-slate-300">...</span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * DiffStats Component
 *
 * A reusable component for displaying diff statistics (added/removed counts)
 * with consistent styling and tooltips.
 *
 * @param {Object} props
 * @param {number} props.added - Number of characters added
 * @param {number} props.removed - Number of characters removed
 * @param {boolean} props.isNewPage - Whether this is a new page creation
 * @param {boolean} props.showTooltips - Whether to show tooltips (default: true)
 * @param {string} props.className - Additional CSS classes
 */
export function DiffStats({
  added = 0,
  removed = 0,
  isNewPage = false,
  showTooltips = true,
  className = ""
}) {
  // Import tooltip components only when needed
  const TooltipProvider = showTooltips ? require('../ui/tooltip').TooltipProvider : null;
  const Tooltip = showTooltips ? require('../ui/tooltip').Tooltip : null;
  const TooltipContent = showTooltips ? require('../ui/tooltip').TooltipContent : null;
  const TooltipTrigger = showTooltips ? require('../ui/tooltip').TooltipTrigger : null;

  const renderStats = () => {
    if (added > 0 && removed > 0) {
      // Show both additions and deletions in git-style format
      return (
        <span className="flex items-center gap-1">
          <span className="text-green-600 dark:text-green-400">+{added}</span>
          <span className="text-red-600 dark:text-red-400">-{removed}</span>
        </span>
      );
    } else if (added > 0) {
      // Show only additions
      return (
        <span className="text-green-600 dark:text-green-400">+{added}</span>
      );
    } else if (removed > 0) {
      // Show only deletions
      return (
        <span className="text-red-600 dark:text-red-400">-{removed}</span>
      );
    } else if (!isNewPage) {
      return (
        <span className="text-muted-foreground">No changes</span>
      );
    }
    return null;
  };

  const stats = renderStats();
  if (!stats) return null;

  if (!showTooltips || !TooltipProvider) {
    return (
      <div className={`text-xs font-medium flex items-center ${className}`}>
        {stats}
      </div>
    );
  }

  const getTooltipText = () => {
    if (added > 0 && removed > 0) {
      return `${added} characters added, ${removed} characters removed`;
    } else if (added > 0) {
      return `${added} characters added to page`;
    } else if (removed > 0) {
      return `${removed} characters deleted from page`;
    }
    return "";
  };

  return (
    <div className={`text-xs font-medium flex items-center ${className}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {stats}
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipText()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}