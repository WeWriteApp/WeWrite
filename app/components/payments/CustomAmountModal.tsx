"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { DollarSign, Plus } from 'lucide-react';

interface CustomAmountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAmount: string;
  onAmountConfirm: (amount: string) => void;
  minAmount: number;
}

export function CustomAmountModal({
  open,
  onOpenChange,
  initialAmount,
  onAmountConfirm,
  minAmount = 50
}: CustomAmountModalProps) {
  const [amount, setAmount] = useState(initialAmount);
  const [error, setError] = useState<string | null>(null);

  // Reset amount when modal opens
  useEffect(() => {
    if (open) {
      setAmount(initialAmount);
      setError(null);
    }
  }, [open, initialAmount]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setAmount(value);

    // Validate in real-time
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < minAmount) {
      setError(`Custom amount must be at least $${minAmount}`);
    } else {
      setError(null);
    }
  };

  const handleAddAmount = (addAmount: number) => {
    const currentAmount = parseInt(amount, 10) || minAmount;
    setAmount((currentAmount + addAmount).toString());
    setError(null);
  };

  const handleConfirm = () => {
    const numValue = parseInt(amount, 10);
    if (isNaN(numValue) || numValue < minAmount) {
      setError(`Custom amount must be at least $${minAmount}`);
      return;
    }

    onAmountConfirm(amount);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Custom Subscription Amount</DialogTitle>
          <DialogDescription>
            Enter a custom monthly subscription amount. The minimum is ${minAmount}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={amount}
              onChange={handleAmountChange}
              className={`text-lg font-bold ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              placeholder={`${minAmount}`}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
            />
            <span className="text-muted-foreground">/month</span>
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAddAmount(10);
              }}
              className="flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> $10
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAddAmount(25);
              }}
              className="flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> $25
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAddAmount(50);
              }}
              className="flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> $50
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleConfirm();
            }}
            disabled={!!error}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
