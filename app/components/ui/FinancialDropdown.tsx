"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { cn } from '../../lib/utils';
import { formatUsdCents } from '../../utils/formatCurrency';
import { Button } from './button';
import { AlertCircle } from 'lucide-react';

/**
 * Simple Financial Dropdown - Clean implementation
 */

interface FinancialDropdownProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  title: string;
  onNavigate: () => void;
  onClose?: () => void;
  direction?: 'southeast' | 'southwest';
  className?: string;
  showNavigationButton?: boolean;
  isDemo?: boolean;
  demoMessage?: string;
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
  onRefresh?: () => void;
}

export function FinancialDropdown({
  trigger,
  content,
  title,
  onNavigate,
  onClose,
  direction = 'southeast',
  className = '',
  showNavigationButton = true,
  isDemo = false,
  demoMessage = 'Demo Mode: Sign up to use real funds!'
}: FinancialDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false); // For enter animation
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate dropdown position synchronously
  const calculatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const contentWidth = 260;
      
      let left = direction === 'southeast' 
        ? rect.left 
        : rect.right - contentWidth;
      
      left = Math.max(8, Math.min(left, window.innerWidth - contentWidth - 8));
      
      return {
        top: rect.bottom + 8,
        left
      };
    }
    return null;
  }, [direction]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both the trigger container and the dropdown
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setIsAnimating(false);
        setPosition(null);
        onClose?.();
      }
    };

    // Delay adding listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsAnimating(false);
        setPosition(null);
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const openDropdown = () => {
    // Calculate position BEFORE opening
    const pos = calculatePosition();
    if (pos) {
      setPosition(pos);
      setIsOpen(true);
      // Trigger animation after a frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    }
  };

  const closeDropdown = () => {
    setIsAnimating(false);
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsOpen(false);
      setPosition(null);
      onClose?.();
    }, 150);
  };

  const toggleDropdown = () => {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  // Dropdown content to be portaled
  const dropdownContent = position && (
    <div
      ref={dropdownRef}
      className="fixed w-[260px] transition-all duration-150 ease-out"
      style={{
        top: position.top,
        left: position.left,
        zIndex: 99999,
        opacity: isAnimating ? 1 : 0,
        transform: isAnimating ? 'translateY(0)' : 'translateY(-8px)',
      }}
    >
      {/* WeWrite card with glassmorphic passthrough blur */}
      <div className="wewrite-card card-80">
        <div className="text-sm font-medium text-foreground mb-3 text-center">
          {title}
        </div>

        <div className="mb-3">
          {content}
        </div>

        {showNavigationButton && (
          <>
            <div className="border-t border-gray-200/50 dark:border-white/10 my-3" />
            <div className="space-y-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  closeDropdown();
                  onNavigate();
                }}
                className="w-full"
              >
                {title.includes('Spending') ? 'Spend breakdown' : 'Go to earnings'}
              </Button>

              {title.includes('Spending') && (
                <Button
                  size="sm"
                  onClick={() => {
                    closeDropdown();
                    router.push('/settings/fund-account');
                  }}
                  className="w-full"
                >
                  Top off account
                </Button>
              )}
            </div>
          </>
        )}

        {/* Demo mode notice */}
        {isDemo && (
          <>
            <div className="border-t border-gray-200/50 dark:border-white/10 my-3" />
            <div className="text-xs text-muted-foreground bg-gray-100/50 dark:bg-white/5 p-2 rounded text-center">
              {demoMessage}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative inline-flex items-center h-full", className)}>
      {/* Trigger - clicking toggles dropdown */}
      <div
        className="cursor-pointer flex items-center h-full"
        onClick={toggleDropdown}
        role="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {trigger}
      </div>

      {/* Dropdown panel - rendered via portal for proper stacking */}
      {isOpen && mounted && typeof document !== 'undefined' && createPortal(
        dropdownContent,
        document.body
      )}
    </div>
  );
}

export function SpendBreakdown({
  totalUsdCents,
  allocatedUsdCents,
  availableUsdCents
}: SpendBreakdownProps) {
  const isOutOfFunds = availableUsdCents === 0;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Monthly subscription:</span>
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
        <span className={`font-medium ${isOutOfFunds ? 'text-orange-500' : 'text-green-600'}`}>
          {isOutOfFunds ? 'Out' : formatUsdCents(availableUsdCents)}
        </span>
      </div>
      
      <div className="mt-3">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full flex">
            {allocatedUsdCents > 0 && totalUsdCents > 0 && (
              <div
                className={isOutOfFunds ? "bg-orange-500" : "bg-primary"}
                style={{ width: `${Math.min((allocatedUsdCents / totalUsdCents) * 100, 100)}%` }}
              />
            )}
            {availableUsdCents > 0 && totalUsdCents > 0 && (
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

export function EarningsBreakdown({
  totalEarnings,
  pendingEarnings = 0,
  lastMonthEarnings = 0,
  monthlyChange = 0,
  onRefresh
}: EarningsBreakdownProps) {
  const router = useRouter();

  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Pending:</span>
        <span className="font-medium text-green-600">{formatUsdCents(pendingEarnings * 100)}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Last month:</span>
        <span className="font-medium">{formatUsdCents(lastMonthEarnings * 100)}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Lifetime:</span>
        <span className="font-medium">{formatUsdCents(totalEarnings * 100)}</span>
      </div>

      {totalEarnings === 0 && (
        <div className="text-xs text-muted-foreground text-center mt-4 pt-3 border-t">
          Start writing pages to earn from supporters
        </div>
      )}

      {/* Beta warning card */}
      <div className="mt-4 p-3 rounded-lg bg-amber-500/15 border border-amber-500/30">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Earnings are in beta
            </div>
            <div className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              Payouts are not yet available. We're working on it!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
