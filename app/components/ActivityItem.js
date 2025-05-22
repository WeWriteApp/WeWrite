"use client";
import Link from "next/link";
import { PillLink } from "./PillLink";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { generateSimpleDiff, generateTextDiff } from "../utils/generateTextDiff";
import DiffPreview, { DiffStats } from "./DiffPreview";

/**
 * ActivityCard component displays a single activity card
 */
const ActivityCard = ({ activity }) => {
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
      href={`/${activity.pageId}`}
      className="block rounded-lg p-4 bg-card border-0 shadow-none max-w-md"
      style={{ transform: 'none' }}
    >
      <div className="flex justify-between items-center gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <PillLink href={`/${activity.pageId}`} variant="primary">
            {activity.pageName || "Untitled page"}
          </PillLink>
          <span className="text-xs">
            {activity.groupId && activity.groupName ? (
              <>
                <span className="text-foreground">edited in{" "}</span>
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
                <span className="text-foreground">edited by{" "}</span>
                <Link
                  href={`/user/${activity.userId}`}
                  className="hover:underline text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  {activity.username || "anonymous"}
                </Link>
              </>
            )}
          </span>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 ml-1">
          {formatRelativeTime(activity.timestamp)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="relative flex-grow min-w-0 max-h-16">
          <DiffPreview
            textDiff={textDiff}
            isNewPage={false}
            className="relative"
          />
        </div>

        <div className="flex-shrink-0 ml-1">
          <DiffStats
            added={added}
            removed={removed}
            isNewPage={false}
            showTooltips={false}
          />
        </div>
      </div>
    </Link>
  );
};

export default ActivityCard;
