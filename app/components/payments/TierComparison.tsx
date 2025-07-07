"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Check, Star, Zap, Crown } from 'lucide-react';
import { SUBSCRIPTION_TIERS, CUSTOM_TIER_CONFIG } from '../../utils/subscriptionTiers';
import { useFeatureFlag } from '../../utils/feature-flags';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
interface TierComparisonProps {
  currentTier?: string;
  currentAmount?: number;
  onTierSelect?: (tierId: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

export function TierComparison({ 
  currentTier, 
  currentAmount, 
  onTierSelect, 
  showActions = true,
  compact = false 
}: TierComparisonProps) {
  const { session } = useCurrentAccount();
  const isPaymentsEnabled = useFeatureFlag('payments', session?.email, session?.uid);

  // Don't render if payments feature is disabled
  if (!isPaymentsEnabled) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'}).format(amount);
  };

  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case 'tier1':
        return <Star className="h-5 w-5 text-blue-500" />;
      case 'tier2':
        return <Zap className="h-5 w-5 text-purple-500" />;
      case 'tier3':
        return <Crown className="h-5 w-5 text-yellow-500" />;
      default:
        return <Star className="h-5 w-5 text-gray-500" />;
    }
  };

  const isCurrentTier = (tierId: string, tierAmount: number) => {
    return currentTier === tierId && currentAmount === tierAmount;
  };

  const getUpgradeStatus = (tierAmount: number) => {
    if (!currentAmount) return 'new';
    if (tierAmount > currentAmount) return 'upgrade';
    if (tierAmount < currentAmount) return 'downgrade';
    return 'current';
  };

  if (compact) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SUBSCRIPTION_TIERS.map((tier) => {
          const isCurrent = isCurrentTier(tier.id, tier.amount);
          const status = getUpgradeStatus(tier.amount);
          
          return (
            <Card 
              key={tier.id} 
              className={`relative transition-all ${
                isCurrent 
                  ? 'ring-2 ring-primary border-primary' 
                  : 'hover:shadow-md'
              } ${tier.popular ? 'ring-2 ring-primary/30' : ''}`}
            >
              {tier.popular && (
                <Badge className="absolute -top-2 left-4 bg-primary text-primary-foreground">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  {getTierIcon(tier.id)}
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{formatCurrency(tier.amount)}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-2 mb-4">
                  {tier.features.slice(0, 3).map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                
                {showActions && (
                  <Button
                    variant={isCurrent ? "outline" : "default"}
                    className="w-full"
                    disabled={isCurrent}
                    onClick={() => onTierSelect?.(tier.id)}
                  >
                    {isCurrent ? 'Current Plan' : 
                     status === 'upgrade' ? 'Upgrade' : 
                     status === 'downgrade' ? 'Downgrade' : 'Select'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">Choose Your Subscription Tier</h3>
        <p className="text-muted-foreground">
          Support WeWrite creators and get tokens to allocate to your favorite pages
        </p>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {SUBSCRIPTION_TIERS.map((tier) => {
          const isCurrent = isCurrentTier(tier.id, tier.amount);
          const status = getUpgradeStatus(tier.amount);
          
          return (
            <Card 
              key={tier.id} 
              className={`relative transition-all ${
                isCurrent 
                  ? 'ring-2 ring-primary border-primary bg-primary/5' 
                  : 'hover:shadow-lg hover:scale-105'
              } ${tier.popular ? 'ring-2 ring-primary/50 scale-105' : ''}`}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-2">
                  {getTierIcon(tier.id)}
                </div>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold">{formatCurrency(tier.amount)}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <CardDescription className="text-center">{tier.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Token Info */}
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-lg font-semibold">{tier.tokens} tokens</div>
                  <div className="text-sm text-muted-foreground">per month</div>
                </div>
                
                {/* Features */}
                <div className="space-y-3">
                  {(tier.features || []).map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
                
                {/* Action Button */}
                {showActions && (
                  <div className="pt-4">
                    <Button
                      variant={isCurrent ? "outline" : tier.popular ? "default" : "outline"}
                      className={`w-full ${tier.popular && !isCurrent ? 'bg-primary hover:bg-primary/90' : ''}`}
                      disabled={isCurrent}
                      onClick={() => onTierSelect?.(tier.id)}
                    >
                      {isCurrent ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Current Plan
                        </>
                      ) : status === 'upgrade' ? (
                        'Upgrade to ' + tier.name
                      ) : status === 'downgrade' ? (
                        'Downgrade to ' + tier.name
                      ) : (
                        'Select ' + tier.name
                      )}
                    </Button>
                    
                    {status === 'upgrade' && (
                      <p className="text-xs text-green-600 text-center mt-2">
                        ↗ Upgrade from {formatCurrency(currentAmount || 0)}
                      </p>
                    )}
                    {status === 'downgrade' && (
                      <p className="text-xs text-orange-600 text-center mt-2">
                        ↘ Downgrade from {formatCurrency(currentAmount || 0)}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom Tier Option */}
      <Card className="border-2 border-dashed border-theme-medium">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <DollarSign className="h-5 w-5" />
            Custom Amount
          </CardTitle>
          <CardDescription>
            Choose your own monthly amount (${CUSTOM_TIER_CONFIG.minAmount}+ per month)
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Perfect for those who want to contribute more than ${SUBSCRIPTION_TIERS[2].amount}/month
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>All Champion tier features</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>Extra tokens (10 per $1)</span>
            </div>
            
            {showActions && (
              <Button
                variant="outline"
                onClick={() => onTierSelect?.('custom')}
                className="mt-4"
              >
                Set Custom Amount
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <div className="text-center text-sm text-muted-foreground">
        <p>All subscriptions can be modified or cancelled at any time.</p>
        <p>Changes are prorated and take effect immediately.</p>
      </div>
    </div>
  );
}

// Import DollarSign icon
import { DollarSign } from 'lucide-react';