"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PillLink } from "../utils/PillLink";
import { formatRelativeTime } from "../../utils/formatRelativeTime";
import { calculateDiff } from "../../utils/diffService";
import DiffPreview, { DiffStats } from "./DiffPreview";
import { SubscriptionTierBadge } from "../ui/SubscriptionTierBadge";

/**
 * ActivityCard component displays a single activity card
 */
const ActivityCard = ({ activity }) => {
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
    } else if (activity.currentContent) {
      // Fallback to client-side calculation for backward compatibility
      setDiffLoading(true);

      calculateDiff(activity.currentContent, activity.previousContent)
        .then(result => {
          setDiffResult(result);
          setDiffLoading(false);
        })
        .catch(error => {
          console.error('Error calculating diff in ActivityItem:', error);
          setDiffResult(null);
          setDiffLoading(false);
        });
    }
  }, [activity.diff, activity.currentContent, activity.previousContent]);

  // Extract values from diff result
  const added = diffResult?.added || 0;
  const removed = diffResult?.removed || 0;

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
                <span className="inline-flex items-center gap-1">
                  <Link
                    href={`/user/${activity.userId}`}
                    className="hover:underline text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {activity.username || "anonymous"}
                  </Link>
                  <SubscriptionTierBadge
                    tier={activity.tier}
                    status={activity.subscriptionStatus}
                    amount={activity.subscriptionAmount}
                    size="sm"
                  />
                </span>
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
            currentContent={activity.currentContent}
            previousContent={activity.previousContent}
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