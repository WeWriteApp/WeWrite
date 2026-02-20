'use client';

/**
 * @deprecated This component is deprecated and will be removed in a future version.
 * Use RemainingUsdCounter instead for USD-based remaining funds display.
 *
 * Legacy remaining tokens counter - replaced by USD system.
 */

import React from 'react';

interface RemainingTokensCounterProps {
  allocatedTokens: number;
  totalTokens: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  onClick?: () => void;
}

/**
 * RemainingTokensCounter - Shows remaining tokens with pie chart visualization
 *
 * This component displays the number of tokens remaining for the user to spend
 * with a pie chart showing allocation progress. Turns orange when 95% allocated.
 */
export function RemainingTokensCounter({
  allocatedTokens,
  totalTokens,
  size = 28,
  strokeWidth = 2.5,
  className = '',
  onClick
}: RemainingTokensCounterProps) {
  // Calculate remaining tokens and allocation percentage
  const remainingTokens = Math.max(0, totalTokens - allocatedTokens);
  const allocationPercentage = totalTokens > 0 ? (allocatedTokens / totalTokens) * 100 : 0;

  // Handle loading/empty state
  const isLoadingState = totalTokens === 0 && allocatedTokens === 0;

  // Determine warning state - orange when 95% or more allocated
  const isNearlyFull = allocationPercentage >= 95 && totalTokens > 0;
  const isOutOfTokens = remainingTokens <= 0 && totalTokens > 0;

  // Calculate pie chart values
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(allocationPercentage / 100) * circumference} ${circumference}`;

  // Determine colors based on allocation level
  const progressColor = isNearlyFull ? 'text-orange-500' : 'text-primary';
  const textColor = isNearlyFull ? 'text-orange-500' : 'text-foreground';
  const containerClasses = isOutOfTokens ? 'animate-pulse' : '';

  // Create title text
  const titleText = isLoadingState
    ? 'Loading token balance...'
    : isOutOfTokens
    ? `Out of tokens! You've allocated ${allocatedTokens} out of ${totalTokens} monthly tokens. Click to upgrade.`
    : isNearlyFull
    ? `Running low! ${remainingTokens} tokens remaining out of ${totalTokens} monthly tokens (${allocationPercentage.toFixed(1)}% allocated)`
    : `${remainingTokens} tokens remaining out of ${totalTokens} monthly tokens (${allocationPercentage.toFixed(1)}% allocated)`;

  return (
    <div
      className={`flex items-center gap-2 hover:opacity-80 transition-opacity ${onClick ? 'cursor-pointer' : ''} ${className} ${containerClasses}`}
      onClick={onClick}
      title={titleText}
    >
      {/* Pie Chart SVG */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted-foreground/20"
          />

          {/* Progress circle */}
          {totalTokens > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={0}
              strokeLinecap="round"
              className={`${progressColor} transition-all duration-300 ease-in-out`}
            />
          )}

          {/* Loading state indicator */}
          {isLoadingState && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference * 0.25} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              className="text-muted-foreground animate-pulse"
            />
          )}
        </svg>
      </div>

      {/* Remaining tokens text */}
      <span className={`text-sm font-medium ${textColor}`}>
        {isLoadingState ? '...' : remainingTokens}
      </span>
    </div>
  );
}
