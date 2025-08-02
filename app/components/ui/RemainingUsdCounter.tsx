'use client';

import React from 'react';
import { formatUsdCents, centsToDollars } from '../../utils/formatCurrency';

interface RemainingUsdCounterProps {
  allocatedUsdCents: number;
  totalUsdCents: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  onClick?: () => void;
}

/**
 * RemainingUsdCounter - Shows remaining USD with pie chart visualization
 *
 * This component displays the amount of USD remaining for the user to spend
 * with a pie chart showing allocation progress. Turns orange when 95% allocated.
 */
export function RemainingUsdCounter({
  allocatedUsdCents,
  totalUsdCents,
  size = 28,
  strokeWidth = 2.5,
  className = '',
  onClick
}: RemainingUsdCounterProps) {
  // Calculate remaining USD and allocation percentage
  const remainingUsdCents = Math.max(0, totalUsdCents - allocatedUsdCents);
  const allocationPercentage = totalUsdCents > 0 ? (allocatedUsdCents / totalUsdCents) * 100 : 0;

  // Handle loading/empty state
  const isLoadingState = totalUsdCents === 0 && allocatedUsdCents === 0;

  // Determine warning state - orange when 90% or more allocated (consistent with UsdAllocationDisplay)
  const isNearlyFull = allocationPercentage >= 90 && totalUsdCents > 0;
  const isOutOfFunds = remainingUsdCents <= 0 && totalUsdCents > 0;

  // Calculate pie chart values
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(allocationPercentage / 100) * circumference} ${circumference}`;

  // Determine colors based on allocation level
  const progressColor = isNearlyFull ? 'text-orange-500' : 'text-primary';
  const textColor = isNearlyFull ? 'text-orange-500' : 'text-foreground';
  const containerClasses = isOutOfFunds ? 'animate-pulse' : '';

  // Create title text
  const titleText = isLoadingState
    ? 'Loading USD balance...'
    : isOutOfFunds
    ? `Out of funds! ${formatUsdCents(totalUsdCents)} allocated`
    : isNearlyFull
    ? `Running low! ${formatUsdCents(remainingUsdCents)} remaining`
    : `${formatUsdCents(remainingUsdCents)} remaining of ${formatUsdCents(totalUsdCents)}`;

  // Display text - show remaining amount or "Out"
  const displayText = isLoadingState
    ? '...'
    : isOutOfFunds
    ? 'Out'
    : formatUsdCents(remainingUsdCents);

  return (
    <div
      className={`inline-flex items-center justify-center relative ${containerClasses} ${className}`}
      title={titleText}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Pie Chart Background */}
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
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
        {!isLoadingState && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className={progressColor}
            style={{
              transition: 'stroke-dasharray 0.3s ease-in-out'
            }}
          />
        )}
      </svg>


    </div>
  );
}

/**
 * Legacy TokensCounter component for backward compatibility
 * @deprecated Use RemainingUsdCounter instead
 */
export function RemainingTokensCounter({
  allocatedTokens,
  totalTokens,
  size = 28,
  strokeWidth = 2.5,
  className = '',
  onClick
}: {
  allocatedTokens: number;
  totalTokens: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  onClick?: () => void;
}) {
  // Convert tokens to USD cents for display
  const allocatedUsdCents = Math.floor(allocatedTokens / 10 * 100);
  const totalUsdCents = Math.floor(totalTokens / 10 * 100);

  return (
    <RemainingUsdCounter
      allocatedUsdCents={allocatedUsdCents}
      totalUsdCents={totalUsdCents}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      onClick={onClick}
    />
  );
}
