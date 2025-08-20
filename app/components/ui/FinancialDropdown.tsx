"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  showNavigationButton?: boolean;
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
  className = '',
  showNavigationButton = true
}: FinancialDropdownProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
          className={cn("cursor-pointer flex items-center", className)}
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
        sideOffset={12}
      >
        {/* Title */}
        <div className="text-sm font-medium text-foreground mb-3 text-center">
          {title}
        </div>

        {/* Content */}
        <div className="mb-3">
          {content}
        </div>

        {showNavigationButton && (
          <>
            <DropdownMenuSeparator />

            {/* Navigation buttons */}
            <div className="mt-3 space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Close dropdown before navigating
                  setIsOpen(false);
                  onNavigate();
                }}
                className="w-full whitespace-nowrap"
              >
                {title === 'Spending' ? 'Spend breakdown' : 'Go to earnings'}
              </Button>

              {title === 'Spending' && (
                <Button
                  size="sm"
                  onClick={() => {
                    // Close dropdown before navigating
                    setIsOpen(false);
                    // Navigate to fund account page
                    router.push('/settings/fund-account');
                  }}
                  className="w-full whitespace-nowrap"
                >
                  Top off account
                </Button>
              )}
            </div>
          </>
        )}
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
  // Determine if user is out of funds (available is $0.00)
  const isOutOfFunds = availableUsdCents === 0;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Total:</span>
        <span className="font-medium">{formatUsdCents(totalUsdCents)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Allocated:</span>
        <span className={`font-medium ${isOutOfFunds ? 'text-orange-600' : 'text-primary'}`}>
          {formatUsdCents(allocatedUsdCents)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Available:</span>
        <span className={`font-medium ${isOutOfFunds ? 'text-orange-600' : 'text-green-600'}`}>
          {isOutOfFunds ? 'Out' : formatUsdCents(availableUsdCents)}
        </span>
      </div>
      
      {/* Visual bar */}
      <div className="mt-3">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full flex">
            {/* Allocated portion */}
            {allocatedUsdCents > 0 && (
              <div
                className={isOutOfFunds ? "bg-orange-500" : "bg-primary"}
                style={{ width: `${Math.min((allocatedUsdCents / totalUsdCents) * 100, 100)}%` }}
              />
            )}
            {/* Available portion */}
            {availableUsdCents > 0 && (
              <div
                className={isOutOfFunds ? "bg-orange-500" : "bg-green-500"}
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
  monthlyChange = 0,
  onRefresh
}: EarningsBreakdownProps & { onRefresh?: () => void }) {
  const changeIsPositive = monthlyChange > 0;
  const changeIsNegative = monthlyChange < 0;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Pending: This month</span>
        <span className="font-medium text-green-600 ml-4">{formatUsdCents(pendingEarnings * 100)}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Earned last month</span>
        <span className="font-medium ml-4">{formatUsdCents(lastMonthEarnings * 100)}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Lifetime earnings</span>
        <span className="font-medium ml-4">{formatUsdCents(totalEarnings * 100)}</span>
      </div>

      {totalEarnings === 0 && (
        <div className="text-xs text-muted-foreground text-center mt-4 pt-3 border-t border-border">
          Start writing pages to earn from supporters
        </div>
      )}
    </div>
  );
}
