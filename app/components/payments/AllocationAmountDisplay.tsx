"use client";

import React, { useState, useEffect } from 'react';
import { formatUsdCents } from '../../utils/formatCurrency';
import { cn } from '../../lib/utils';

interface AllocationAmountDisplayProps {
  allocationCents: number;
  availableBalanceCents?: number;
  variant?: 'page' | 'user';
  className?: string;
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
  className
}: AllocationAmountDisplayProps) {
  const [previousAmount, setPreviousAmount] = useState(allocationCents);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    // Check if we're going from 0 to positive (trigger flash)
    const wasZero = previousAmount === 0;
    const isNowPositive = allocationCents > 0;
    const shouldFlash = wasZero && isNowPositive;

    if (shouldFlash) {
      setShowFlash(true);
      // Remove flash after animation completes
      const timer = setTimeout(() => setShowFlash(false), 600);
      return () => clearTimeout(timer);
    }

    setPreviousAmount(allocationCents);
  }, [allocationCents, previousAmount]);

  // Determine what to display
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
          textColorClass,
          showFlash && "animate-flash-background"
        )}
      >
        {displayText}
      </div>
    </div>
  );
}

// CSS animations are defined in app/styles/pledge-bar-animations.css
