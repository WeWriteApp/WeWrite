"use client";

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { formatUsdCents } from '../../utils/formatCurrency';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from './dropdown-menu';

interface FinancialDropdownProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  title: string;
  onNavigate: () => void;
  onClose?: () => void;
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
  pendingEarnings?: number;
  lastMonthEarnings?: number;
  monthlyChange?: number;
}

/**
 * FinancialDropdown - Reusable dropdown for financial displays
 *
 * Now uses the main dropdown component for consistent animations and behavior
 */
export function FinancialDropdown({
  trigger,
  content,
  title,
  onNavigate,
  onClose,
  direction = 'southeast',
  className = ''
}: FinancialDropdownProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <div
          ref={triggerRef}
          className={cn("cursor-pointer", className)}
          data-dropdown-trigger="true"
          data-dropdown-id={`financial-${title.toLowerCase()}`}
          aria-expanded={isOpen}
          // Remove onClick - no more click-to-navigate behavior
          // Dropdown opens on click, navigation happens via button
        >
          {trigger}
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={direction === 'southeast' ? 'start' : 'end'}
        className="w-auto min-w-[200px] max-w-[280px] p-3"
      >
        {/* Title */}
        <div className="text-sm font-medium text-foreground mb-3 text-center">
          {title}
        </div>

        {/* Content */}
        <div className="mb-3">
          {content}
        </div>

        <DropdownMenuSeparator />

        {/* Buttons - Always horizontal layout */}
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (onClose) onClose();
            }}
            className="flex-1 whitespace-nowrap"
          >
            Close
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onNavigate();
            }}
            className="flex-1 whitespace-nowrap"
          >
            {title === 'Spending' ? 'Go to spend' : 'Go to earnings'}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
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
 * EarningsBreakdown - Shows detailed earnings information
 */
export function EarningsBreakdown({
  totalEarnings,
  pendingEarnings = 0,
  lastMonthEarnings = 0,
  monthlyChange = 0
}: EarningsBreakdownProps) {
  const changeIsPositive = monthlyChange > 0;
  const changeIsNegative = monthlyChange < 0;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Total Earned:</span>
        <span className="font-medium text-green-600">{formatUsdCents(totalEarnings * 100)}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-muted-foreground">Pending:</span>
        <span className="font-medium text-orange-600">{formatUsdCents(pendingEarnings * 100)}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-muted-foreground">Last Month:</span>
        <span className="font-medium">{formatUsdCents(lastMonthEarnings * 100)}</span>
      </div>

      {monthlyChange !== 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Change:</span>
          <span className={`font-medium flex items-center gap-1 ${
            changeIsPositive ? 'text-green-600' : changeIsNegative ? 'text-red-600' : 'text-muted-foreground'
          }`}>
            {changeIsPositive && '↗'}
            {changeIsNegative && '↘'}
            {formatUsdCents(Math.abs(monthlyChange) * 100)}
          </span>
        </div>
      )}

      {totalEarnings === 0 && (
        <div className="text-xs text-muted-foreground text-center mt-3 pt-2 border-t border-border">
          Start creating content to earn from supporters
        </div>
      )}
    </div>
  );
}
