"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Plus, DollarSign, Coins, User } from 'lucide-react';
import { SUBSCRIPTION_TIERS, TOKEN_ECONOMY } from '../../utils/subscriptionTiers';
import { SubscriptionTierBadge } from '../ui/SubscriptionTierBadge';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';

interface SubscriptionTierSliderProps {
  selectedAmount: number;
  onAmountSelect: (amount: number) => void;
  currentSubscription?: {
    amount: number;
    tier?: string;
  } | null;
  showCurrentOption?: boolean;
}

// Define the slider nodes and their properties
const INITIAL_NODES = [0, 10, 20, 30, 40, 50];
const EXTENDED_NODES = [60, 70, 80, 90, 100];
const CUSTOM_THRESHOLD = 100;

// Get tier information for an amount
const getTierInfo = (amount: number) => {
  if (amount === 0) return { tier: 'free', tokens: 0, description: 'No subscription' };
  if (amount === 10) return { tier: 'tier1', tokens: 100, description: '$10/month subscription' };
  if (amount === 20) return { tier: 'tier2', tokens: 200, description: '$20/month subscription' };
  if (amount >= 30) return { tier: 'tier3', tokens: amount * TOKEN_ECONOMY.TOKENS_PER_DOLLAR, description: `$${amount}/month subscription` };
  return { tier: 'custom', tokens: amount * TOKEN_ECONOMY.TOKENS_PER_DOLLAR, description: `$${amount}/month subscription` };
};

