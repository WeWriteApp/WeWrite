"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Minus, DollarSign } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { formatUsdCents, dollarsToCents, centsToDollars, parseDollarInputToCents } from '../../utils/formatCurrency';
import { USD_UI_TEXT } from '../../utils/usdConstants';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useDemoBalance, useShouldUseDemoBalance } from '../../contexts/DemoBalanceContext';
import { toast } from '../ui/use-toast';
import { ALLOCATION_BAR_STYLES } from '../../constants/allocation-styles';

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
  const [mounted, setMounted] = useState(false);
  const [incrementAmount, setIncrementAmount] = useState(0.50); // Default $0.50 increment

  // Ensure we're mounted on the client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize input value when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(centsToDollars(currentAllocation).toFixed(2));
      setError(null);
    }
  }, [isOpen, currentAllocation]);

  // Quick allocation amounts in dollars
  const quickAmounts = [0.00, 0.01, 0.10, 1.00, 5.00, 10.00];

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

  const handleQuickAmount = (dollarAmount: number) => {
    setInputValue(dollarAmount.toFixed(2));
    setError(null);
  };

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

  const handleRemoveAllocation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await onAllocationChange(0);
      
      toast({
        title: "Allocation Removed",
        description: `Removed allocation from ${isUserAllocation ? username : pageTitle}`,
        duration: 3000,
      });
      
      onClose();
    } catch (error) {
      console.error('Error removing allocation:', error);
      setError('Failed to remove allocation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const currentBalance = shouldUseDemoBalance ? demoBalance : usdBalance;
  const availableUsdCents = currentBalance?.availableUsdCents || 0;
  const totalUsdCents = currentBalance?.totalUsdCents || 0;

  const modalContent = (
    <div
      className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold">
              {isUserAllocation ? `Allocate to ${username}` : 'Page Allocation Details'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isUserAllocation ? `Direct support for ${username}` : pageTitle}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-10 w-10 p-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-0">
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



          {/* Four-Section Allocation Overview */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Allocation Overview</Label>

            {(() => {
              const currentBalance = shouldUseDemoBalance ? demoBalance : usdBalance;
              if (!currentBalance) return null;

              const newAllocationCents = parseDollarInputToCents(inputValue) || 0;
              const totalCents = currentBalance.totalUsdCents;
              const originalAllocatedCents = currentBalance.allocatedUsdCents;

              // Calculate other pages allocation (all allocations except current page)
              const otherPagesCents = Math.max(0, originalAllocatedCents - currentAllocation);

              // Calculate available funds for current page
              const availableFundsForCurrentPage = Math.max(0, totalCents - otherPagesCents);

              // Split new allocation into funded and overfunded portions
              const newPageFundedCents = Math.min(newAllocationCents, availableFundsForCurrentPage);
              const newPageOverfundedCents = Math.max(0, newAllocationCents - availableFundsForCurrentPage);

              // Calculate available funds after new allocation
              const newAvailableCents = Math.max(0, totalCents - otherPagesCents - newPageFundedCents);

              // For display purposes, show all sections proportionally
              const displayTotal = totalCents + newPageOverfundedCents;

              const otherPagesPercentage = displayTotal > 0 ? (otherPagesCents / displayTotal) * 100 : 0;
              const currentPageFundedPercentage = displayTotal > 0 ? (newPageFundedCents / displayTotal) * 100 : 0;
              const currentPageOverfundedPercentage = displayTotal > 0 ? (newPageOverfundedCents / displayTotal) * 100 : 0;
              const availablePercentage = displayTotal > 0 ? (newAvailableCents / displayTotal) * 100 : 0;

              return (
                <div className="space-y-2">
                  {/* Four-Section Composition Bar */}
                  <div className="h-6 flex gap-1 bg-muted rounded-md overflow-hidden">
                    {/* OTHER - Other pages (grey, leftmost) */}
                    {otherPagesPercentage > 0 && (
                      <div
                        className={`${ALLOCATION_BAR_STYLES.sections.other} transition-all duration-300`}
                        style={{ width: `${otherPagesPercentage}%` }}
                      />
                    )}

                    {/* CURRENT - Current page funded portion (accent color) */}
                    {currentPageFundedPercentage > 0 && (
                      <div
                        className="bg-primary transition-all duration-300"
                        style={{ width: `${currentPageFundedPercentage}%` }}
                      />
                    )}

                    {/* OVERSPENT - Current page overfunded portion (orange) */}
                    {currentPageOverfundedPercentage > 0 && (
                      <div
                        className="bg-orange-500 transition-all duration-300"
                        style={{ width: `${currentPageOverfundedPercentage}%` }}
                      />
                    )}

                    {/* AVAILABLE - Available funds (empty, rightmost) */}
                    {availablePercentage > 0 && (
                      <div
                        className="bg-muted-foreground/10 transition-all duration-300"
                        style={{ width: `${availablePercentage}%` }}
                      />
                    )}
                  </div>

                  {/* Legend with values from the bar */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-muted-foreground/30 rounded-full"></div>
                      <span className="text-muted-foreground">Other: {formatUsdCents(otherPagesCents)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-primary rounded-full"></div>
                      <span className="text-muted-foreground">Current: {formatUsdCents(newPageFundedCents)}</span>
                    </div>
                    {newPageOverfundedCents > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-muted-foreground">Overspent: {formatUsdCents(newPageOverfundedCents)}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-muted-foreground/10 rounded-full"></div>
                      <span className="text-muted-foreground">Available: {newAvailableCents <= 0 ? 'Out' : formatUsdCents(newAvailableCents)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Out of funds message with link */}
          {(() => {
              const newAllocationCents = parseDollarInputToCents(inputValue) || 0;
              const remainingUsdCents = Math.max(0, totalUsdCents - Math.max(currentAllocation, newAllocationCents));

              if (remainingUsdCents === 0 && totalUsdCents > 0) {
                return (
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
                );
              }
              return null;
          })()}

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
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="text"
                  placeholder="0.00"
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="wewrite-input-with-left-icon"
                  disabled={isLoading}
                />
              </div>

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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border flex-shrink-0">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? 'Saving...' : 'Save Allocation'}
          </Button>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document body level
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
