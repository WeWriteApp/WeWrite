"use client";
import React, { useState, useEffect } from "react";
import { Icon } from '@/components/ui/Icon';
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
import { getPageById } from "../../utils/apiClient";
import { sanitizeUsername } from "../../utils/usernameSecurity";
import { useAuth } from '../../providers/AuthProvider';
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";
import DiffPreview, { DiffStats } from "./DiffPreview";

import { navigateToPage } from "../../utils/pagePermissions";
import { useRouter } from "next/navigation";
import { setCurrentVersion } from "../../utils/apiClient";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { useToast } from "../ui/use-toast";
import { Button } from "../ui/button";
import { AllocationControls } from "../payments/AllocationControls";
import { useFeatureFlags } from "../../contexts/FeatureFlagContext";


/**
 * ActivityCard component displays a single activity card
 *
 * @param {Object} activity - The activity data to display
 * @param {boolean} isCarousel - Whether this card is in a carousel
 * @param {boolean} compactLayout - Whether to use a more compact layout with less padding
 */
const ActivityCard = ({ activity, isCarousel = false, compactLayout = false }) => {
  // Early return if no activity data
  if (!activity) {
    console.error('ActivityCard: No activity data provided');
    return null;
  }

  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const { user } = useAuth();
  const router = useRouter();
  const [pageData, setPageData] = useState(null);
  const [currentPageName, setCurrentPageName] = useState(activity?.pageName || '');
  const { formatDate } = useDateFormat();
  const { toast } = useToast();
  const { isEnabled } = useFeatureFlags();
  const showUILabels = isEnabled('ui_labels');
  const [isRestoring, setIsRestoring] = useState(false);

  // Check if user can restore this version (is page owner and in activity context)
  const canRestore = (activity.isActivityContext || activity.isHistoryContext) &&
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

    window.addEventListener('pageTitle:updated', handleTitleUpdate);

    return () => {
      window.removeEventListener('pageTitle:updated', handleTitleUpdate);
    };
  }, [activity.pageId, currentPageName]);

  // Update currentPageName when activity changes
  useEffect(() => {
    setCurrentPageName(activity?.pageName || '');
  }, [activity?.pageName]);

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
  }, [activity?.pageId, user, activity?.activityType, fetchAttempts]);

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
  const isTitleChange = activity.isTitleChange ||
                        activity.changeType === 'title_change' ||
                        activity.changeType === 'content_and_title_change' || false;

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
      window.location.href = url;
      return;
    }

    if (activity.activityType === "group_about_edit") {
      const groupId = activity.pageId.replace("group-about-", "");
      const url = `/group/${groupId}`;
      console.log('ActivityCard: Group about edit clicked, navigating to:', url);
      window.location.href = url;
      return;
    }

    // For regular page activities, determine navigation based on context and version status
    if ((activity.isActivityContext || activity.isHistoryContext) && activity.versionId) {
      // From versions page - always go to version page to view that specific version
      const url = `/${activity.pageId}/version/${activity.versionId}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('ActivityCard: Versions context detected, navigating to version page:', url);
      }
      window.location.href = url;
    } else {
      // For home page and other contexts - always go to current page
      // This ensures home page activity cards always go to /id/ regardless of version data
      // Use simple navigation to avoid permission checking issues
      const url = `/${activity.pageId}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('ActivityCard: Non-activity context, navigating to main page:', url);
      }
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
      // From versions page - always link to version page
      activityUrl = `/${activity.pageId}/version/${activity.versionId}`;
    } else {
      // For home page and other contexts - always go to current page
      // This ensures home page activity cards always go to /id/ regardless of version data
      activityUrl = `/${activity.pageId}`;
    }
  }



  return (
    <div
      className={cn(
        // Use universal card system
        "wewrite-card",
        "w-full overflow-hidden",
        "flex flex-col",
        // Reduced padding for better screen real estate
        "p-3 md:p-3",
        // Ensure proper spacing between cards (handled by grid gap)
        "md:mb-0"
      )}
      style={{ transform: 'none' }}
    >
      {/* Header section - clickable area */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex justify-between items-start w-full mb-3 cursor-pointer group/header"
              onClick={handleCardClick}
            >
              {/* Left side: Only show if we have page name or user info */}
              {(currentPageName || activity.userId) && (
                <div className="flex-1 min-w-0 pr-3">
                  {/* Page title and user info on same line, can wrap */}
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    {currentPageName && (
                      <PillLink href={activityUrl} className="flex-shrink-0">
                        {currentPageName && isExactDateFormat(currentPageName)
                          ? formatDate(new Date(currentPageName))
                          : (currentPageName || "Untitled page")}
                      </PillLink>
                    )}
                    {activity.userId && (
                      <>
                        {activity.groupId && activity.groupName ? (
                          <>
                            <span className="text-foreground whitespace-nowrap">
                              {isNewPage ? "created in" : isTitleChange ? "renamed in" : "edited in"}
                            </span>
                            <Link
                              href={`/group/${activity.groupId}`}
                              className="hover:underline text-primary flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {activity.groupName}
                            </Link>
                          </>
                        ) : (
                          <>
                            <span className="text-foreground whitespace-nowrap">
                              {isNewPage ? "created by" : isTitleChange ? "renamed by" : "edited by"}
                            </span>
                            {/* Don't make user links clickable for sample data */}
                            {activity.isSample ? (
                              <span className="text-primary flex-shrink-0">
                                {sanitizeUsername(activity.username)}
                              </span>
                            ) : (
                              <UsernameBadge
                                userId={activity.userId}
                                username={activity.username || "Missing username"}
                                tier={activity.subscriptionTier}
                                subscriptionStatus={activity.hasActiveSubscription ? 'active' : 'inactive'}
                                subscriptionAmount={activity.subscriptionAmount}
                                size="sm"
                                showBadge={true}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex flex-shrink-0"
                              />
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Right side: Timestamp */}
              <div className="flex-shrink-0">
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
                          return isNaN(date.getTime()) ? 'Invalid date' : formatDate(date);
                        } catch (error) {
                          console.error('Error formatting tooltip date:', error);
                          return 'Invalid date';
                        }
                      })() : "Unknown date"}
                    </span>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipTrigger>
          {showUILabels && (
            <TooltipContent side="top" className="text-xs">
              Header Section: Page title, author/group, and timestamp
            </TooltipContent>
          )}
        </Tooltip>

        {/* Diff preview sub-card - chunked section */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "cursor-pointer group/diff",
              // Only add bottom margin if allocation bar will be shown
              activity.userId && activity.pageId && (!user || user.uid !== activity.userId) ? "mb-3" : ""
            )} onClick={handleCardClick}>
              {/* Subtle diff container - no border, just subtle background */}
              <div className="bg-neutral-alpha-5 rounded-lg p-3 relative">
                {/* Diff counter at top right of sub-card */}
                {!isTitleChange && (added > 0 || removed > 0) && (
                  <div className="absolute top-2 right-3 z-10">
                    <DiffStats
                      added={added}
                      removed={removed}
                      isNewPage={isNewPage}
                      showTooltips={true}
                      className="text-xs"
                    />
                  </div>
                )}

                {/* Diff preview - add right padding to prevent collision with diff stats */}
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
                  showInlineStats={false}
                  added={added}
                  removed={removed}
                  className={!isTitleChange && (added > 0 || removed > 0) ? "pr-12" : ""}
                />
              </div>
            </div>
          </TooltipTrigger>
          {showUILabels && (
            <TooltipContent side="top" className="text-xs">
              Diff Section: Character additions/removals and content preview
            </TooltipContent>
          )}
        </Tooltip>

        {/* Restore button for activity context - only show if needed */}
        {canRestore && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-shrink-0 mb-3 group/restore">
                <div className="flex justify-end items-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRestore}
                    disabled={isRestoring}
                    className="h-6 px-2 text-xs"
                  >
                    {isRestoring ? (
                      <>
                        <Icon name="Loader" size={12} className="mr-1" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <Icon name="RotateCcw" size={12} className="mr-1" />
                        Restore
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TooltipTrigger>
            {showUILabels && (
              <TooltipContent side="top" className="text-xs">
                Restore Section: Revert page to this version
              </TooltipContent>
            )}
          </Tooltip>
        )}

        {/* Dollar allocation UI - show for all users' pages when not viewing your own */}
        {activity.userId && activity.pageId && (!user || user.uid !== activity.userId) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="group/allocation">
                <AllocationControls
                  pageId={activity.pageId}
                  authorId={activity.userId}
                  pageTitle={currentPageName}
                  source="HomePage"
                  className="w-full"
                  hideAvailableText={activity.isCarouselCard}
                />
              </div>
            </TooltipTrigger>
            {showUILabels && (
              <TooltipContent side="top" className="text-xs">
                Allocation Section: Support this author with tokens
              </TooltipContent>
            )}
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
};

export default ActivityCard;
