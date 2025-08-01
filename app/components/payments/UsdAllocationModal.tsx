"use client";

import React, { useState, useEffect } from 'react';
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
  const { usdBalance } = useUsdBalance();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize input value when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(centsToDollars(currentAllocation).toFixed(2));
      setError(null);
    }
  }, [isOpen, currentAllocation]);

  // Quick allocation amounts in dollars
  const quickAmounts = [0.25, 0.50, 1.00, 2.50, 5.00, 10.00];

  const handleQuickAmount = (dollarAmount: number) => {
    setInputValue(dollarAmount.toFixed(2));
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

  if (!isOpen) return null;

  const availableUsdCents = usdBalance?.availableUsdCents || 0;
  const totalUsdCents = usdBalance?.totalUsdCents || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
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
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
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

          {/* Quick amount buttons */}
          <div>
            <Label className="text-sm font-medium">Quick Amounts</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {quickAmounts.map((amount) => {
                const cents = dollarsToCents(amount);
                const isDisabled = cents > availableUsdCents + currentAllocation;
                
                return (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAmount(amount)}
                    disabled={isDisabled}
                    className="text-xs"
                  >
                    ${amount.toFixed(2)}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Custom amount input */}
          <div>
            <Label htmlFor="amount" className="text-sm font-medium">
              Custom Amount
            </Label>
            <div className="relative mt-2">
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
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="flex space-x-2">
            {currentAllocation > 0 && (
              <Button
                variant="outline"
                onClick={handleRemoveAllocation}
                disabled={isLoading}
                className="text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            )}
          </div>
          
          <div className="flex space-x-2">
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
    </div>
  );
}
