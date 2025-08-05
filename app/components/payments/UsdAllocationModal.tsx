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
  const { usdBalance, isFakeBalance, hasActiveSubscription } = useUsdBalance();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [incrementAmount, setIncrementAmount] = useState(0.25); // Default $0.25 increment

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
  const incrementOptions = [0.25, 0.50, 1.00, 2.50];

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
    const availableUsdCents = usdBalance?.availableUsdCents || 0;
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

  const availableUsdCents = usdBalance?.availableUsdCents || 0;
  const totalUsdCents = usdBalance?.totalUsdCents || 0;

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
              {isUserAllocation ? `Allocate to ${username}` : 'Allocate Funds'}
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
          {/* Fake Balance Notice */}
          {isFakeBalance && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Demo Mode - Fake $10/mo
                </span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                {!hasActiveSubscription
                  ? "Activate your subscription to make these allocations real"
                  : "Try the allocation system with fake funds"
                }
              </p>
            </div>
          )}

          {/* Balance info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Monthly:</span>
              <span className="font-medium">{formatUsdCents(totalUsdCents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Available:</span>
              <span className="font-medium">{formatUsdCents(availableUsdCents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Allocation:</span>
              <span className="font-medium">{formatUsdCents(currentAllocation)}</span>
            </div>
          </div>

          {/* Composition Chart */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Allocation Overview</Label>

            {/* Composition Bar */}
            <div className="space-y-2">
              <div className="relative h-6 bg-muted rounded-md overflow-hidden">
                {/* Current allocation (blue/accent) */}
                <div
                  className="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-300"
                  style={{
                    width: `${Math.min((currentAllocation / totalUsdCents) * 100, 100)}%`
                  }}
                />

                {/* Preview of new allocation (darker blue) */}
                {(() => {
                  const newAllocationCents = parseDollarInputToCents(inputValue) || 0;
                  const newPercentage = totalUsdCents > 0 ? (newAllocationCents / totalUsdCents) * 100 : 0;
                  const currentPercentage = totalUsdCents > 0 ? (currentAllocation / totalUsdCents) * 100 : 0;

                  if (newAllocationCents !== currentAllocation && newPercentage > currentPercentage) {
                    return (
                      <div
                        className="absolute left-0 top-0 h-full bg-primary/60 rounded-md transition-all duration-300"
                        style={{
                          width: `${Math.min(newPercentage, 100)}%`
                        }}
                      />
                    );
                  }
                  return null;
                })()}

                {/* Remaining allocation (dotted pattern) */}
                <div
                  className="absolute right-0 top-0 h-full bg-muted-foreground/20 rounded-md"
                  style={{
                    width: `${Math.max(100 - Math.min((Math.max(currentAllocation, parseDollarInputToCents(inputValue) || 0) / totalUsdCents) * 100, 100), 0)}%`,
                    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)`
                  }}
                />
              </div>

              {/* Legend */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <span className="text-muted-foreground">Current: {formatUsdCents(currentAllocation)}</span>
                  </div>
                  {(() => {
                    const newAllocationCents = parseDollarInputToCents(inputValue) || 0;
                    if (newAllocationCents !== currentAllocation) {
                      return (
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-primary/60 rounded-full"></div>
                          <span className="text-muted-foreground">Preview: {formatUsdCents(newAllocationCents)}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {(() => {
                    const newAllocationCents = parseDollarInputToCents(inputValue) || 0;
                    const remainingUsdCents = Math.max(0, totalUsdCents - Math.max(currentAllocation, newAllocationCents));

                    // Only show remaining if there are funds left
                    if (remainingUsdCents > 0) {
                      return (
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-muted-foreground/20 rounded-full" style={{
                            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.3) 1px, rgba(0,0,0,0.3) 2px)`
                          }}></div>
                          <span className="text-muted-foreground">Remaining: {formatUsdCents(remainingUsdCents)}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
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
                        variant="outline"
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
          </div>

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

          {/* Quick amount buttons */}
          <div>
            <Label className="text-sm font-medium">Quick Amounts</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {quickAmounts.map((amount) => {
                const cents = dollarsToCents(amount);
                const isDisabled = cents > availableUsdCents + currentAllocation;
                const isZero = amount === 0.00;

                return (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAmount(amount)}
                    disabled={isDisabled}
                    className={`text-xs ${isZero ? 'text-red-600 hover:text-red-700 border-red-200 hover:border-red-300' : ''}`}
                  >
                    ${amount.toFixed(2)}
                  </Button>
                );
              })}
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
                variant="outline"
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
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>

              {/* Plus button */}
              <Button
                variant="outline"
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
            variant="outline"
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
  return createPortal(modalContent, document.body);
}
