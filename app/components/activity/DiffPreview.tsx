"use client";

import React, { useEffect, useState } from 'react';
import { DiffPreview as DiffPreviewType, calculateDiff } from '../../utils/diffService';

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
 * 5. Page Activity Views (/[id]/activity) - activity/page.js → ActivityCard.js
 *
 * Benefits of Standardization:
 * - Consistency: All activity cards display diffs identically
 * - Maintainability: Single source of truth for diff display logic
 * - Reusability: Components can be easily reused in new contexts
 * - Accessibility: Consistent color coding and styling across the app
 * - Performance: Optimized diff algorithm with proper context handling
 *
 * @param {Object} props
 * @param {any} props.currentContent - Current content for diff calculation
 * @param {any} props.previousContent - Previous content for diff calculation
 * @param {Object} props.textDiff - Pre-calculated diff object (optional, for backward compatibility)
 * @param {boolean} props.isNewPage - Whether this is a new page creation
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showInlineStats - Whether to show diff stats inline with the preview
 * @param {number} props.added - Number of characters added (for inline stats)
 * @param {number} props.removed - Number of characters removed (for inline stats)
 */
export default function DiffPreview({
  currentContent,
  previousContent,
  textDiff,
  isNewPage = false,
  className = "",
  showInlineStats = false,
  added = 0,
  removed = 0
}) {
  const [diffPreview, setDiffPreview] = useState<DiffPreviewType | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate diff using centralized service when content is provided
  useEffect(() => {
    // Only calculate diff if we have actual content (not null or undefined)
    if (currentContent && previousContent !== undefined) {
      setLoading(true);
      calculateDiff(currentContent, previousContent)
        .then(result => {
          setDiffPreview(result.preview);
          setLoading(false);
        })
        .catch(error => {
          console.error('Error calculating diff preview:', error);
          setDiffPreview(null);
          setLoading(false);
        });
    } else if (textDiff?.preview) {
      // Use pre-calculated diff for backward compatibility
      setDiffPreview(textDiff.preview);
    }
  }, [currentContent, previousContent, textDiff]);

  // Use the calculated preview or fallback to textDiff
  const preview = diffPreview || textDiff?.preview;
  // Show loading state
  if (loading) {
    return (
      <div className={`text-xs text-muted-foreground h-full flex items-center ${className}`}>
        Calculating diff...
      </div>
    );
  }

  // Handle special change types (location, custom date)
  if (typeof preview === 'string') {
    // Check if it's a special change type preview
    if (preview.includes('location') || preview.includes('date')) {
      return (
        <div className={`text-xs h-full flex items-center ${className}`}>
          <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-xs font-medium">
            {preview}
          </span>
        </div>
      );
    }
  }

  // If no diff data, show fallback message (but avoid redundancy for new pages)
  if (!preview) {
    return (
      <div className={`text-xs text-muted-foreground h-full flex items-center justify-center ${className}`}>
        {isNewPage ? (
          <span className="italic">Content preview unavailable</span>
        ) : (
          "Page edited"
        )}
      </div>
    );
  }

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

        {/* Inline diff stats */}
        {showInlineStats && (
          <span className="ml-2 font-medium">
            <DiffStats
              added={added}
              removed={removed}
              isNewPage={isNewPage}
              showTooltips={true}
              className="inline-flex"
            />
          </span>
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
    // For special change types (location, custom date), show a different indicator
    if (added === 0 && removed === 0 && !isNewPage) {
      // This might be a special change type (location, custom date)
      return (
        <span className="text-blue-600 dark:text-blue-400">●</span>
      );
    }

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