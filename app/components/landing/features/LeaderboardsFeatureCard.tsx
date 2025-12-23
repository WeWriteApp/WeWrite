"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '../../../lib/utils';

/**
 * LeaderboardsFeatureCard Component
 *
 * Shows a simplified preview of the leaderboards feature with top writers
 */
export default function LeaderboardsFeatureCard() {
  const leaderboardEntries = [
    {
      rank: 1,
      username: 'storyteller42',
      score: '$127.50',
      iconName: 'Trophy' as const,
      bgColor: 'bg-amber-500/15',
      textColor: 'text-amber-600 dark:text-amber-400',
      iconColor: 'text-amber-500'
    },
    {
      rank: 2,
      username: 'thoughtsbyj',
      score: '$89.25',
      iconName: 'Trophy' as const,
      bgColor: 'bg-gray-400/15',
      textColor: 'text-gray-600 dark:text-gray-400',
      iconColor: 'text-gray-400'
    },
    {
      rank: 3,
      username: 'wanderer_writes',
      score: '$64.00',
      iconName: 'Trophy' as const,
      bgColor: 'bg-amber-700/15',
      textColor: 'text-amber-700 dark:text-amber-500',
      iconColor: 'text-amber-700 dark:text-amber-600'
    }
  ];

  return (
    <div className="flex flex-col gap-2 py-2">
      {leaderboardEntries.map((entry) => {
        return (
          <div
            key={entry.rank}
            className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card"
          >
            {/* Rank badge and username */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full",
                entry.bgColor
              )}>
                <Icon name={entry.iconName} size={16} className={entry.iconColor} />
              </div>
              <div>
                <div className="font-medium text-sm">@{entry.username}</div>
                <div className="text-xs text-muted-foreground">Rank #{entry.rank}</div>
              </div>
            </div>
            {/* Earnings */}
            <div className={cn(
              "text-sm font-semibold tabular-nums",
              entry.textColor
            )}>
              {entry.score}
            </div>
          </div>
        );
      })}
    </div>
  );
}
