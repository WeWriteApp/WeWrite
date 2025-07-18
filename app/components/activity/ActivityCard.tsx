"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import PillLink from "../utils/PillLink";
import { formatRelativeTime } from "../../utils/formatRelativeTime";
import { calculateDiff, hasContentChanged as hasContentChangedAsync } from "../../utils/diffService";
import { useTheme } from "next-themes";
import { cn, interactiveCard } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { SubscriptionTierBadge } from "../ui/SubscriptionTierBadge";
import { UsernameBadge } from "../ui/UsernameBadge";
import { format } from "date-fns";
import { getPageById } from "../../firebase/database/pages";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";
import DiffPreview, { DiffStats } from "./DiffPreview";

import { navigateToPage } from "../../utils/pagePermissions";
import { useRouter } from "next/navigation";
import { setCurrentVersion } from "../../firebase/database";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { useToast } from "../ui/use-toast";
import { Button } from "../ui/button";
import { RotateCcw } from "lucide-react";


/**
 * ActivityCard component displays a single activity card
 *
 * @param {Object} activity - The activity data to display
 * @param {boolean} isCarousel - Whether this card is in a carousel
 * @param {boolean} compactLayout - Whether to use a more compact layout with less padding
 * @param {boolean} useDynamicHeight - Whether to use dynamic height on mobile (for diff cards)
 */
