"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Plus, DollarSign, Wallet, User } from 'lucide-react';
import { USD_SUBSCRIPTION_TIERS, getEffectiveUsdTier } from '../../utils/usdConstants';
import { formatUsdCents, dollarsToCents, parseDollarInputToCents } from '../../utils/formatCurrency';
import { SubscriptionTierBadge } from '../ui/SubscriptionTierBadge';
import { UsernameBadge } from '../ui/UsernameBadge';
import { useAuth } from '../../providers/AuthProvider';
import Link from 'next/link';

interface UsdFundingTierSliderProps {
  selectedAmount: number;
  onAmountSelect: (amount: number) => void;
  currentSubscription?: {
    amount: number;
    tier?: string;
  } | null;
  showCurrentOption?: boolean;
}

// Define the slider nodes and their properties - $10 increments only
const INITIAL_NODES = [0, 10, 20, 30, 40, 50];
const EXTENDED_NODES = [60, 70, 80, 90, 100];
const CUSTOM_THRESHOLD = 50;

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
  const customInputRef = useRef<HTMLInputElement>(null);

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

    if (dollarAmount > 1000) {
      setCustomError('Maximum subscription is $1000/month');
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
      // Focus the input after a brief delay to allow animation
      setTimeout(() => {
        customInputRef.current?.focus();
      }, 150);
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
        {/* Username Preview */}
        {user?.username && user?.uid && (
          <div className="bg-muted/30 dark:bg-muted/50 border border-border dark:border-muted rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-3 text-center">Your username will appear as:</p>
            <div className="flex items-center justify-center gap-2">
              <UsernameBadge
                userId={user.uid}
                username={user.username}
                subscriptionStatus={selectedAmount > 0 ? 'active' : 'inactive'}
                subscriptionAmount={selectedAmount}
                size="md"
                showBadge={true}
                variant="link"
                onClick={(e) => e.preventDefault()} // Prevent navigation in preview
              />
            </div>
          </div>
        )}

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

        {/* Slider */}
        <div className="space-y-4">
          <div className="relative">
            <input
              type="range"
              min="0"
              max={sliderNodes.length - 1}
              value={(() => {
                // If selected amount is above $100, show slider at $100 position
                if (selectedAmount > 100) {
                  return sliderNodes.findIndex(amount => amount === 100);
                }
                return sliderNodes.findIndex(amount => amount === selectedAmount);
              })()}
              onChange={(e) => {
                const nodeIndex = parseInt(e.target.value);
                const amount = sliderNodes[nodeIndex];
                onAmountSelect(amount);

                if (amount > CUSTOM_THRESHOLD) {
                  setShowCustomInput(true);
                  setCustomAmount(amount.toString());
                } else {
                  setShowCustomInput(false);
                  setCustomError('');
                }
              }}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${(() => {
                  // If selected amount is above $100, show slider filled to $100 position
                  const displayIndex = selectedAmount > 100
                    ? sliderNodes.findIndex(amount => amount === 100)
                    : sliderNodes.findIndex(amount => amount === selectedAmount);
                  return (displayIndex / (sliderNodes.length - 1)) * 100;
                })()}%, hsl(var(--muted)) ${(() => {
                  const displayIndex = selectedAmount > 100
                    ? sliderNodes.findIndex(amount => amount === 100)
                    : sliderNodes.findIndex(amount => amount === selectedAmount);
                  return (displayIndex / (sliderNodes.length - 1)) * 100;
                })()}%, hsl(var(--muted)) 100%)`
              }}
            />
          </div>

          {/* Slider labels */}
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            {sliderNodes.map((amount, index) => (
              <span key={index} className="text-center">
                {amount === 0 ? 'Free' : `$${amount}`}
              </span>
            ))}
          </div>

          {/* +10 Button and Custom Amount Button */}
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newAmount = selectedAmount + 10;

                // Check maximum limit
                if (newAmount > 1000) {
                  return; // Don't allow going over $1000
                }

                // If we're at $100 or above, switch to custom input mode and update custom amount
                if (selectedAmount >= 100) {
                  setShowCustomInput(true);
                  setCustomAmount(newAmount.toString());
                  onAmountSelect(newAmount);
                  return;
                }

                // For amounts under $100, extend slider nodes if needed
                if (!sliderNodes.includes(newAmount)) {
                  const newNodes = [...sliderNodes];

                  // Add intermediate nodes if there's a big gap
                  for (let i = selectedAmount + 10; i <= newAmount; i += 10) {
                    if (!newNodes.includes(i)) {
                      newNodes.push(i);
                    }
                  }

                  // Sort the nodes
                  newNodes.sort((a, b) => a - b);
                  setSliderNodes(newNodes);
                }

                onAmountSelect(newAmount);
              }}
              disabled={selectedAmount >= 1000}
              className={`flex items-center gap-2 h-9 ${
                selectedAmount >= 1000
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              <Plus className="h-4 w-4" />
              Add $10
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCustomInputToggle}
              className={`flex items-center gap-2 h-9 ${
                showCustomInput
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : ''
              }`}
            >
              <DollarSign className="h-4 w-4" />
              Custom Amount
            </Button>
          </div>

          {/* Custom amount input */}
          {showCustomInput && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={customInputRef}
                  type="text"
                  placeholder="100.00"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className={`pl-10 ${customError ? 'border-destructive' : ''}`}
                />
              </div>

              {customError && (
                <p className="text-sm text-destructive animate-in slide-in-from-top-1 duration-150">{customError}</p>
              )}

              <p className="text-xs text-muted-foreground">
                Custom amounts: ${USD_SUBSCRIPTION_TIERS.CUSTOM.minUsdAmount} - $1000/month
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          {selectedAmount === 0 ? (
            <Button
              asChild
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <Link href="/settings/fund-account/cancel">
                Cancel Subscription
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              className={`w-full text-white ${
                currentSubscription?.amount === selectedAmount
                  ? 'bg-gray-500 hover:bg-gray-600 cursor-not-allowed'
                  : selectedAmount > (currentSubscription?.amount || 0)
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
              disabled={currentSubscription?.amount === selectedAmount}
            >
              <Link href={`/settings/fund-account/checkout?amount=${selectedAmount}`}>
                {currentSubscription?.amount === selectedAmount
                  ? 'Current Plan'
                  : selectedAmount > (currentSubscription?.amount || 0)
                    ? `Upgrade to $${selectedAmount}/month`
                    : `Downgrade to $${selectedAmount}/month`
                }
              </Link>
            </Button>
          )}
        </div>

        {/* USD info */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded p-3">
          <p>
            All amounts are in USD. Payments processed securely via Stripe.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
