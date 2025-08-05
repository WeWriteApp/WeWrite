'use client';

import React from 'react';
import { formatUsdCents, centsToDollars } from '../../utils/formatCurrency';

interface RemainingFundsDisplayProps {
  allocatedUsdCents: number;
  totalUsdCents: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  onClick?: () => void;
}

/**
 * RemainingFundsDisplay - Shows remaining USD with pie chart visualization
 *
 * This component displays the amount of USD remaining for the user to spend
 * with a pie chart showing allocation progress. Used when user is NOT overspending.
 * Turns orange when 90% allocated.
 */
export function RemainingFundsDisplay({
  allocatedUsdCents,
  totalUsdCents,
  size = 28,
  strokeWidth = 2.5,
  className = '',
  onClick
}: RemainingFundsDisplayProps) {
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
    <div className={`inline-flex items-center gap-2 cursor-pointer ${className}`} onClick={onClick} title={titleText}>
      {/* Pie Chart - outside the chip */}
      <div className="relative flex items-center">
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

      {/* Dollar amount chip - separate from pie chart */}
      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-semibold">
        <span>{displayText}</span>
      </div>
    </div>
  );
}

interface OverspendWarningDisplayProps {
  overspendUsdCents: number;
  className?: string;
  onClick?: () => void;
}

/**
 * OverspendWarningDisplay - Shows overspend amount with warning icon
 *
 * This component displays the overspend amount with a warning icon to the right.
 * Used when user is overspending their budget.
 */
export function OverspendWarningDisplay({
  overspendUsdCents,
  className = '',
  onClick
}: OverspendWarningDisplayProps) {
  const titleText = `Overspending by ${formatUsdCents(overspendUsdCents)} - Click to adjust spending`;

  return (
    <div
      className={`inline-flex items-center gap-2 cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors text-sm font-semibold px-2.5 py-0.5 rounded-full border-transparent ${className}`}
      onClick={onClick}
      title={titleText}
    >
      {/* Overspend amount */}
      <span>
        +{formatUsdCents(overspendUsdCents)}
      </span>

      {/* Filled warning icon to the right */}
      <svg
        className="h-4 w-4"
        fill="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}

/**
 * Legacy RemainingUsdCounter component for backward compatibility
 * @deprecated Use RemainingFundsDisplay instead
 */
export function RemainingUsdCounter({
  allocatedUsdCents,
  totalUsdCents,
  size = 28,
  strokeWidth = 2.5,
  className = '',
  onClick
}: RemainingFundsDisplayProps) {
  return (
    <RemainingFundsDisplay
      allocatedUsdCents={allocatedUsdCents}
      totalUsdCents={totalUsdCents}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      onClick={onClick}
    />
  );
}

/**
 * Legacy TokensCounter component for backward compatibility
 * @deprecated Use RemainingFundsDisplay instead
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
    <RemainingFundsDisplay
      allocatedUsdCents={allocatedUsdCents}
      totalUsdCents={totalUsdCents}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      onClick={onClick}
    />
  );
}
