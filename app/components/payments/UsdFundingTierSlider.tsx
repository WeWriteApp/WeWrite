"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Plus, DollarSign, Wallet, User, AlertTriangle } from 'lucide-react';
import { USD_SUBSCRIPTION_TIERS, getEffectiveUsdTier } from '../../utils/usdConstants';
import { formatUsdCents, dollarsToCents, parseDollarInputToCents } from '../../utils/formatCurrency';
import { UsernameBadge } from '../ui/UsernameBadge';
import { useAuth } from '../../providers/AuthProvider';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
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
  const { usdBalance } = useUsdBalance();
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

  // Calculate overspending - always use current subscription as source of truth
  const currentSubscriptionAmount = currentSubscription?.amount || 0;
  const totalUsdCents = currentSubscriptionAmount * 100; // Always use current subscription amount
  const allocatedUsdCents = usdBalance?.allocatedUsdCents || 0;
  const availableUsdCents = totalUsdCents - allocatedUsdCents;
  const isOverspent = availableUsdCents < 0 && currentSubscriptionAmount > 0;
  const overspentCents = isOverspent ? Math.abs(availableUsdCents) : 0;

  // Calculate potential overspending for selected amount (downgrade preview)
  const selectedTotalUsdCents = selectedAmount * 100;
  const selectedAvailableUsdCents = selectedTotalUsdCents - allocatedUsdCents;
  const wouldBeOverspent = selectedAvailableUsdCents < 0 && selectedAmount > 0;
  const wouldBeOverspentCents = wouldBeOverspent ? Math.abs(selectedAvailableUsdCents) : 0;

  // Show downgrade overspend warning only when downgrading and would create overspend
  const isDowngrade = selectedAmount < currentSubscriptionAmount && currentSubscriptionAmount > 0;
  const showDowngradeOverspendWarning = isDowngrade && wouldBeOverspent;

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
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Current Plan</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">
                  {formatUsdCents(currentTierInfo.usdCents)}/month
                </span>
              </div>
            </div>

            {/* Overspent indicator */}
            {isOverspent && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Over spent</span>
                </div>
                <span className="text-sm font-semibold text-orange-500">
                  {formatUsdCents(overspentCents)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Slider */}
        <div className="space-y-4">
          <div className="relative">
            {/* Custom slider track with rounded segments and gaps */}
            <div className="w-full h-2 bg-muted rounded-full relative overflow-hidden">
              {(() => {
                // Calculate positions as percentages
                const maxSliderAmount = sliderNodes[sliderNodes.length - 1];
                const gapWidth = 0.5; // Gap width as percentage

                // Current subscription position
                const currentPosition = currentSubscriptionAmount > 0
                  ? Math.min(100, (currentSubscriptionAmount / maxSliderAmount) * 100)
                  : 0;

                // Calculate overspent position (current + overspent amount)
                const overspentAmount = currentSubscriptionAmount + (overspentCents / 100);
                const overspentPosition = Math.min(100, (overspentAmount / maxSliderAmount) * 100);

                // Calculate selected position
                const selectedPosition = selectedAmount > maxSliderAmount
                  ? 100
                  : (selectedAmount / maxSliderAmount) * 100;

                const segments = [];

                if (isOverspent) {
                  // Current plan segment (primary color)
                  if (currentPosition > 0) {
                    segments.push(
                      <div
                        key="current"
                        className="absolute top-0 left-0 h-full bg-primary rounded-full"
                        style={{ width: `${Math.max(0, currentPosition - gapWidth/2)}%` }}
                      />
                    );
                  }

                  // Overspent segment (orange) with gap
                  if (overspentPosition > currentPosition) {
                    segments.push(
                      <div
                        key="overspent"
                        className="absolute top-0 h-full rounded-full"
                        style={{
                          left: `${currentPosition + gapWidth/2}%`,
                          width: `${Math.max(0, overspentPosition - currentPosition - gapWidth)}%`,
                          backgroundColor: 'rgb(249 115 22)'
                        }}
                      />
                    );
                  }

                  // Selected amount beyond overspent (if applicable) with gap
                  if (selectedPosition > overspentPosition) {
                    segments.push(
                      <div
                        key="selected"
                        className="absolute top-0 h-full bg-primary rounded-full"
                        style={{
                          left: `${overspentPosition + gapWidth/2}%`,
                          width: `${Math.max(0, selectedPosition - overspentPosition - gapWidth/2)}%`
                        }}
                      />
                    );
                  }
                } else {
                  // Normal case: just show selected amount
                  if (selectedPosition > 0) {
                    segments.push(
                      <div
                        key="selected"
                        className="absolute top-0 left-0 h-full bg-primary rounded-full"
                        style={{ width: `${selectedPosition}%` }}
                      />
                    );
                  }
                }

                return segments;
              })()}
            </div>

            {/* Visible slider input with custom styling */}
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
              className="absolute top-0 left-0 w-full h-2 appearance-none cursor-pointer slider"
              style={{
                background: 'transparent',
                WebkitAppearance: 'none',
                appearance: 'none'
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

          {/* Overspending explanation */}
          {isOverspent && (
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mt-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-orange-700 dark:text-orange-300">
                  <p className="font-medium mb-1">You're currently overspending</p>
                  <p>The orange section shows your overspent amount ({formatUsdCents(overspentCents)}).
                     Drag the slider to at least ${Math.ceil(currentSubscriptionAmount + (overspentCents / 100))} to cover your current allocations.</p>
                </div>
              </div>
            </div>
          )}

          {/* Downgrade overspend warning */}
          {showDowngradeOverspendWarning && (
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mt-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-orange-700 dark:text-orange-300">
                  <p className="font-medium mb-1">Downgrade will create overspending</p>
                  <p>Downgrading to ${selectedAmount}/month will leave {formatUsdCents(wouldBeOverspentCents)} of your allocations unfunded (shown in orange).
                     Consider reducing your allocations first or choose a higher amount.</p>
                </div>
              </div>
            </div>
          )}

          {/* +10 Button and Custom Amount Button */}
          <div className="flex justify-center gap-3">
            <Button
              variant="secondary"
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
              variant="secondary"
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
                  className={`wewrite-input-with-left-icon ${customError ? 'border-destructive' : ''}`}
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

        {/* Action Button - Hidden when no change, with smooth height animation */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            currentSubscription?.amount === selectedAmount && selectedAmount !== 0
              ? 'max-h-0 opacity-0 pt-0'
              : 'max-h-20 opacity-100 pt-2'
          }`}
        >
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
                selectedAmount > (currentSubscription?.amount || 0)
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
            >
              <Link href={`/settings/fund-account/checkout?amount=${selectedAmount}`}>
                {selectedAmount > (currentSubscription?.amount || 0)
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
