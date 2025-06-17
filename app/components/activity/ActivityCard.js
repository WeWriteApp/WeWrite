"use client";
import React, { useContext, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import PillLink from "../utils/PillLink";
import { formatRelativeTime } from "../../utils/formatRelativeTime";
import { generateSimpleDiff, generateTextDiff, extractTextContent } from "../../utils/generateTextDiff";
import { useTheme } from "next-themes";
import { cn, interactiveCard } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { SupporterIcon } from "../payments/SupporterIcon";
import { format } from "date-fns";
import { getPageById } from "../../firebase/database/pages";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";
import DiffPreview, { DiffStats } from "./DiffPreview";
import { useFeatureFlag } from "../../utils/feature-flags";
import { AuthContext } from "../../providers/AuthProvider";
import { navigateToPage } from "../../utils/pagePermissions";
import { useRouter } from "next/navigation";
import { setCurrentVersion } from "../../firebase/database";
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
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [pageData, setPageData] = useState(null);
  const { formatDate, formatDateString } = useDateFormat();
  const { toast } = useToast();
  const [isRestoring, setIsRestoring] = useState(false);

  // Check if user can restore this version (is page owner and in history context)
  const canRestore = activity.isHistoryContext &&
                    !activity.isCurrentVersion &&
                    user &&
                    pageData &&
                    user.uid === pageData.userId;

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
          description: "Page restored to this version",
        });
        // Refresh the page to show the restored content
        window.location.reload();
      } else {
        toast({
          title: "Error",
          description: "Failed to restore page",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error restoring version:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to restore page",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  };

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
    if (activity?.pageId && user &&
        activity.activityType !== "bio_edit" &&
        activity.activityType !== "group_about_edit" &&
        fetchAttempts < maxAttempts) {

      const fetchPageData = async () => {
        try {
          // Use proper page access function instead of direct Firestore access
          const result = await getPageById(activity.pageId, user?.uid);
          if (result.pageData && !result.error) {
            setPageData(result.pageData);
            setLastError(null); // Clear error on success
          } else if (result.error) {
            // Handle access denied or page not found
            console.log(`ActivityCard: Access denied or page not found for ${activity.pageId}: ${result.error}`);
            setFetchAttempts(maxAttempts); // Stop further attempts
          }
        } catch (error) {
          console.error('Error fetching page data for permissions:', error);
          setFetchAttempts(prev => prev + 1);
          setLastError(error);

          // Stop retrying on certain error types
          if (error?.code === 'unavailable' || error?.code === 'permission-denied') {
            console.warn(`ActivityCard: Stopping retries for page ${activity.pageId} due to ${error.code}`);
            setFetchAttempts(maxAttempts); // Stop further attempts
          }
        }
      };

      // Only fetch if we haven't hit max attempts
      if (fetchAttempts < maxAttempts) {
        fetchPageData();
      }
    }
  }, [activity?.pageId, user, activity?.activityType, fetchAttempts]);

  // Use the reactive feature flag hook instead of manual Firestore check
  const subscriptionEnabled = useFeatureFlag('payments', user?.email, user?.uid);

  // Ensure we have valid content before generating diffs
  const hasValidContent = activity.currentContent &&
    activity.currentContent !== '[]' &&
    activity.currentContent !== '{}';

  const hasValidPrevContent = activity.previousContent &&
    activity.previousContent !== '[]' &&
    activity.previousContent !== '{}';

  // For newly created pages, adjust the display text
  const isNewPage = activity.isNewPage;

  // Calculate diffs differently for new pages vs edited pages
  let added = 0;
  let removed = 0;
  let textDiff = null;

  if (isNewPage && hasValidContent) {
    // For new pages, count all content as added
    const contentLength = extractTextContent(activity.currentContent).length;
    added = contentLength;
    removed = 0;
    textDiff = generateTextDiff(activity.currentContent, null);
  } else if (hasValidContent) {
    // For edited pages, calculate the diff normally
    const diffResult = generateSimpleDiff(activity.currentContent, activity.previousContent);
    added = diffResult.added;
    removed = diffResult.removed;
    textDiff = generateTextDiff(activity.currentContent, activity.previousContent);
  }

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
        isHistoryContext: activity.isHistoryContext,
        isCurrentVersion: activity.isCurrentVersion,
        willNavigateTo: activity.isHistoryContext && activity.versionId
          ? `/${activity.pageId}/version/${activity.versionId}`
          : `/${activity.pageId}` // Always go to current page for non-history contexts
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
    if (activity.isHistoryContext && activity.versionId) {
      // From history page - always go to version page to view that specific version
      const url = `/${activity.pageId}/version/${activity.versionId}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('ActivityCard: History context detected, navigating to version page:', url);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      window.location.href = url;
    } else {
      // For home page and other contexts - always go to current page
      // This ensures home page activity cards always go to /id/ regardless of version data
      // Use simple navigation to avoid permission checking issues
      const url = `/${activity.pageId}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('ActivityCard: Non-history context, navigating to main page:', url);
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
    if (activity.isHistoryContext && activity.versionId) {
      // From history page - always link to version page
      activityUrl = `/${activity.pageId}/version/${activity.versionId}`;
    } else {
      // For home page and other contexts - always go to current page
      // This ensures home page activity cards always go to /id/ regardless of version data
      activityUrl = `/${activity.pageId}`;
    }
  }

  // Determine if this card has diff content (for dynamic height on mobile)
  const hasDiffContent = textDiff && (textDiff.added?.length > 0 || textDiff.removed?.length > 0);

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
            {activity.pageName && isExactDateFormat(activity.pageName)
              ? formatDateString(activity.pageName)
              : (activity.pageName || "Untitled page")}
          </PillLink>
        </div>

        {/* User and timestamp info */}
        <div className="flex justify-between items-center w-full mt-1 flex-shrink-0">
          <div className="text-xs">
            {activity.groupId && activity.groupName ? (
              <>
                <span className="text-foreground">{isNewPage ? "created in" : "edited in"}{" "}</span>
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
                <span className="text-foreground">{isNewPage ? "created by" : "edited by"}{" "}</span>
                {/* Don't make user links clickable for sample data */}
                {activity.isSample ? (
                  <span className="text-primary">
                    {activity.username || "Missing username"}
                  </span>
                ) : (
                  <span className="text-primary">
                    <Link
                      href={`/user/${activity.userId}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {activity.username || "Missing username"}
                    </Link>
                    {subscriptionEnabled && (
                      <SupporterIcon
                        tier={activity.tier}
                        status={activity.subscriptionStatus}
                        size="sm"
                      />
                    )}
                  </span>
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
          <DiffPreview
            textDiff={textDiff}
            isNewPage={isNewPage}
          />
        </div>

        {/* Character count stats positioned at the bottom of the card with proper padding */}
        <div className="flex-shrink-0 pb-2 pt-2 px-1 border-t border-border/20 mt-auto">
          <div className="flex justify-between items-center">
            <DiffStats
              added={added}
              removed={removed}
              isNewPage={isNewPage}
              showTooltips={true}
            />

            {/* Restore button for history context */}
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
