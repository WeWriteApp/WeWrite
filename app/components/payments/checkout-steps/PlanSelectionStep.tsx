"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Star, Zap, Check, DollarSign } from 'lucide-react';
import { SUBSCRIPTION_TIERS, calculateTokensForAmount, CUSTOM_TIER_CONFIG } from '../../../utils/subscriptionTiers';
import { SelectedPlan } from '../SubscriptionCheckout';
import { PricingDisplay } from '../PricingDisplay';

interface PlanSelectionStepProps {
  selectedPlan: SelectedPlan | null;
  onPlanSelect: (plan: SelectedPlan) => void;
  onNext: () => void;
  isLoading: boolean;
}

export function PlanSelectionStep({
  selectedPlan,
  onPlanSelect,
  onNext,
  isLoading
}: PlanSelectionStepProps) {
  const [selectedTierId, setSelectedTierId] = useState<string>(
    selectedPlan?.tier || 'tier2'
  );
  const [customAmount, setCustomAmount] = useState<string>(
    selectedPlan?.isCustom ? selectedPlan.amount.toString() : '25'
  );
  const [customAmountError, setCustomAmountError] = useState<string>('');

  const handleTierChange = (tierId: string) => {
    setSelectedTierId(tierId);
    setCustomAmountError('');
    
    if (tierId !== 'custom') {
      const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId);
      if (tier) {
        onPlanSelect({
          tier: tier.id,
          amount: tier.amount,
          tokens: tier.tokens,
          name: tier.name,
          isCustom: false
        });
      }
    }
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setCustomAmountError('');
    
    const amount = parseFloat(value);
    if (isNaN(amount)) {
      setCustomAmountError('Please enter a valid amount');
      return;
    }
    
    if (amount < CUSTOM_TIER_CONFIG.minAmount) {
      setCustomAmountError(`Minimum amount is $${CUSTOM_TIER_CONFIG.minAmount}`);
      return;
    }
    
    if (amount > CUSTOM_TIER_CONFIG.maxAmount) {
      setCustomAmountError(`Maximum amount is $${CUSTOM_TIER_CONFIG.maxAmount}`);
      return;
    }

    // Valid custom amount
    onPlanSelect({
      tier: 'custom',
      amount: amount,
      tokens: calculateTokensForAmount(amount),
      name: 'Custom Plan',
      isCustom: true
    });
  };

  const handleContinue = () => {
    if (selectedTierId === 'custom') {
      const amount = parseFloat(customAmount);
      if (isNaN(amount) || amount < CUSTOM_TIER_CONFIG.minAmount || amount > CUSTOM_TIER_CONFIG.maxAmount) {
        setCustomAmountError('Please enter a valid amount');
        return;
      }
      
      onPlanSelect({
        tier: 'custom',
        amount: amount,
        tokens: calculateTokensForAmount(amount),
        name: 'Custom Plan',
        isCustom: true
      });
    }
    
    // Move to next step
    onNext();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Plan Selection */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Choose Your Plan</h2>
          <p className="text-muted-foreground">
            Select a subscription tier that works for you. You can change or cancel anytime.
          </p>
        </div>

        <RadioGroup value={selectedTierId} onValueChange={handleTierChange}>
          <div className="grid gap-4">
            {SUBSCRIPTION_TIERS.map((tier) => (
              <div key={tier.id} className="relative">
                <RadioGroupItem
                  value={tier.id}
                  id={tier.id}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={tier.id}
                  className="flex cursor-pointer select-none rounded-lg border-2 border-muted p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <Card className="w-full border-0 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {tier.name}
                        {tier.popular && (
                          <Badge variant="secondary" className="ml-2">
                            <Star className="w-3 h-3 mr-1" />
                            Popular
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="text-right">
                        <div className="text-2xl font-bold">${tier.amount}</div>
                        <p className="text-xs text-muted-foreground">per month</p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center">
                          <Zap className="w-4 h-4 mr-1 text-yellow-500" />
                          <span>{tier.tokens} tokens</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="w-4 h-4 mr-1 text-green-500" />
                          <span>All features</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {tier.description}
                      </p>
                    </CardContent>
                  </Card>
                </Label>
              </div>
            ))}

            {/* Custom Amount Option */}
            <div className="relative">
              <RadioGroupItem
                value="custom"
                id="custom"
                className="peer sr-only"
              />
              <Label
                htmlFor="custom"
                className="flex cursor-pointer select-none rounded-lg border-2 border-muted p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Card className="w-full border-0 shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Custom Amount
                    </CardTitle>
                    <DollarSign className="w-5 h-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="customAmount" className="text-sm">
                          Monthly amount:
                        </Label>
                        <div className="flex items-center space-x-1">
                          <span className="text-sm">$</span>
                          <Input
                            id="customAmount"
                            type="number"
                            min={CUSTOM_TIER_CONFIG.minAmount}
                            max={CUSTOM_TIER_CONFIG.maxAmount}
                            value={customAmount}
                            onChange={(e) => handleCustomAmountChange(e.target.value)}
                            className="w-20 h-8 text-sm"
                            placeholder="25"
                          />
                        </div>
                      </div>
                      {customAmountError && (
                        <p className="text-xs text-red-500">{customAmountError}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        ${CUSTOM_TIER_CONFIG.minAmount} - ${CUSTOM_TIER_CONFIG.maxAmount} per month
                      </p>
                      {selectedTierId === 'custom' && !customAmountError && customAmount && (
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center">
                            <Zap className="w-4 h-4 mr-1 text-yellow-500" />
                            <span>{calculateTokensForAmount(parseFloat(customAmount))} tokens</span>
                          </div>
                          <div className="flex items-center">
                            <Check className="w-4 h-4 mr-1 text-green-500" />
                            <span>All features</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Label>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Pricing Preview */}
      <div className="lg:col-span-1">
        {selectedPlan && (
          <div className="sticky top-4 space-y-4">
            <PricingDisplay
              amount={selectedPlan.amount}
              planName={selectedPlan.name}
              isCustom={selectedPlan.isCustom}
              showBreakdown={true}
            />
            
            {/* Continue Button */}
            <Button
              onClick={handleContinue}
              disabled={!selectedPlan || isLoading || (selectedTierId === 'custom' && customAmountError !== '')}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Processing...' : 'Continue to Payment'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
