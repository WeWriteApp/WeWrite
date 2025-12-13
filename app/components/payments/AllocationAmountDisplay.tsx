"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatUsdCents } from '../../utils/formatCurrency';
import { cn } from '../../lib/utils';

interface AllocationAmountDisplayProps {
  allocationCents: number;
  availableBalanceCents?: number;
  variant?: 'page' | 'user';
  className?: string;
  flashType?: 'accent' | 'red' | null;
  allocationIntervalCents?: number;
  hideWhenZero?: boolean;
  isDemoBalance?: boolean;
  /** When true, shows allocation in orange with "- over budget" suffix */
  isOverBudget?: boolean;
}

/**
 * Displays allocation information above pledge bars with smooth animations
 * - Shows "Available: $x" in normal text color when allocation is 0
 * - Shows "$x/mo to page/user" in accent color when allocation > 0
 * - Always visible (no blank space when allocation is zero)
 * - Animates color and content changes smoothly
 * - Shows flash animation when going from 0 to positive amount
 */
export function AllocationAmountDisplay({
  allocationCents,
  availableBalanceCents = 0,
  variant = 'page',
  className,
  flashType = null,
  allocationIntervalCents = 10, // Default to $0.10
  hideWhenZero = false,
  isDemoBalance = false,
  isOverBudget = false
}: AllocationAmountDisplayProps) {
  // Show interval amount during flash animation
  const isFlashing = flashType !== null;

  // Determine what to display
  if (isFlashing) {
    // During flash, show the interval amount with +/- prefix
    const prefix = flashType === 'accent' ? '+' : '-';
    const intervalFormatted = formatUsdCents(allocationIntervalCents);
    return (
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out max-h-8 mb-2",
          className
        )}
      >
        <div className="text-center font-bold text-sm text-foreground">
          {prefix}{intervalFormatted}
        </div>
      </div>
    );
  }

  const hasAllocation = allocationCents > 0;

  // If hideWhenZero is true and there's no allocation, don't render anything
  if (hideWhenZero && !hasAllocation) {
    return null;
  }

  const displayText = hasAllocation
    ? `${formatUsdCents(allocationCents)}/mo to ${variant}`
    : `Available: ${formatUsdCents(availableBalanceCents)}`;

  // Color and font weight based on whether there's an allocation and budget status
  // Over budget: show in orange (warning color)
  // Normal allocation: show in primary/accent color
  // No allocation: show in muted color
  const textColorClass = isOverBudget
    ? "text-orange-500"
    : hasAllocation
      ? "text-primary"
      : "text-muted-foreground";
  const fontWeightClass = hasAllocation ? "font-bold" : "font-normal";

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out mb-2",
        isDemoBalance ? "max-h-12" : "max-h-8",
        className
      )}
    >
      <div
        className={cn(
          "text-center text-sm transition-all duration-300 ease-in-out",
          textColorClass,
          fontWeightClass
        )}
      >
        {displayText}
        {isOverBudget && hasAllocation && (
          <span className="text-orange-500"> - over budget</span>
        )}
        {isDemoBalance && (
          <span className="text-muted-foreground font-normal">
            {" (Demo funds, "}
            <Link href="/login" className="text-primary underline hover:text-primary/80">
              log in
            </Link>
            {" to make it real!)"}
          </span>
        )}
      </div>
    </div>
  );
}

// CSS animations are defined in app/styles/pledge-bar-animations.css
