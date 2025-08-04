"use client";

import React, { useState, useEffect } from 'react';
import { formatUsdCents } from '../../utils/formatCurrency';
import { cn } from '../../lib/utils';

interface AllocationAmountDisplayProps {
  allocationCents: number;
  className?: string;
}

/**
 * Displays the allocation amount above pledge bars with smooth animations
 * - Shows "$x/mo" in accent color when amount > 0
 * - Hides when amount is 0
 * - Animates height changes smoothly
 * - Shows flash animation when going from 0 to positive amount
 */
export function AllocationAmountDisplay({ 
  allocationCents, 
  className 
}: AllocationAmountDisplayProps) {
  const [previousAmount, setPreviousAmount] = useState(allocationCents);
  const [showFlash, setShowFlash] = useState(false);
  const [isVisible, setIsVisible] = useState(allocationCents > 0);

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

    // Update visibility
    setIsVisible(allocationCents > 0);
    setPreviousAmount(allocationCents);
  }, [allocationCents, previousAmount]);

  return (
    <div 
      className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out",
        isVisible ? "max-h-8 mb-2" : "max-h-0 mb-0",
        className
      )}
    >
      <div 
        className={cn(
          "text-center font-bold text-sm transition-all duration-300 ease-in-out",
          "text-primary", // Accent color
          showFlash && "animate-flash-background"
        )}
      >
        {allocationCents > 0 && `${formatUsdCents(allocationCents)}/mo`}
      </div>
    </div>
  );
}

// CSS animations are defined in app/styles/pledge-bar-animations.css
