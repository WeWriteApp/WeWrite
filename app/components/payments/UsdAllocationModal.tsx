"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Minus, DollarSign } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { PieChart, PieChartSegment } from '../ui/pie-chart';
import { formatUsdCents, dollarsToCents, centsToDollars, parseDollarInputToCents } from '../../utils/formatCurrency';
import { USD_UI_TEXT } from '../../utils/usdConstants';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useDemoBalance, useShouldUseDemoBalance } from '../../contexts/DemoBalanceContext';
import { toast } from '../ui/use-toast';

interface UsdAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: string;
  pageTitle: string;
  authorId?: string;
  currentAllocation: number; // in cents
  onAllocationChange: (newAllocationCents: number) => Promise<void>;
  isUserAllocation?: boolean;
  username?: string;
}

export function UsdAllocationModal({
  isOpen,
  onClose,
  pageId,
  pageTitle,
  authorId,
  currentAllocation,
  onAllocationChange,
  isUserAllocation = false,
  username
}: UsdAllocationModalProps) {
  const { usdBalance } = useUsdBalance();
  const { hasActiveSubscription } = useSubscription();
  const shouldUseDemoBalance = useShouldUseDemoBalance(hasActiveSubscription);
  const { demoBalance, isDemoBalance } = useDemoBalance();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incrementAmount, setIncrementAmount] = useState(0.50); // Default $0.50 increment

  // Initialize input value when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(centsToDollars(currentAllocation).toFixed(2));
      setError(null);
    }
  }, [isOpen, currentAllocation]);

  // Increment amount options in dollars
  const incrementOptions = [0.10, 0.50, 1.00, 2.50];

  // Load saved increment amount from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('usdIncrementAmount');
    if (saved) {
      const amount = parseFloat(saved);
      if (amount > 0) {
        setIncrementAmount(amount);
      }
    }
  }, []);

  // Save increment amount to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('usdIncrementAmount', incrementAmount.toString());
  }, [incrementAmount]);

  const handlePlusClick = () => {
    const currentCents = parseDollarInputToCents(inputValue) || 0;
    const incrementCents = dollarsToCents(incrementAmount);
    const newCents = currentCents + incrementCents;
    setInputValue(centsToDollars(newCents).toFixed(2));
    setError(null);
  };

  const handleMinusClick = () => {
    const currentCents = parseDollarInputToCents(inputValue) || 0;
    const incrementCents = dollarsToCents(incrementAmount);
    const newCents = Math.max(0, currentCents - incrementCents);
    setInputValue(centsToDollars(newCents).toFixed(2));
    setError(null);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setError(null);
  };

  const handleSave = async () => {
    const newAllocationCents = parseDollarInputToCents(inputValue);

    if (newAllocationCents === null) {
      setError('Please enter a valid dollar amount');
      return;
    }

    if (newAllocationCents < 0) {
      setError('Amount cannot be negative');
      return;
    }

    // Check if user has enough available funds
    const currentBalance = shouldUseDemoBalance ? demoBalance : usdBalance;
    const availableUsdCents = currentBalance?.availableUsdCents || 0;
    const allocationDifference = newAllocationCents - currentAllocation;

    if (allocationDifference > availableUsdCents) {
      setError(`Insufficient funds. You have ${formatUsdCents(availableUsdCents)} available.`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onAllocationChange(newAllocationCents);

      toast({
        title: "Allocation Updated",
        description: `${formatUsdCents(newAllocationCents)} allocated to ${isUserAllocation ? username : pageTitle}`,
        duration: 3000,
      });

      onClose();
    } catch (error) {
      console.error('Error updating allocation:', error);
      setError('Failed to update allocation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentBalance = shouldUseDemoBalance ? demoBalance : usdBalance;
  const totalUsdCents = currentBalance?.totalUsdCents || 0;

  // Build pie chart segments
  const buildPieChartSegments = (): PieChartSegment[] => {
    if (!currentBalance) return [];

    const newAllocationCents = parseDollarInputToCents(inputValue) || 0;
    const totalCents = currentBalance.totalUsdCents;
    const originalAllocatedCents = currentBalance.allocatedUsdCents;

    // Calculate other pages allocation (all allocations except current page)
    const otherFromAllocated = Math.max(0, originalAllocatedCents - currentAllocation);
    const otherFromBalances = Math.max(0, totalCents - currentBalance.availableUsdCents - newAllocationCents);
    const otherPagesCents = Math.max(otherFromAllocated, otherFromBalances);

    // Calculate available funds for current page
    const availableFundsForCurrentPage = Math.max(0, totalCents - otherPagesCents);

    // Split new allocation into funded and overfunded portions
    const newPageFundedCents = Math.min(newAllocationCents, availableFundsForCurrentPage);
    const newPageOverfundedCents = Math.max(0, newAllocationCents - availableFundsForCurrentPage);

    // Calculate available funds after new allocation
    const newAvailableCents = Math.max(0, totalCents - otherPagesCents - newPageFundedCents);

    const segments: PieChartSegment[] = [];

    // Order: This page first, Other allocations second, Available to spend third

    // Current page funded (primary) - FIRST
    if (newPageFundedCents > 0) {
      segments.push({
        id: 'current',
        value: newPageFundedCents,
        label: isUserAllocation ? username || 'This user' : 'This page',
        color: 'stroke-primary',
        bgColor: 'bg-primary',
        textColor: 'text-primary',
      });
    }

    // Overfunded portion (orange) - after current page
    if (newPageOverfundedCents > 0) {
      segments.push({
        id: 'overfunded',
        value: newPageOverfundedCents,
        label: 'Overspent',
        color: 'stroke-orange-500',
        bgColor: 'bg-orange-500',
        textColor: 'text-orange-500',
      });
    }

    // Other pages (light neutral - matches allocation bar) - SECOND
    if (otherPagesCents > 0) {
      segments.push({
        id: 'other',
        value: otherPagesCents,
        label: 'Other allocations',
        color: 'stroke-neutral-alpha-15',
        bgColor: 'bg-neutral-alpha-15',
        textColor: 'text-muted-foreground',
      });
    }

    // Available to spend (green) - THIRD/LAST
    if (newAvailableCents > 0) {
      segments.push({
        id: 'available',
        value: newAvailableCents,
        label: 'Available to spend',
        color: 'stroke-green-500',
        bgColor: 'bg-green-500',
        textColor: 'text-green-500',
      });
    }

    return segments;
  };

  const pieChartSegments = buildPieChartSegments();

  // Check if out of funds
  const isOutOfFunds = (() => {
    const newAllocationCents = parseDollarInputToCents(inputValue) || 0;
    const remainingUsdCents = Math.max(0, totalUsdCents - Math.max(currentAllocation, newAllocationCents));
    return remainingUsdCents === 0 && totalUsdCents > 0;
  })();

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      hashId="allocation-details"
      analyticsId="allocation_details_modal"
    >
      <DialogContent className="max-w-md max-h-[90vh]" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {isUserAllocation ? `Allocate to ${username}` : 'Page Allocation Details'}
          </DialogTitle>
          <DialogDescription>
            {isUserAllocation ? `Direct support for ${username}` : pageTitle}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Demo Balance Notice */}
          {isDemoBalance && (
            <div className="bg-muted/50 dark:bg-muted/20 border border-border dark:border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-muted/500 rounded-full"></div>
                <span className="text-sm font-medium text-primary dark:text-muted-foreground">
                  Demo Mode - $10/mo
                </span>
              </div>
              <p className="text-xs text-primary dark:text-muted-foreground">
                {!hasActiveSubscription
                  ? "Activate your subscription to make these allocations real"
                  : "Try the allocation system with demo funds"
                }
              </p>
            </div>
          )}

          {/* Pie Chart Allocation Overview */}
          {pieChartSegments.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Allocation Overview</Label>
              <PieChart
                segments={pieChartSegments}
                size={120}
                strokeWidth={16}
                showPercentage={true}
                centerLabel="allocated"
                formatValue={(value) => formatUsdCents(value)}
                showTotal={true}
                totalLabel="Monthly budget"
                gap={6}
                cornerRadius={3}
              />
            </div>
          )}

          {/* Out of funds message with link */}
          {isOutOfFunds && (
            <div className="bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-orange-800 dark:text-orange-200">
                  You've allocated your full monthly budget
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    window.location.href = '/settings/fund-account';
                  }}
                  className="text-orange-800 dark:text-orange-200 border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                >
                  Add more funds
                </Button>
              </div>
            </div>
          )}

          {/* Increment Amount Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Plus/Minus Increment</Label>
            <div className="grid grid-cols-4 gap-2">
              {incrementOptions.map((amount) => (
                <Button
                  key={amount}
                  variant={incrementAmount === amount ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIncrementAmount(amount)}
                  className="text-xs"
                >
                  ${amount.toFixed(2)}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom amount input with plus/minus buttons */}
          <div>
            <Label htmlFor="amount" className="text-sm font-medium">
              Custom Amount
            </Label>
            <div className="flex items-center space-x-2 mt-2">
              {/* Minus button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleMinusClick}
                disabled={isLoading || (parseDollarInputToCents(inputValue) || 0) === 0}
                className="h-10 w-10 p-0 flex-shrink-0"
              >
                <Minus className="h-4 w-4" />
              </Button>

              {/* Input field */}
              <Input
                id="amount"
                type="text"
                placeholder="0.00"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                leftIcon={<DollarSign className="h-4 w-4" />}
                wrapperClassName="flex-1"
                disabled={isLoading}
              />

              {/* Plus button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePlusClick}
                disabled={isLoading}
                className="h-10 w-10 p-0 flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>

          {/* USD info */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
            <p>{USD_UI_TEXT.TOOLTIP_TEXT}</p>
          </div>
        </DialogBody>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 sm:flex-initial"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 sm:flex-initial bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? 'Saving...' : 'Save Allocation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