const ActivityCard = ({ activity, isCarousel = false, compactLayout = false, useDynamicHeight = false }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const { currentAccount } = useCurrentAccount();
  const router = useRouter();
  const [pageData, setPageData] = useState(null);
  const [currentPageName, setCurrentPageName] = useState(activity.pageName);
  const { formatDate } = useDateFormat();
  const { toast } = useToast();
  const [isRestoring, setIsRestoring] = useState(false);

  // Check if user can restore this version (is page owner and in activity context)
  const canRestore = (activity.isActivityContext || activity.isHistoryContext) &&
                    !activity.isCurrentVersion &&
                    currentAccount &&
                    pageData &&
                    currentAccount.uid === pageData.userId;

  // Handle version restoration
  const handleRestore = async (e) => {
    e.stopPropagation(); // Prevent card click

    if (!canRestore || isRestoring) return;

    setIsRestoring(true);
    try {
      const result = await setCurrentVersion(activity.pageId, activity.versionId);
      if (result) {
        toast({
          title: "Success",
          description: "Page restored to this version"});
        // Refresh the page to show the restored content
        window.location.reload();
      } else {
        toast({
          title: "Error",
          description: "Failed to restore page",
          variant: "destructive"});
      }
    } catch (err) {
      console.error('Error restoring version:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to restore page",
        variant: "destructive"});
    } finally {
      setIsRestoring(false);
    }
  };

  // Listen for page title updates
  useEffect(() => {
    const handleTitleUpdate = (event) => {
      const { pageId, newTitle } = event.detail;

      // Check if this activity card references the updated page
      if (activity.pageId === pageId) {
        console.log(`📱 ActivityCard: Updating page name in real-time: ${currentPageName} -> ${newTitle}`);
        setCurrentPageName(newTitle);
      }
    };

    window.addEventListener('page-title-updated', handleTitleUpdate);

    return () => {
      window.removeEventListener('page-title-updated', handleTitleUpdate);
    };
  }, [activity.pageId, currentPageName]);

  // Update currentPageName when activity changes
  useEffect(() => {
    setCurrentPageName(activity.pageName);
  }, [activity.pageName]);

  // Validate activity data
  useEffect(() => {
    if (!activity) {
      console.error('ActivityCard: No activity data provided');
      return;
    }
  }, [activity]);

  // Fetch page data for permission checking (only for regular page activities)
  // CIRCUIT BREAKER: Add error tracking to prevent infinite loops
  const [fetchAttempts, setFetchAttempts] = useState(0);
  const [lastError, setLastError] = useState(null);
  const maxAttempts = 3;

  useEffect(() => {
    if (activity?.pageId && currentAccount &&
        activity.activityType !== "bio_edit" &&
        activity.activityType !== "group_about_edit" &&
        fetchAttempts < maxAttempts) {

      const fetchPageData = async () => {
        try {
          // Use proper page access function instead of direct Firestore access
          const result = await getPageById(activity.pageId, currentAccount?.uid);
          if (result.pageData && !result.error) {
            setPageData(result.pageData);
            setLastError(null); // Clear error on success
          } else if (result.error) {
            // Handle access denied or page not found
            console.log(`ActivityCard: Access denied or page not found for ${activity.pageId}: ${result.error}`);
            setFetchAttempts(maxAttempts); // Stop further attempts
          }
        } catch (error) {
          // Only log actual errors, not permission denied which is expected for private pages
          if (error?.code !== 'permission-denied') {
            console.error(`Error fetching page data for ${activity.pageId}:`, error);
            setLastError(error);
          } else {
            console.log(`ActivityCard: Permission denied for page ${activity.pageId} - this is expected for private pages`);
            setLastError(null); // Don't show error to user for permission denied
          }

          setFetchAttempts(prev => prev + 1);

          // Stop retrying on certain error types
          if (error?.code === 'unavailable' || error?.code === 'permission-denied') {
            console.log(`ActivityCard: Stopping retries for page ${activity.pageId} due to ${error.code}`);
            setFetchAttempts(maxAttempts); // Stop further attempts
          }
        }
      };

      // Only fetch if we haven't hit max attempts
      if (fetchAttempts < maxAttempts) {
        fetchPageData();
      }
    }
  }, [activity?.pageId, currentAccount, activity?.activityType, fetchAttempts]);

  // Subscription feature is now always enabled
  const subscriptionEnabled = true;

  // Ensure we have valid content before generating diffs
  const hasValidContent = activity.currentContent &&
    activity.currentContent !== '[]' &&
    activity.currentContent !== '{}';

  const hasValidPrevContent = activity.previousContent &&
    activity.previousContent !== '[]' &&
    activity.previousContent !== '{}';

  // For newly created pages, adjust the display text
  const isNewPage = activity.isNewPage;
  const isTitleChange = activity.isTitleChange || false;

  // State for diff calculation using centralized service
  const [diffResult, setDiffResult] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Use pre-computed diff data from the activity API
  useEffect(() => {
    if (activity.diff) {
      // Use pre-computed diff data from the new activity system
      setDiffResult({
        added: activity.diff.added,
        removed: activity.diff.removed,
        hasChanges: activity.diff.hasChanges,
        operations: [],
        preview: null
      });
      setDiffLoading(false);
    } else if (hasValidContent) {
      // Fallback to client-side calculation for backward compatibility
      setDiffLoading(true);

      const currentContent = activity.currentContent;
      const previousContent = isNewPage ? null : activity.previousContent;

      calculateDiff(currentContent, previousContent)
        .then(result => {
          setDiffResult(result);
          setDiffLoading(false);
        })
        .catch(error => {
          console.error('Error calculating diff in ActivityCard:', error);
          setDiffResult(null);
          setDiffLoading(false);
        });
    }
  }, [activity.diff, activity.currentContent, activity.previousContent, isNewPage, hasValidContent]);

  // Extract values from diff result
  const added = diffResult?.added || 0;
  const removed = diffResult?.removed || 0;
  const hasChanges = diffResult?.hasChanges || false;

  // Note: Activity filtering is now handled at the data level in RecentPagesActivity component
  // This ensures no gaps appear in the UI while still filtering out meaningless activities

  // Handle card click to navigate to the page
  const handleCardClick = (e) => {
    e.preventDefault(); // Prevent default link behavior

    // Ensure we have a valid pageId before navigating
    if (!activity.pageId) {
      console.error('ActivityCard: Cannot navigate - missing pageId', activity);
      return;
    }

    // DEBUG: Log navigation data in development
    if (process.env.NODE_ENV === 'development') {
      console.log('ActivityCard: Card clicked, navigation data:', {
        pageId: activity.pageId,
        versionId: activity.versionId,
        isActivityContext: activity.isActivityContext || activity.isHistoryContext,
        isCurrentVersion: activity.isCurrentVersion,
        willNavigateTo: (activity.isActivityContext || activity.isHistoryContext) && activity.versionId
          ? `/${activity.pageId}/version/${activity.versionId}`
          : `/${activity.pageId}` // Always go to current page for non-activity contexts
      });
    }

    // Handle special activity types (bio_edit, group_about_edit) with direct navigation
    if (activity.activityType === "bio_edit") {
      const userId = activity.pageId.replace("user-bio-", "");
      const url = `/user/${userId}`;
      console.log('ActivityCard: Bio edit clicked, navigating to:', url);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      window.location.href = url;
      return;
    }

    if (activity.activityType === "group_about_edit") {
      const groupId = activity.pageId.replace("group-about-", "");
      const url = `/group/${groupId}`;
      console.log('ActivityCard: Group about edit clicked, navigating to:', url);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      window.location.href = url;
      return;
    }

    // For regular page activities, determine navigation based on context and version status
    if ((activity.isActivityContext || activity.isHistoryContext) && activity.versionId) {
      // From activity page - always go to version page to view that specific version
      const url = `/${activity.pageId}/version/${activity.versionId}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('ActivityCard: Activity context detected, navigating to version page:', url);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      window.location.href = url;
    } else {
      // For home page and other contexts - always go to current page
      // This ensures home page activity cards always go to /id/ regardless of version data
      // Use simple navigation to avoid permission checking issues
      const url = `/${activity.pageId}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('ActivityCard: Non-activity context, navigating to main page:', url);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      window.location.href = url;
    }
  };

  // Create the URL for this activity
  let activityUrl;
  if (activity.activityType === "bio_edit") {
    // Bio edits link to the user profile
    const userId = activity.pageId.replace("user-bio-", "");
    activityUrl = `/user/${userId}`;
  } else if (activity.activityType === "group_about_edit") {
    // Group about edits link to the group page
    const groupId = activity.pageId.replace("group-about-", "");
    activityUrl = `/group/${groupId}`;
  } else {
    // Regular page edits - determine URL based on context
    if ((activity.isActivityContext || activity.isHistoryContext) && activity.versionId) {
      // From activity page - always link to version page
      activityUrl = `/${activity.pageId}/version/${activity.versionId}`;
    } else {
      // For home page and other contexts - always go to current page
      // This ensures home page activity cards always go to /id/ regardless of version data
      activityUrl = `/${activity.pageId}`;
    }
  }

  // Determine if this card has diff content (for dynamic height on mobile)
  const hasDiffContent = diffResult && (diffResult.added > 0 || diffResult.removed > 0);

  return (
    <div
      className={cn(
        "w-full border border-theme-strong rounded-xl shadow-sm dark:bg-card/90 dark:hover:bg-card/100 hover:bg-muted/30 cursor-pointer no-underline bg-card overflow-hidden",
        // Mobile: dynamic height for diff cards, fixed height for others; Desktop: always fixed height
        useDynamicHeight && hasDiffContent
          ? "min-h-[160px] md:h-[200px]" // Dynamic height on mobile for diff cards
          : "min-h-[160px] md:h-[200px]", // Fixed minimum height for all others
        "flex flex-col",
        // Mobile-first padding with better spacing
        "p-5 md:p-4",
        // Ensure proper spacing between cards (handled by grid gap)
        "md:mb-0"
      )}
      style={{ transform: 'none' }}
      onClick={handleCardClick}
    >
      {/* Header section with fixed height */}
      <div className="flex flex-col w-full flex-shrink-0">
        {/* Page title with fixed height and ellipsis */}
        <div className="flex-shrink-0 min-w-0 overflow-hidden h-[48px]">
          <PillLink href={activityUrl}>
            {currentPageName && isExactDateFormat(currentPageName)
              ? formatDate(new Date(currentPageName))
              : (currentPageName || "Untitled page")}
          </PillLink>
        </div>

        {/* User and timestamp info */}
        <div className="flex justify-between items-center w-full mt-1 flex-shrink-0">
          <div className="text-xs">
            {activity.groupId && activity.groupName ? (
              <>
                <span className="text-foreground">
                  {isNewPage ? "created in" : isTitleChange ? "renamed in" : "edited in"}{" "}
                </span>
                <Link
                  href={`/group/${activity.groupId}`}
                  className="hover:underline text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  {activity.groupName}
                </Link>
              </>
            ) : (
              <>
                <span className="text-foreground">
                  {isNewPage ? "created by" : isTitleChange ? "renamed by" : "edited by"}{" "}
                </span>
                {/* Don't make user links clickable for sample data */}
                {activity.isSample ? (
                  <span className="text-primary">
                    {activity.username || "Missing username"}
                  </span>
                ) : (
                  <UsernameBadge
                    userId={activity.userId}
                    username={activity.username || "Missing username"}
                    tier={activity.tier}
                    subscriptionStatus={activity.subscriptionStatus}
                    subscriptionAmount={activity.subscriptionAmount}
                    size="sm"
                    showBadge={true}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex"
                  />
                )}
              </>
            )}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 ml-auto cursor-pointer">
                  {formatRelativeTime(activity.timestamp)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <span>
                  {activity.timestamp ? formatDate(new Date(activity.timestamp)) : ""}
                </span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Content section with flex-grow to fill remaining space */}
      <div className="flex flex-col flex-grow mt-3 justify-between">
        {/* Enhanced text diff preview showing both additions and deletions */}
        <div className={cn(
          "relative min-w-0 overflow-hidden",
          // Dynamic height on mobile for diff cards, fixed height otherwise
          useDynamicHeight && hasDiffContent
            ? "min-h-[70px] md:h-[70px]" // Dynamic height on mobile, fixed on desktop
            : "h-[70px]" // Fixed height for all others
        )}>
          {isTitleChange ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground italic">
              Page title was changed
            </div>
          ) : (
            <DiffPreview
              currentContent={activity.currentContent}
              previousContent={isNewPage ? null : activity.previousContent}
              textDiff={{
                preview: activity.diffPreview, // Use stored diff preview
                added: activity.diff?.added || 0,
                removed: activity.diff?.removed || 0,
                hasChanges: activity.diff?.hasChanges || false
              }}
              isNewPage={isNewPage}
            />
          )}
        </div>

        {/* Character count stats positioned at the bottom of the card with proper padding */}
        <div className="flex-shrink-0 pb-2 pt-2 px-1 border-t border-border/20 mt-auto">
          <div className="flex justify-between items-center">
            {isTitleChange ? (
              <div className="text-xs text-muted-foreground">
                Title change
              </div>
            ) : (
              <DiffStats
                added={added}
                removed={removed}
                isNewPage={isNewPage}
                showTooltips={true}
              />
            )}

            {/* Restore button for activity context */}
            {canRestore && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                disabled={isRestoring}
                className="ml-2 h-6 px-2 text-xs"
              >
                {isRestoring ? (
                  <>
                    <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full mr-1" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restore
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityCard;