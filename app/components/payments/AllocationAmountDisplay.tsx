"use client";

import React, { useState, useEffect } from 'react';
import { formatUsdCents } from '../../utils/formatCurrency';
import { cn } from '../../lib/utils';

interface AllocationAmountDisplayProps {
  allocationCents: number;
  availableBalanceCents?: number;
  variant?: 'page' | 'user';
  className?: string;
  flashType?: 'accent' | 'red' | null;
  allocationIntervalCents?: number;
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
  allocationIntervalCents = 10 // Default to $0.10
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
        <div className="text-center font-bold text-sm text-white">
          {prefix}{intervalFormatted}
        </div>
      </div>
    );
  }

  const hasAllocation = allocationCents > 0;
  const displayText = hasAllocation
    ? `${formatUsdCents(allocationCents)}/mo to ${variant}`
    : `Available: ${formatUsdCents(availableBalanceCents)}`;

  // Color based on whether there's an allocation
  const textColorClass = hasAllocation ? "text-primary" : "text-muted-foreground";

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out max-h-8 mb-2",
        className
      )}
    >
      <div
        className={cn(
          "text-center font-bold text-sm transition-all duration-300 ease-in-out",
          textColorClass
        )}
      >
        {displayText}
      </div>
    </div>
  );
}

// CSS animations are defined in app/styles/pledge-bar-animations.css
