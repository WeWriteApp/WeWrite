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
  size?: number;
  strokeWidth?: number;
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
  onClick,
  size = 28,
  strokeWidth = 2.5
}: OverspendWarningDisplayProps) {
  const titleText = `Overspending by ${formatUsdCents(overspendUsdCents)} - Click to adjust spending`;

  // Calculate circle properties for filled orange pie chart
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={`inline-flex items-center gap-2 cursor-pointer transition-colors ${className}`}
      onClick={onClick}
      title={titleText}
    >
      {/* Filled orange pie chart */}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
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
          {/* Filled orange circle (100% filled) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(249 115 22)" // orange-500
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={0} // 100% filled
            className="transition-all duration-300 ease-out"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* "Out" text chip */}
      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full border-transparent bg-orange-500 text-white hover:bg-orange-600 transition-colors text-sm font-semibold">
        <span>Out</span>
      </div>
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
