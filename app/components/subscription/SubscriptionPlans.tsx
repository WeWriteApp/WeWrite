/**
 * Unified Subscription Plans Component
 * 
 * Displays subscription tiers with token economy integration
 * Replaces fragmented subscription components
 */

'use client';

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Check, Loader2, CreditCard, Coins } from 'lucide-react';
import { SubscriptionService } from '../../services/subscriptionService';
import { 
  SUBSCRIPTION_TIERS, 
  CUSTOM_TIER_CONFIG, 
  formatTierDisplay,
  validateCustomAmount 
} from '../../utils/subscriptionTiers';
import { useToast } from '../ui/use-toast';
// Note: Analytics will be tracked via API calls

interface SubscriptionPlansProps {
  currentTier?: string;
  currentAmount?: number;
  userId: string;
  onSubscriptionChange?: () => void;
}

export function SubscriptionPlans({ 
  currentTier, 
  currentAmount, 
  userId, 
  onSubscriptionChange 
}: SubscriptionPlansProps) {
  const [selectedTier, setSelectedTier] = useState<string>(currentTier || '');
  const [customAmount, setCustomAmount] = useState<number>(CUSTOM_TIER_CONFIG.minAmount);
  const [loading, setLoading] = useState<string | null>(null);
  const [customAmountError, setCustomAmountError] = useState<string>('');
  
  const { toast } = useToast();

  const handleCustomAmountChange = (value: string) => {
    const amount = parseFloat(value);
    setCustomAmount(amount);
    
    if (value && !isNaN(amount)) {
      const validation = validateCustomAmount(amount);
      setCustomAmountError(validation.valid ? '' : validation.error || '');
    } else {
      setCustomAmountError('');
    }
  };

  const handleSubscribe = async (tier: string) => {
    if (loading) return;
    
    setLoading(tier);
    
    try {
      // Validate custom amount if needed
      if (tier === 'custom') {
        const validation = validateCustomAmount(customAmount);
        if (!validation.valid) {
          toast({
            title: "Invalid Amount",
            description: validation.error,
            variant: "destructive",
          });
          setLoading(null);
          return;
        }
      }

      // Create checkout session
      const result = await SubscriptionService.createCheckoutSession({
        userId,
        tier,
        customAmount: tier === 'custom' ? customAmount : undefined,
      });

      if (result.error) {
        toast({
          title: "Subscription Error",
          description: result.error,
          variant: "destructive",
        });
        setLoading(null);
        return;
      }

      // Redirect to Stripe Checkout
      if (result.sessionId) {
        const redirectResult = await SubscriptionService.redirectToCheckout(result.sessionId);
        
        if (redirectResult.error) {
          toast({
            title: "Checkout Error",
            description: redirectResult.error,
            variant: "destructive",
          });
        }
      }

    } catch (error) {
      console.error('Subscription error:', error);
      toast({
        title: "Subscription Error",
        description: "Failed to start subscription process. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const isCurrentTier = (tier: string, amount?: number) => {
    if (tier === 'custom') {
      return currentTier === 'custom' && currentAmount === amount;
    }
    return currentTier === tier;
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Choose Your Support Level</h2>
        <p className="text-muted-foreground">
          Support WeWrite creators with monthly token allocations. $1 = 10 tokens.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {SUBSCRIPTION_TIERS.map((tier) => {
          const displayTier = formatTierDisplay(tier);
          const isCurrent = isCurrentTier(tier.id);
          
          return (
            <Card 
              key={tier.id} 
              className={`relative ${tier.popular ? 'ring-2 ring-primary' : ''} ${
                isCurrent ? 'bg-primary/5 border-primary' : ''
              }`}
            >
              {tier.popular && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Coins className="h-5 w-5" />
                  {displayTier.name}
                </CardTitle>
                <CardDescription>{displayTier.description}</CardDescription>
                <div className="space-y-1">
                  <div className="text-3xl font-bold">{displayTier.displayAmount}</div>
                  <div className="text-sm text-muted-foreground">
                    {displayTier.displayTokens}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Button
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={loading === tier.id || isCurrent}
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                >
                  {loading === tier.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Subscribe
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}

        {/* Custom Tier Card */}
        <Card className={`relative ${isCurrentTier('custom', customAmount) ? 'bg-primary/5 border-primary' : ''}`}>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Coins className="h-5 w-5" />
              Custom Amount
            </CardTitle>
            <CardDescription>
              Choose your own monthly support amount
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Monthly Amount (USD)</label>
              <Input
                type="number"
                min={CUSTOM_TIER_CONFIG.minAmount}
                max={CUSTOM_TIER_CONFIG.maxAmount}
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                placeholder={`Min $${CUSTOM_TIER_CONFIG.minAmount}`}
              />
              {customAmountError && (
                <p className="text-sm text-destructive">{customAmountError}</p>
              )}
              {!customAmountError && customAmount >= CUSTOM_TIER_CONFIG.minAmount && (
                <p className="text-sm text-muted-foreground">
                  = {customAmount * 10} tokens per month
                </p>
              )}
            </div>
            
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                Custom token allocation
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                Flexible monthly support
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                All premium features
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                Maximum creator impact
              </li>
            </ul>
            
            <Button
              onClick={() => handleSubscribe('custom')}
              disabled={
                loading === 'custom' || 
                customAmount < CUSTOM_TIER_CONFIG.minAmount || 
                !!customAmountError ||
                isCurrentTier('custom', customAmount)
              }
              className="w-full"
              variant={isCurrentTier('custom', customAmount) ? "outline" : "default"}
            >
              {loading === 'custom' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : isCurrentTier('custom', customAmount) ? (
                'Current Plan'
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Subscribe ${customAmount}/mo
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>
          All subscriptions are processed securely through Stripe. 
          You can cancel or modify your subscription at any time.
        </p>
      </div>
    </div>
  );
}
