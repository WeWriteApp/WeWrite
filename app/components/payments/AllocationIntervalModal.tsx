"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAllocationInterval, ALLOCATION_INTERVAL_OPTIONS } from '../../contexts/AllocationIntervalContext';
import { formatUsdCents } from '../../utils/formatCurrency';
import { Check } from 'lucide-react';

interface AllocationIntervalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AllocationIntervalModal({ isOpen, onClose }: AllocationIntervalModalProps) {
  const { allocationIntervalCents, setAllocationInterval } = useAllocationInterval();
  const [customAmount, setCustomAmount] = useState('');
  const [selectedInterval, setSelectedInterval] = useState(allocationIntervalCents);

  const handlePresetSelect = (cents: number) => {
    setSelectedInterval(cents);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    
    // Parse custom amount and convert to cents
    const dollars = parseFloat(value);
    if (!isNaN(dollars) && dollars > 0 && dollars <= 100) {
      const cents = Math.round(dollars * 100);
      setSelectedInterval(cents);
    }
  };

  const handleSave = () => {
    if (selectedInterval >= 1 && selectedInterval <= 10000) {
      setAllocationInterval(selectedInterval);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedInterval(allocationIntervalCents);
    setCustomAmount('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Allocation Interval</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose how much each + or - button adjusts your allocations.
          </p>

          {/* Preset Options */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Options</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALLOCATION_INTERVAL_OPTIONS.map((option) => (
                <Button
                  key={option.cents}
                  variant={selectedInterval === option.cents ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetSelect(option.cents)}
                  className="justify-between"
                >
                  <span>{option.label}</span>
                  {selectedInterval === option.cents && (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div className="space-y-2">
            <Label htmlFor="custom-amount" className="text-sm font-medium">
              Custom Amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="custom-amount"
                type="number"
                placeholder="0.00"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                className="pl-6"
                min="0.01"
                max="100.00"
                step="0.01"
              />
            </div>
            {customAmount && (
              <p className="text-xs text-muted-foreground">
                Custom: {formatUsdCents(selectedInterval)}
              </p>
            )}
          </div>

          {/* Current Selection Preview */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Selected Interval:</span>
              <span className="text-sm font-mono">
                {formatUsdCents(selectedInterval)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Each + or - button will adjust by this amount
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              className="flex-1"
              disabled={selectedInterval < 1 || selectedInterval > 10000}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
