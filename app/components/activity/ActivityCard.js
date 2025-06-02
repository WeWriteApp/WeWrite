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
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";
import DiffPreview, { DiffStats } from "./DiffPreview";
import { useFeatureFlag } from "../../utils/feature-flags";
import { AuthContext } from "../../providers/AuthProvider";
import { navigateToPage } from "../../utils/pagePermissions";
import { useRouter } from "next/navigation";

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

  // Debug activity data
  useEffect(() => {
    if (!activity) {
      console.error('ActivityCard: No activity data provided');
      return;
    }

    // More detailed logging to debug the issue with newer items not being clickable
    console.log('ActivityCard: Rendering activity', {
      pageId: activity.pageId,
      pageName: activity.pageName,
      userId: activity.userId,
      username: activity.username,
      timestamp: activity.timestamp,
      versionId: activity.versionId,
      href: activity.versionId ? `/${activity.pageId}/version/${activity.versionId}` : `/${activity.pageId}`,
      isNewPage: activity.isNewPage,
      fullActivity: { ...activity }
    });
  }, [activity]);

  // Fetch page data for permission checking (only for regular page activities)
  useEffect(() => {
    if (activity?.pageId && user &&
        activity.activityType !== "bio_edit" &&
        activity.activityType !== "group_about_edit") {
      const fetchPageData = async () => {
        try {
          const pageRef = doc(db, 'pages', activity.pageId);
          const pageDoc = await getDoc(pageRef);
          if (pageDoc.exists()) {
            setPageData({ id: activity.pageId, ...pageDoc.data() });
          }
        } catch (error) {
          console.error('Error fetching page data for permissions:', error);
        }
      };

      fetchPageData();
    }
  }, [activity?.pageId, user, activity?.activityType]);

  // Use the reactive feature flag hook instead of manual Firestore check
  const subscriptionEnabled = useFeatureFlag('payments', user?.email);

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

    // For regular page activities, determine navigation based on version status
    if (activity.versionId && !activity.isCurrentVersion) {
      // Past version links should go to the version page
      const url = `/${activity.pageId}/version/${activity.versionId}`;
      console.log('ActivityCard: Past version clicked, navigating to version page:', url);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      window.location.href = url;
    } else {
      // Current version or no version ID should use click-to-edit functionality for main page
      console.log('ActivityCard: Current version clicked, using click-to-edit navigation to main page');
      navigateToPage(activity.pageId, user, pageData, user?.groups, router);
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
    // Regular page edits - current version goes to main page, past versions go to version page
    activityUrl = (activity.versionId && !activity.isCurrentVersion)
      ? `/${activity.pageId}/version/${activity.versionId}`
      : `/${activity.pageId}`;
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
          <PillLink href={`/${activity.pageId}`}>
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
          <DiffStats
            added={added}
            removed={removed}
            isNewPage={isNewPage}
            showTooltips={true}
          />
        </div>
      </div>
    </div>
  );
};

export default ActivityCard;