export default function SubscriptionTierSlider({
  selectedAmount,
  onAmountSelect,
  currentSubscription,
  showCurrentOption = false
}: SubscriptionTierSliderProps) {
  const { currentAccount } = useCurrentAccount();
  const [sliderNodes, setSliderNodes] = useState(INITIAL_NODES);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState('');

  // Determine if we need extended nodes - only expand, don't contract
  useEffect(() => {
    if (selectedAmount > 50 && selectedAmount <= 100) {
      const newNodes = [...INITIAL_NODES, ...EXTENDED_NODES.filter(node => node <= selectedAmount)];
      if (!newNodes.includes(selectedAmount)) {
        newNodes.push(selectedAmount);
        newNodes.sort((a, b) => a - b);
      }

      // Only update if we need more nodes than we currently have
      if (newNodes.length > sliderNodes.length || !sliderNodes.includes(selectedAmount)) {
        setSliderNodes(newNodes);
      }
    } else if (selectedAmount > 100) {
      // Only expand to full extended nodes if we haven't already
      const fullNodes = [...INITIAL_NODES, ...EXTENDED_NODES];
      if (sliderNodes.length < fullNodes.length) {
        setSliderNodes(fullNodes);
      }
      setShowCustomInput(true);
      setCustomAmount(selectedAmount.toString());
    } else if (selectedAmount <= 50) {
      // Hide custom input when going back to basic amounts, but keep extended slider nodes
      setShowCustomInput(false);
      setCustomError('');
    }
  }, [selectedAmount, sliderNodes]);

  // Handle slider change
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    const nodeIndex = value;
    const amount = sliderNodes[nodeIndex];
    
    if (amount > CUSTOM_THRESHOLD) {
      setShowCustomInput(true);
      setCustomAmount(amount.toString());
    } else {
      setShowCustomInput(false);
      setCustomError('');
    }
    
    onAmountSelect(amount);
  };

  // Handle +10 button
  const handleAddTen = () => {
    const newAmount = selectedAmount + 10;
    
    if (newAmount <= 100) {
      // Add to slider nodes if not already present
      if (!sliderNodes.includes(newAmount)) {
        const newNodes = [...sliderNodes, newAmount].sort((a, b) => a - b);
        setSliderNodes(newNodes);
      }
      onAmountSelect(newAmount);
    } else {
      // Switch to custom input
      setSliderNodes([...INITIAL_NODES, ...EXTENDED_NODES]);
      setShowCustomInput(true);
      setCustomAmount(newAmount.toString());
      onAmountSelect(newAmount);
    }
  };

  // Handle custom amount input
  const handleCustomAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCustomAmount(value);

    const numValue = parseInt(value);
    if (isNaN(numValue)) {
      setCustomError('Please enter a valid number');
      return;
    }

    if (numValue <= 100) {
      setCustomError('Custom amount must be above $100/mo');
      return;
    }

    if (numValue > 1000) {
      setCustomError('Maximum subscription is $1000/month');
      return;
    }

    setCustomError('');
    onAmountSelect(numValue);
  };

  // Get current slider position
  const getCurrentSliderPosition = () => {
    if (showCustomInput && selectedAmount > 100) {
      return sliderNodes.length - 1;
    }

    const exactIndex = sliderNodes.findIndex(node => node === selectedAmount);
    if (exactIndex !== -1) {
      return exactIndex;
    }

    // If selectedAmount is not in sliderNodes, we need to ensure the slider nodes include it
    // This handles cases where the slider was expanded but then the nodes were reset
    if (selectedAmount <= 100 && selectedAmount > 50) {
      // Ensure the slider includes all nodes up to the selected amount
      const newNodes = [...INITIAL_NODES, ...EXTENDED_NODES.filter(node => node <= selectedAmount)];
      if (!newNodes.includes(selectedAmount)) {
        newNodes.push(selectedAmount);
        newNodes.sort((a, b) => a - b);
      }
      setSliderNodes(newNodes);
      return newNodes.findIndex(node => node === selectedAmount);
    }

    // Fallback: find the closest position
    for (let i = sliderNodes.length - 1; i >= 0; i--) {
      if (sliderNodes[i] <= selectedAmount) {
        return i;
      }
    }

    return 0;
  };

  const currentTierInfo = getTierInfo(selectedAmount);
  const sliderPosition = getCurrentSliderPosition();

  // Check if this is a downgrade or cancellation
  const currentSubscriptionAmount = currentSubscription?.amount || 0;
  const isDowngrade = selectedAmount < currentSubscriptionAmount && selectedAmount > 0;
  const isCancellation = selectedAmount === 0 && currentSubscriptionAmount > 0;
  const tokenDifference = Math.abs((selectedAmount * TOKEN_ECONOMY.TOKENS_PER_DOLLAR) - (currentSubscriptionAmount * TOKEN_ECONOMY.TOKENS_PER_DOLLAR));

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Current Selection Display */}
      <Card className={`border-2 ${
        isCancellation
          ? 'border-destructive/20 bg-destructive/5'
          : isDowngrade
            ? 'border-yellow-500/20 bg-yellow-50 dark:bg-yellow-950/10'
            : 'border-primary/20 bg-primary/5'
      }`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <DollarSign className={`h-5 w-5 ${
                  isCancellation
                    ? 'text-destructive'
                    : isDowngrade
                      ? 'text-yellow-600'
                      : 'text-primary'
                }`} />
                <span className="text-2xl font-bold">${selectedAmount}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              {currentTierInfo.tier !== 'free' && currentTierInfo.tier !== 'custom' && (
                <SubscriptionTierBadge tier={currentTierInfo.tier} />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Coins className="h-4 w-4" />
              <span>{currentTierInfo.tokens} tokens</span>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">{currentTierInfo.description}</p>
            </div>

            {/* Username Preview - Fixed height to prevent layout shift */}
            <div className="min-h-[76px]">
              {currentAccount?.username && (
                <div className="p-3 bg-card rounded-lg border-theme-medium shadow-sm">
                  <p className="text-xs text-muted-foreground mb-2">Your username will appear as:</p>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${selectedAmount > 0 ? "text-accent-foreground" : "text-muted-foreground"}`}>
                      {currentAccount.username}
                    </span>
                    <SubscriptionTierBadge
                      tier={currentTierInfo.tier}
                      amount={selectedAmount}
                      status={selectedAmount > 0 ? "active" : "inactive"}
                      size="sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Warning Messages - Fixed height to prevent layout shift */}
            <div className="min-h-[60px]">
              {(isDowngrade || isCancellation) && tokenDifference > 0 && (
                <div className={`p-3 rounded-lg border ${
                  isCancellation
                    ? 'bg-destructive/10 border-destructive/20'
                    : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500/20'
                }`}>
                  <p className={`text-sm font-medium ${
                    isCancellation ? 'text-destructive' : 'text-yellow-700 dark:text-yellow-600'
                  }`}>
                    {isCancellation
                      ? '🚫 Cancellation: You\'ll lose all tokens'
                      : '⚠️ Downgrade: You\'ll lose ' + tokenDifference + ' tokens per month'
                    }
                  </p>
                  <p className={`text-xs mt-1 ${
                    isCancellation ? 'text-destructive/80' : 'text-yellow-600/80 dark:text-yellow-500/80'
                  }`}>
                    From {currentSubscriptionAmount * TOKEN_ECONOMY.TOKENS_PER_DOLLAR} → {currentTierInfo.tokens} tokens
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Slider */}
      <div className="space-y-4">
        <div className="relative">
          <input
            type="range"
            min="0"
            max={sliderNodes.length - 1}
            value={sliderPosition}
            onChange={handleSliderChange}
            className={`w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider ${
              isCancellation ? 'slider-cancellation' : isDowngrade ? 'slider-downgrade' : ''
            }`}
            style={{
              background: `linear-gradient(to right, ${
                isCancellation ? '#ef4444' : isDowngrade ? '#eab308' : '#3b82f6'
              } 0%, ${
                isCancellation ? '#ef4444' : isDowngrade ? '#eab308' : '#3b82f6'
              } ${(sliderPosition / (sliderNodes.length - 1)) * 100}%, #e2e8f0 ${(sliderPosition / (sliderNodes.length - 1)) * 100}%, #e2e8f0 100%)`
            }}
          />
          
          {/* Slider Labels */}
          <div className="flex justify-between mt-2 px-1">
            {sliderNodes.map((amount, index) => (
              <div
                key={amount}
                className={`text-xs text-center ${
                  index === sliderPosition
                    ? isCancellation
                      ? 'text-destructive font-semibold'
                      : isDowngrade
                        ? 'text-yellow-600 font-semibold'
                        : 'text-primary font-semibold'
                    : 'text-muted-foreground'
                }`}
                style={{ width: '40px', marginLeft: index === 0 ? '0' : '-20px', marginRight: index === sliderNodes.length - 1 ? '0' : '-20px' }}
              >
                ${amount}
              </div>
            ))}
          </div>
        </div>

        {/* +10 Button and Custom Amount Button */}
        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddTen}
            disabled={selectedAmount >= 100}
            className={`flex items-center gap-2 transition-all duration-200 ${
              selectedAmount >= 100
                ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground'
                : 'hover:bg-primary hover:text-primary-foreground'
            }`}
          >
            <Plus className="h-4 w-4" />
            Add $10
          </Button>

          {/* Custom Amount Button - appears with animation when reaching $100 */}
          {selectedAmount >= 100 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowCustomInput(true)}
              className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-300"
            >
              <DollarSign className="h-4 w-4" />
              Custom amount
            </Button>
          )}
        </div>

        {/* Custom Input */}
        {showCustomInput && (
          <Card className={`border-dashed ${
            isCancellation
              ? 'border-destructive/30'
              : isDowngrade
                ? 'border-yellow-500/30'
                : ''
          }`}>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="font-medium">Custom Amount</h4>
                  <p className="text-sm text-muted-foreground">
                    Enter a custom amount above $100/mo
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Enter amount above 100"
                      value={customAmount}
                      onChange={handleCustomAmountChange}
                      className={`pl-8 ${
                        isCancellation
                          ? 'border-destructive/30 focus:border-destructive'
                          : isDowngrade
                            ? 'border-yellow-500/30 focus:border-yellow-500'
                            : ''
                      }`}
                      min="101"
                      max="1000"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                {customError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <span>⚠️</span>
                    <span>{customError}</span>
                  </div>
                )}
                {!customError && customAmount && parseInt(customAmount) > 100 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      = {parseInt(customAmount) * TOKEN_ECONOMY.TOKENS_PER_DOLLAR} tokens per month
                    </p>
                    {(isDowngrade || isCancellation) && tokenDifference > 0 && (
                      <p className={`text-sm ${
                        isCancellation ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-500'
                      }`}>
                        {isCancellation
                          ? '🚫 This will cancel your subscription and remove all tokens'
                          : '⚠️ This will reduce your tokens by ' + tokenDifference + ' per month'
                        }
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
