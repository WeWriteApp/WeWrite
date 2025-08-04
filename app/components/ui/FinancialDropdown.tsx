"use client";

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { formatUsdCents } from '../../utils/formatCurrency';

interface FinancialDropdownProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  title: string;
  onNavigate: () => void;
  direction?: 'southeast' | 'southwest';
  className?: string;
}

interface SpendBreakdownProps {
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
}

interface EarningsBreakdownProps {
  totalEarnings: number;
}

/**
 * FinancialDropdown - Reusable dropdown for financial displays
 * 
 * Features:
 * - Desktop: Shows on hover with tooltip-style behavior
 * - Mobile: Shows on tap, dismisses on outside click or second tap
 * - Directional positioning to avoid screen edge collisions
 */
export function FinancialDropdown({
  trigger,
  content,
  title,
  onNavigate,
  direction = 'southeast',
  className = ''
}: FinancialDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle outside clicks on mobile
  useEffect(() => {
    if (!isMobile || !isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        triggerRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isOpen]);

  const handleTriggerClick = () => {
    if (isMobile) {
      if (isOpen) {
        // Second tap - navigate
        onNavigate();
        setIsOpen(false);
      } else {
        // First tap - show dropdown
        setIsOpen(true);
      }
    } else {
      // Desktop - navigate immediately
      onNavigate();
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setIsOpen(false);
    }
  };

  // Position classes based on direction
  const positionClasses = direction === 'southeast' 
    ? 'top-full left-0 mt-2' 
    : 'top-full right-0 mt-2';

  return (
    <div 
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={handleTriggerClick}
        className="cursor-pointer"
      >
        {trigger}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute z-50 min-w-[200px] bg-popover border border-border rounded-lg shadow-lg p-3",
            "animate-in fade-in-0 zoom-in-95 duration-200",
            positionClasses
          )}
        >
          {/* Title */}
          <div className="text-sm font-medium text-foreground mb-2 text-center">
            {title}
          </div>

          {/* Content */}
          {content}
        </div>
      )}
    </div>
  );
}

/**
 * SpendBreakdown - Shows detailed spend breakdown
 */
export function SpendBreakdown({
  totalUsdCents,
  allocatedUsdCents,
  availableUsdCents
}: SpendBreakdownProps) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Total:</span>
        <span className="font-medium">{formatUsdCents(totalUsdCents)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Allocated:</span>
        <span className="font-medium text-primary">{formatUsdCents(allocatedUsdCents)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Available:</span>
        <span className="font-medium text-green-600">{formatUsdCents(availableUsdCents)}</span>
      </div>
      
      {/* Visual bar */}
      <div className="mt-3">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full flex">
            {/* Allocated portion */}
            {allocatedUsdCents > 0 && (
              <div
                className="bg-primary"
                style={{ width: `${Math.min((allocatedUsdCents / totalUsdCents) * 100, 100)}%` }}
              />
            )}
            {/* Available portion */}
            {availableUsdCents > 0 && (
              <div
                className="bg-green-500"
                style={{ width: `${Math.min((availableUsdCents / totalUsdCents) * 100, 100)}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * EarningsBreakdown - Shows earnings information
 */
export function EarningsBreakdown({
  totalEarnings
}: EarningsBreakdownProps) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Total Earned:</span>
        <span className="font-medium text-green-600">{formatUsdCents(totalEarnings * 100)}</span>
      </div>
      
      {totalEarnings === 0 && (
        <div className="text-xs text-muted-foreground text-center mt-2">
          Start creating content to earn from supporters
        </div>
      )}
    </div>
  );
}
