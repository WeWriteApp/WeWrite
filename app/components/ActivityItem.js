"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { PillLink } from "./PillLink";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { generateSimpleDiff, generateTextDiff } from "../utils/generateTextDiff";
import { useTheme } from "next-themes";
import { cn } from "../lib/utils";

/**
 * ActivityCard component displays a single activity card
 */
const ActivityCard = ({ activity }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  const { added, removed } = generateSimpleDiff(
    activity.currentContent,
    activity.previousContent
  );
  const textDiff = generateTextDiff(
    activity.currentContent,
    activity.previousContent
  );

  return (
    <Link 
      href={`/page/${activity.pageId}`}
      className="block border border-border/40 rounded-lg transition-all duration-200 p-3 hover:bg-accent/5 hover:shadow-md dark:hover:bg-accent/10 dark:bg-slate-800/50 max-w-md"
    >
      <div className="flex justify-between items-center gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <PillLink href={`/page/${activity.pageId}`} variant="primary">
            {activity.pageName || "Untitled page"}
          </PillLink>
          <span className="text-xs text-muted-foreground">
            edited by {" "}
            <Link 
              href={`/user/${activity.userId}`} 
              className="hover:underline text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {activity.username || "anonymous"}
            </Link>
          </span>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 ml-1">
          {formatRelativeTime(activity.timestamp)}
        </span>
      </div>
      
      <div className="mt-2 flex items-center justify-between gap-3">
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
          {added > 0 ? <span className="text-green-600 dark:text-green-400">+{added}</span> : null}
          {added > 0 && removed > 0 ? <span className="mx-1">•</span> : null}
          {removed > 0 ? <span className="text-red-600 dark:text-red-400">-{removed}</span> : null}
        </div>
      </div>
    </Link>
  );
};

export default ActivityCard;
