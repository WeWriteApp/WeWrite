"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Plus, DollarSign, Wallet, User } from 'lucide-react';
import { USD_SUBSCRIPTION_TIERS, getEffectiveUsdTier, validateCustomUsdAmount } from '../../utils/usdConstants';
import { formatUsdCents, dollarsToCents, parseDollarInputToCents } from '../../utils/formatCurrency';
import { SubscriptionTierBadge } from '../ui/SubscriptionTierBadge';
import { useAuth } from '../../providers/AuthProvider';

interface UsdFundingTierSliderProps {
  selectedAmount: number;
  onAmountSelect: (amount: number) => void;
  currentSubscription?: {
    amount: number;
    tier?: string;
  } | null;
  showCurrentOption?: boolean;
}

// Define the slider nodes and their properties
const INITIAL_NODES = [0, 10, 25, 50, 75, 100];
const EXTENDED_NODES = [150, 200, 250, 300, 500];
const CUSTOM_THRESHOLD = 100;

// Get tier information for an amount
const getTierInfo = (amount: number) => {
  if (amount === 0) return { 
    tier: 'free', 
    usdCents: 0, 
    description: 'No account funding',
    name: 'Free'
  };
  
  const effectiveTier = getEffectiveUsdTier(amount);
  const usdCents = dollarsToCents(amount);
  
  return {
    tier: effectiveTier.id,
    usdCents,
    description: `${formatUsdCents(usdCents)}/month funding`,
    name: effectiveTier.name
  };
};

export default function UsdFundingTierSlider({
  selectedAmount,
  onAmountSelect,
  currentSubscription,
  showCurrentOption = false
}: UsdFundingTierSliderProps) {
  const { user } = useAuth();
  const [sliderNodes, setSliderNodes] = useState(INITIAL_NODES);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState('');

  // Determine if we need extended nodes - only expand, don't contract
  useEffect(() => {
    const maxAmount = Math.max(
      selectedAmount,
      currentSubscription?.amount || 0
    );

    if (maxAmount > CUSTOM_THRESHOLD && sliderNodes.length === INITIAL_NODES.length) {
      setSliderNodes([...INITIAL_NODES, ...EXTENDED_NODES]);
    }
  }, [selectedAmount, currentSubscription?.amount, sliderNodes.length]);

  // Handle custom amount input
  const handleCustomAmountChange = useCallback((value: string) => {
    setCustomAmount(value);
    setCustomError('');

    const parsedCents = parseDollarInputToCents(value);
    if (parsedCents === null) {
      if (value.trim() !== '') {
        setCustomError('Please enter a valid dollar amount');
      }
      return;
    }

    const dollarAmount = parsedCents / 100;
    
    if (dollarAmount < 0) {
      setCustomError('Amount cannot be negative');
      return;
    }

    if (dollarAmount > 0 && dollarAmount < USD_SUBSCRIPTION_TIERS.CUSTOM.minUsdAmount) {
      setCustomError(`Custom amount must be at least $${USD_SUBSCRIPTION_TIERS.CUSTOM.minUsdAmount}`);
      return;
    }

    // Valid custom amount
    onAmountSelect(dollarAmount);
  }, [onAmountSelect]);

  // Handle preset amount selection
  const handlePresetSelect = useCallback((amount: number) => {
    setShowCustomInput(false);
    setCustomAmount('');
    setCustomError('');
    onAmountSelect(amount);
  }, [onAmountSelect]);

  // Handle custom input toggle
  const handleCustomInputToggle = useCallback(() => {
    if (showCustomInput) {
      // Closing custom input
      setShowCustomInput(false);
      setCustomAmount('');
      setCustomError('');
      // Don't change selected amount when closing
    } else {
      // Opening custom input
      setShowCustomInput(true);
      setCustomAmount(selectedAmount > 0 ? selectedAmount.toString() : '');
    }
  }, [showCustomInput, selectedAmount]);

  // Get tier info for selected amount
  const selectedTierInfo = getTierInfo(selectedAmount);
  const currentTierInfo = currentSubscription ? getTierInfo(currentSubscription.amount) : null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Monthly Account Funding
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose how much to fund your account each month to support creators
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current subscription indicator */}
        {showCurrentOption && currentSubscription && currentTierInfo && (
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Current Plan</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {formatUsdCents(currentTierInfo.usdCents)}/month
                </span>
                <SubscriptionTierBadge tier={currentTierInfo.tier} />
              </div>
            </div>
          </div>
        )}

        {/* Preset amount buttons */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sliderNodes.map((amount) => {
              const tierInfo = getTierInfo(amount);
              const isSelected = selectedAmount === amount && !showCustomInput;
              const isCurrent = currentSubscription?.amount === amount;

              return (
                <Button
                  key={amount}
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => handlePresetSelect(amount)}
                  className={`h-auto p-4 flex flex-col items-center space-y-2 relative ${
                    isSelected ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                >
                  {isCurrent && (
                    <Badge 
                      variant="secondary" 
                      className="absolute -top-2 -right-2 text-xs bg-blue-100 text-blue-800"
                    >
                      Current
                    </Badge>
                  )}
                  
                  <div className="text-lg font-bold">
                    {amount === 0 ? 'Free' : `$${amount}`}
                  </div>
                  
                  {amount > 0 && (
                    <div className="text-xs text-muted-foreground text-center">
                      {formatUsdCents(tierInfo.usdCents)}/month
                    </div>
                  )}
                  
                  <SubscriptionTierBadge tier={tierInfo.tier} />
                </Button>
              );
            })}
          </div>

          {/* Custom amount input */}
          <div className="space-y-3">
            <Button
              variant={showCustomInput ? "default" : "outline"}
              onClick={handleCustomInputToggle}
              className="w-full h-auto p-4 flex items-center justify-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Custom Amount</span>
            </Button>

            {showCustomInput && (
              <div className="space-y-2">
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="100.00"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    className={`pl-10 ${customError ? 'border-destructive' : ''}`}
                  />
                </div>
                
                {customError && (
                  <p className="text-sm text-destructive">{customError}</p>
                )}
                
                <p className="text-xs text-muted-foreground">
                  Custom amounts must be at least ${USD_SUBSCRIPTION_TIERS.CUSTOM.minUsdAmount}/month
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Selected tier summary */}
        {selectedAmount > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-green-800">
                {selectedTierInfo.name} Plan
              </h4>
              <SubscriptionTierBadge tier={selectedTierInfo.tier} />
            </div>
            
            <div className="space-y-2 text-sm text-green-700">
              <div className="flex justify-between">
                <span>Monthly funding:</span>
                <span className="font-semibold">{formatUsdCents(selectedTierInfo.usdCents)}</span>
              </div>
              
              <div className="flex justify-between">
                <span>Available for creators:</span>
                <span className="font-semibold">{formatUsdCents(selectedTierInfo.usdCents)}</span>
              </div>
            </div>
            
            <p className="text-xs text-green-600 mt-3">
              Funds are distributed to creators at the end of each month based on your allocations.
            </p>
          </div>
        )}

        {/* Free tier message */}
        {selectedAmount === 0 && (
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">
              With the free plan, you can browse and discover content, but won't be able to financially support creators.
            </p>
          </div>
        )}

        {/* USD info */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded p-3">
          <p>
            All amounts are in USD. Your payment will be converted from your local currency at checkout.
            Payments are processed securely via Stripe.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
