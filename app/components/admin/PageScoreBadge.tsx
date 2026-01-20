/**
 * Page Score Badge Component
 *
 * Displays a color-coded badge indicating page quality level.
 * Used in admin page lists and page detail views.
 * Note: LOWER scores = BETTER quality (opposite of risk scoring)
 *
 * Quality Levels:
 * - 0-25:  Green  (Excellent - well-connected, community-engaged)
 * - 26-50: Blue   (Good - some engagement)
 * - 51-75: Yellow (Fair - limited community connection)
 * - 76-100: Red   (Poor - isolated or low-quality)
 *
 * @see app/services/PageScoringService.ts
 */

'use client';

import React from 'react';
import { Badge } from '../ui/badge';
import { Icon } from '../ui/Icon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  PAGE_SCORE_THRESHOLDS,
  PAGE_SCORE_LEVELS,
  getPageScoreLevelFromScore
} from '../../constants/page-scoring';

export type PageScoreLevel = 'excellent' | 'good' | 'fair' | 'poor';

interface PageScoreBadgeProps {
  score: number | null | undefined;
  level?: PageScoreLevel;
  showScore?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

function levelToConfig(level: PageScoreLevel): {
  variant: 'success-secondary' | 'default' | 'warning-secondary' | 'destructive-secondary' | 'outline-static';
  label: string;
  icon: string;
  description: string;
} {
  switch (level) {
    case 'excellent':
      return {
        variant: 'success-secondary',
        label: 'Excellent',
        icon: 'Star',
        description: 'Well-connected page with strong community engagement.',
      };
    case 'good':
      return {
        variant: 'default',
        label: 'Good',
        icon: 'ThumbsUp',
        description: 'Page has some community engagement and connections.',
      };
    case 'fair':
      return {
        variant: 'warning-secondary',
        label: 'Fair',
        icon: 'Minus',
        description: 'Limited community connection. Could benefit from more internal links.',
      };
    case 'poor':
      return {
        variant: 'destructive-secondary',
        label: 'Poor',
        icon: 'AlertTriangle',
        description: 'Isolated page with few connections. May indicate low-quality or spam content.',
      };
  }
}

export function PageScoreBadge({
  score,
  level: providedLevel,
  showScore = true,
  showTooltip = true,
  size = 'md',
  onClick,
  className = '',
}: PageScoreBadgeProps) {
  // Handle null/undefined score
  if (score === null || score === undefined) {
    return (
      <Badge variant="outline-static" className={`text-muted-foreground ${className}`}>
        <Icon name="HelpCircle" size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12} className="mr-1" />
        N/A
      </Badge>
    );
  }

  const level = providedLevel || getPageScoreLevelFromScore(score);
  const config = levelToConfig(level);

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  };

  const iconSize = size === 'sm' ? 10 : size === 'lg' ? 14 : 12;

  const badge = (
    <Badge
      variant={config.variant}
      className={`${sizeClasses[size]} ${onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
      onClick={onClick}
    >
      <Icon name={config.icon} size={iconSize} className="mr-1" />
      {showScore ? `${score}` : config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-1">
              <Icon name={config.icon} size={14} />
              Quality: {config.label} ({score}/100)
            </div>
            <p className="text-xs text-muted-foreground">
              {config.description}
            </p>
            <p className="text-xs text-muted-foreground border-t pt-1 mt-1">
              Lower scores = better quality. Based on link patterns and community engagement.
            </p>
            {onClick && (
              <p className="text-xs text-primary">Click for detailed breakdown</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline page score indicator for compact spaces
 */
export function PageScoreIndicator({
  score,
  className = '',
}: {
  score: number | null | undefined;
  className?: string;
}) {
  if (score === null || score === undefined) {
    return <span className={`text-muted-foreground ${className}`}>-</span>;
  }

  const level = getPageScoreLevelFromScore(score);

  const colorClasses: Record<PageScoreLevel, string> = {
    excellent: 'text-green-600 dark:text-green-400',
    good: 'text-blue-600 dark:text-blue-400',
    fair: 'text-yellow-600 dark:text-yellow-400',
    poor: 'text-red-600 dark:text-red-400',
  };

  return (
    <span className={`font-medium ${colorClasses[level]} ${className}`}>
      {score}
    </span>
  );
}

export default PageScoreBadge;
