"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PillLink } from "./PillLink";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { generateSimpleDiff, generateTextDiff } from "../utils/generateTextDiff";
import { useTheme } from "next-themes";
import { cn, interactiveCard } from "../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { SupporterIcon } from "./SupporterIcon";
import { format } from "date-fns";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * ActivityCard component displays a single activity card
 *
 * @param {Object} activity - The activity data to display
 * @param {boolean} isCarousel - Whether this card is in a carousel
 * @param {boolean} compactLayout - Whether to use a more compact layout with less padding
 */
const ActivityCard = ({ activity, isCarousel = false, compactLayout = false }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);

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

  // Check if subscription feature is enabled
  useEffect(() => {
    const checkSubscriptionFeature = async () => {
      try {
        const featureFlagsRef = doc(db, 'config', 'featureFlags');
        const featureFlagsDoc = await getDoc(featureFlagsRef);

        if (featureFlagsDoc.exists()) {
          const flagsData = featureFlagsDoc.data();
          setSubscriptionEnabled(flagsData.subscription_management === true);
        }
      } catch (error) {
        console.error('Error checking subscription feature flag:', error);
      }
    };

    checkSubscriptionFeature();
  }, []);

  // Ensure we have valid content before generating diffs
  const hasValidContent = activity.currentContent &&
    activity.currentContent !== '[]' &&
    activity.currentContent !== '{}';

  const hasValidPrevContent = activity.previousContent &&
    activity.previousContent !== '[]' &&
    activity.previousContent !== '{}';

  const { added, removed } = hasValidContent ? generateSimpleDiff(
    activity.currentContent,
    activity.previousContent
  ) : { added: 0, removed: 0 };

  const textDiff = hasValidContent ? generateTextDiff(
    activity.currentContent,
    activity.previousContent
  ) : null;

  // For newly created pages, adjust the display text
  const isNewPage = activity.isNewPage;

  // Handle card click to navigate to the page
  const handleCardClick = (e) => {
    e.preventDefault(); // Prevent default link behavior

    // Ensure we have a valid pageId before navigating
    if (!activity.pageId) {
      console.error('ActivityCard: Cannot navigate - missing pageId', activity);
      return;
    }

    // Construct the URL based on whether we have a versionId
    const url = activity.versionId ? `/${activity.pageId}/version/${activity.versionId}` : `/${activity.pageId}`;

    console.log('ActivityCard clicked, navigating to:', url);

    // Force a hard navigation using window.location.href
    // This bypasses any router issues and ensures the navigation works
    window.location.href = url;
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
    // Regular page edits
    activityUrl = activity.versionId
      ? `/${activity.pageId}/version/${activity.versionId}`
      : `/${activity.pageId}`;
  }

  return (
    <div
      className={cn(
        "w-full wewrite-card border-0 shadow-none cursor-pointer no-underline",
        isCarousel ? "h-[180px]" : "h-[180px]", // Fixed height for all cards
        "flex flex-col",
        compactLayout ? "p-4" : "p-4" // Consistent padding
      )}
      style={{ transform: 'none' }}
      onClick={handleCardClick}
    >
      {/* Header section with fixed height */}
      <div className="flex flex-col w-full flex-shrink-0">
        {/* Page title with fixed height and ellipsis */}
        <div className="flex-shrink-0 min-w-0 overflow-hidden h-[48px]">
          <PillLink href={`/${activity.pageId}`}>
            {activity.pageName || "Untitled page"}
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
                  {activity.timestamp ? format(new Date(activity.timestamp), "yyyy MM/dd hh:mm:ss a") : ""}
                </span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Content section with flex-grow to fill remaining space */}
      <div className="flex flex-col flex-grow mt-3 justify-between">
        {/* Text diff preview with fixed height */}
        <div className="relative flex-grow min-w-0 h-[60px] overflow-hidden">
          {textDiff && textDiff.preview ? (
            <div className="text-xs overflow-hidden h-full">
              {/* Text content */}
              <div className="overflow-x-hidden text-ellipsis line-clamp-3">
                <span className="text-muted-foreground dark:text-slate-300">...</span>
                <span className="text-muted-foreground dark:text-slate-300">{textDiff.preview.beforeContext}</span>
                {textDiff.preview.isNew ? (
                  <span className="bg-green-50 dark:bg-green-900/40 text-green-500 dark:text-green-300 px-0.5 rounded">
                    {textDiff.preview.highlightedText}
                  </span>
                ) : textDiff.preview.isRemoved ? (
                  <span className="bg-red-50 dark:bg-red-900/40 text-red-500 dark:text-red-300 px-0.5 rounded line-through">
                    {textDiff.preview.highlightedText}
                  </span>
                ) : (
                  <span className="dark:text-white">{textDiff.preview.highlightedText}</span>
                )}
                <span className="text-muted-foreground dark:text-slate-300">{textDiff.preview.afterContext}</span>
                <span className="text-muted-foreground dark:text-slate-300">...</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground h-full flex items-center">
              {isNewPage ? "New page created" : "Page edited"}
            </div>
          )}
        </div>

        {/* Footer with character count stats */}
        <div className="flex-shrink-0 text-xs font-medium flex items-center justify-end mt-2">
          {added > 0 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-green-600 dark:text-green-400">+{added}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{added} characters added to page</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          {added > 0 && removed > 0 ? <span className="mx-1">•</span> : null}
          {removed > 0 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-red-600 dark:text-red-400">-{removed}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{removed} characters deleted from page</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          {added === 0 && removed === 0 && (
            <span className="text-muted-foreground">No changes</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityCard;
