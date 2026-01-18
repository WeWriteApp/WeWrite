/**
 * Risk Score Badge Component
 *
 * Displays a color-coded badge indicating user risk level.
 * Used in admin users table and user detail views.
 *
 * Risk Levels:
 * - 0-30:  Green  (Low risk - Allow)
 * - 31-60: Yellow (Medium risk - Soft challenge)
 * - 61-85: Orange (High risk - Hard challenge)
 * - 86-100: Red   (Critical risk - Block)
 *
 * @see app/services/RiskScoringService.ts
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

export type RiskLevel = 'allow' | 'soft_challenge' | 'hard_challenge' | 'block';

interface RiskScoreBadgeProps {
  score: number | null | undefined;
  level?: RiskLevel;
  showScore?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const RISK_THRESHOLDS = {
  ALLOW: 30,
  SOFT_CHALLENGE: 60,
  HARD_CHALLENGE: 85,
};

function scoreToLevel(score: number): RiskLevel {
  if (score <= RISK_THRESHOLDS.ALLOW) return 'allow';
  if (score <= RISK_THRESHOLDS.SOFT_CHALLENGE) return 'soft_challenge';
  if (score <= RISK_THRESHOLDS.HARD_CHALLENGE) return 'hard_challenge';
  return 'block';
}

function levelToConfig(level: RiskLevel): {
  variant: 'success-secondary' | 'warning-secondary' | 'destructive-secondary' | 'outline-static';
  label: string;
  icon: string;
  description: string;
} {
  switch (level) {
    case 'allow':
      return {
        variant: 'success-secondary',
        label: 'Low',
        icon: 'ShieldCheck',
        description: 'No suspicious activity detected. User can proceed without challenges.',
      };
    case 'soft_challenge':
      return {
        variant: 'warning-secondary',
        label: 'Medium',
        icon: 'ShieldAlert',
        description: 'Some risk signals detected. User may see invisible CAPTCHA challenges.',
      };
    case 'hard_challenge':
      return {
        variant: 'destructive-secondary',
        label: 'High',
        icon: 'Shield',
        description: 'Multiple risk signals detected. User will see visible CAPTCHA challenges.',
      };
    case 'block':
      return {
        variant: 'destructive-secondary',
        label: 'Critical',
        icon: 'ShieldX',
        description: 'High-risk activity detected. User actions may be blocked pending review.',
      };
  }
}

export function RiskScoreBadge({
  score,
  level: providedLevel,
  showScore = true,
  showTooltip = true,
  size = 'md',
  className = '',
}: RiskScoreBadgeProps) {
  // Handle null/undefined score
  if (score === null || score === undefined) {
    return (
      <Badge variant="outline-static" className={`text-muted-foreground ${className}`}>
        <Icon name="HelpCircle" size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12} className="mr-1" />
        N/A
      </Badge>
    );
  }

  const level = providedLevel || scoreToLevel(score);
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
      className={`${sizeClasses[size]} ${className}`}
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
              Risk Level: {config.label} ({score}/100)
            </div>
            <p className="text-xs text-muted-foreground">
              {config.description}
            </p>
            <p className="text-xs text-muted-foreground border-t pt-1 mt-1">
              Score based on bot detection, account trust, IP reputation, and activity patterns.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline risk indicator for compact spaces
 */
export function RiskIndicator({
  score,
  className = '',
}: {
  score: number | null | undefined;
  className?: string;
}) {
  if (score === null || score === undefined) {
    return <span className={`text-muted-foreground ${className}`}>-</span>;
  }

  const level = scoreToLevel(score);

  const colorClasses: Record<RiskLevel, string> = {
    allow: 'text-green-600 dark:text-green-400',
    soft_challenge: 'text-yellow-600 dark:text-yellow-400',
    hard_challenge: 'text-orange-600 dark:text-orange-400',
    block: 'text-red-600 dark:text-red-400',
  };

  return (
    <span className={`font-medium ${colorClasses[level]} ${className}`}>
      {score}
    </span>
  );
}

export default RiskScoreBadge;
