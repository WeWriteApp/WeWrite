"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { PillLink } from "./PillLink";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { generateSimpleDiff, generateTextDiff } from "../utils/generateTextDiff";
import { useTheme } from "next-themes";
import { cn, interactiveCard } from "../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

/**
 * ActivityCard component displays a single activity card
 */
const ActivityCard = ({ activity, isCarousel = false }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

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
    <Link
      href={`/${activity.pageId}`}
      className={interactiveCard(
        "w-full md:max-w-[400px] h-full",
        isCarousel && "h-full flex flex-col"
      )}
    >
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-none max-w-[75%]">
            <PillLink href={`/${activity.pageId}`} className="max-w-full">
              {activity.pageName || "Untitled page"}
            </PillLink>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            {formatRelativeTime(activity.timestamp)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground truncate">
          {isNewPage ? "created by" : "edited by"} {" "}
          <Link
            href={`/user/${activity.userId}`}
            className="hover:underline text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            {activity.username || "anonymous"}
          </Link>
        </span>
      </div>

      <div className={cn(
        "mt-2 flex items-center justify-between gap-3",
        isCarousel && "flex-grow"
      )}>
        <div className="relative flex-grow min-w-0">
          {textDiff && textDiff.preview && (
            <div className="text-xs overflow-hidden relative">
              {/* Text content */}
              <div className="overflow-x-hidden text-ellipsis max-h-16">
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
    </Link>
  );
};

export default ActivityCard;
