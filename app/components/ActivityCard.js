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
import { db } from "../firebase/database";

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

  return (
    <div
      className={interactiveCard(
        "w-full h-full",
        isCarousel && "h-full flex flex-col",
        compactLayout && "p-2" // Reduce padding for compact layout
      )}
    >
      <div className={cn(
        "flex flex-col gap-1.5 w-full overflow-hidden",
        compactLayout ? "mb-1" : "mb-2" // Reduce margin for compact layout
      )}>
        <div className="flex flex-col w-full">
          <div className="flex justify-between items-center w-full">
            <div className="flex-shrink min-w-0 max-w-[70%] overflow-hidden">
              <PillLink href={`/${activity.pageId}`} className="max-w-full">
                {activity.pageName || "Untitled page"}
              </PillLink>
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
          <div className={cn(
            "text-xs text-muted-foreground truncate",
            compactLayout ? "mt-1" : "mt-1.5" // Reduce margin for compact layout
          )}>
            {isNewPage ? "created by" : "edited by"} {" "}
            <Link
              href={`/user/${activity.userId}`}
              className="hover:underline text-primary inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {activity.username || "anonymous"}
              {subscriptionEnabled && (
                <SupporterIcon
                  tier={activity.tier}
                  status={activity.subscriptionStatus}
                  size="sm"
                />
              )}
            </Link>
          </div>
        </div>
      </div>
      <div className={cn(
        "flex items-center justify-between gap-3",
        isCarousel && "flex-grow",
        compactLayout ? "mt-1" : "mt-2" // Reduce margin for compact layout
      )}>
        <div className="relative flex-grow min-w-0">
          {textDiff && textDiff.preview && (
            <div className="text-xs overflow-hidden relative">
              {/* Text content */}
              <div className={cn(
                "overflow-x-hidden text-ellipsis",
                compactLayout ? "max-h-12" : "max-h-16" // Reduce height for compact layout
              )}>
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
          )}
        </div>
        <div className="flex-shrink-0 text-xs font-medium flex items-center ml-1">
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
        </div>
      </div>
    </div>
  );
};

export default ActivityCard;
