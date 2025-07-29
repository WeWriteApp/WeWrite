'use client';

import React from 'react';

interface TokenPieChartProps {
  allocatedTokens: number;
  totalTokens: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  onClick?: () => void;
  showFraction?: boolean;
}

export function TokenPieChart({
  allocatedTokens,
  totalTokens,
  size = 32,
  strokeWidth = 3,
  className = '',
  onClick,
  showFraction = true
}: TokenPieChartProps) {
  // Calculate available tokens and check for overspending
  const availableTokens = totalTokens - allocatedTokens;
  const isOverspent = availableTokens < 0;

  // Check if user is completely out of tokens (same logic as pledge bar)
  const isOutOfTokens = availableTokens <= 0 && totalTokens > 0;

  // ENHANCEMENT: Add warning state for high allocation (same as RemainingTokensCounter - 95% threshold)
  const allocationPercentage = totalTokens > 0 ? (allocatedTokens / totalTokens) * 100 : 0;
  const isNearlyFull = allocationPercentage >= 95 && totalTokens > 0;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate funded vs unfunded tokens when overspent
  const unfundedTokens = isOverspent ? Math.abs(availableTokens) : 0;
  const fundedTokens = isOverspent ? totalTokens : allocatedTokens; // When overspent, funded = total available

  // Calculate percentages and stroke properties
  let fundedPercentage = 0;
  let unfundedPercentage = 0;
  let singlePercentage = 0;

  // Gap between segments (in percentage points)
  const gapPercentage = 8; // 8% gap for clear visual separation

  if (isOverspent && totalTokens > 0) {
    // When overspent, show greyed background and orange segment with gaps on both sides of orange
    // Reserve space for gaps before and after the orange segment (2 gaps total)
    const totalVisualPercentage = 100 - (gapPercentage * 2); // Reserve space for 2 gaps around orange
    const adjustedFundedPercentage = (fundedTokens / (fundedTokens + unfundedTokens)) * totalVisualPercentage;
    const adjustedUnfundedPercentage = (unfundedTokens / (fundedTokens + unfundedTokens)) * totalVisualPercentage;

    fundedPercentage = adjustedFundedPercentage;
    unfundedPercentage = adjustedUnfundedPercentage;
  } else if (totalTokens > 0) {
    // Normal case: single segment
    singlePercentage = Math.min((allocatedTokens / totalTokens) * 100, 100);
  }

  // Calculate stroke dash properties for segments
  const fundedStrokeDasharray = circumference;
  const fundedStrokeDashoffset = circumference - (fundedPercentage / 100) * circumference;

  const unfundedStrokeDasharray = circumference;
  // Start unfunded segment after funded segment with a small gap
  const unfundedStartOffset = (fundedPercentage + gapPercentage) / 100 * circumference;
  const unfundedStrokeDashoffset = circumference - (unfundedPercentage / 100) * circumference - unfundedStartOffset;

  const singleStrokeDasharray = circumference;
  const singleStrokeDashoffset = circumference - (singlePercentage / 100) * circumference;

  // Determine colors and title text (orange for overspent, out of tokens, or nearly full)
  const progressColor = (isOverspent || isOutOfTokens || isNearlyFull) ? 'text-orange-500' : 'text-primary';
  const titleText = isOverspent
    ? `${allocatedTokens} tokens allocated out of ${totalTokens} total monthly tokens (${unfundedTokens} tokens unfunded)`
    : `${allocatedTokens} tokens allocated out of ${totalTokens} total monthly tokens`;

  // Determine container classes - add pulsing when out of tokens
  const containerClasses = isOutOfTokens
    ? 'pulse-brightness-orange'
    : '';

  return (
    <div
      className={`flex items-center gap-2 ${onClick ? 'cursor-pointer' : ''} ${className} ${containerClasses}`}
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
          {/* No background circle for overspent state to show white gaps */}
          {!isOverspent && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-muted-foreground/20"
            />
          )}

          {isOverspent ? (
            // When overspent: show greyed out background and highlight only the orange (problematic) portion with gaps on both sides
            <>
              {/* Background circle for the full allocation (greyed out) */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={`${((fundedPercentage + unfundedPercentage) / 100) * circumference} ${circumference}`}
                strokeDashoffset={0}
                strokeLinecap="round"
                className="text-muted-foreground/30 transition-all duration-300 ease-in-out"
              />

              {/* Unfunded tokens segment (orange) - positioned with gaps on both sides */}
              {unfundedPercentage > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${(unfundedPercentage / 100) * circumference} ${circumference}`}
                  strokeDashoffset={-((fundedPercentage + gapPercentage) / 100) * circumference}
                  strokeLinecap="round"
                  className="text-orange-600 transition-all duration-300 ease-in-out"
                />
              )}
            </>
          ) : (
            // Normal case: single progress circle
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={singleStrokeDasharray}
              strokeDashoffset={singleStrokeDashoffset}
              strokeLinecap="round"
              className={`${progressColor} transition-all duration-300 ease-in-out`}
            />
          )}
        </svg>

        {/* Center is now empty - no percentage text */}
      </div>

      {/* Fraction text - only show if showFraction is true */}
      {showFraction && (
        <span className={`text-sm font-medium ${(isOverspent || isOutOfTokens) ? 'text-orange-600' : 'text-foreground'}`}>
          {isOverspent ? (
            // Show overage amount when overspent
            `+${unfundedTokens} over`
          ) : isOutOfTokens ? (
            // Show out of tokens message
            'Out of tokens'
          ) : (
            // Normal display
            `${allocatedTokens}/${totalTokens}`
          )}
        </span>
      )}
    </div>
  );
}
