"use client";

import React from 'react';
import { Ban, Star, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { getEffectiveTier } from '../../utils/subscriptionTiers';

interface SubscriptionTierBadgeProps {
  tier?: string | null;
  status?: string | null;
  amount?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isLoading?: boolean;
}

export function SubscriptionTierBadge({
  tier,
  status,
  amount,
  size = 'sm',
  className = '',
  isLoading = false
}: SubscriptionTierBadgeProps) {

  // Size configurations - moved to top to fix initialization error
  const sizeConfig = {
    sm: { icon: 12, gap: 'gap-0.5' },
    md: { icon: 14, gap: 'gap-1' },
    lg: { icon: 16, gap: 'gap-1' }
  };

  // Show loading state if explicitly loading OR if no data is provided (fallback loading state)
  // Note: tier can be 0 (which is falsy), so check for null/undefined specifically
  if (isLoading || (tier == null && status == null && amount == null)) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center ${className}`}>
              <Loader2 size={sizeConfig[size].icon} className="text-muted-foreground animate-spin" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Loading subscription...</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Use centralized tier determination logic with safety fallback
  const finalTier = getEffectiveTier(amount ?? null, tier ?? null, status ?? null) || 'inactive';

  const config = sizeConfig[size];

  // Get badge content based on tier
  const getBadgeContent = () => {
    switch (finalTier) {
      case 'inactive':
        return {
          icon: <Ban size={config.icon} className="text-muted-foreground" />,
          tooltip: 'No active subscription - $0/mo',
          color: 'text-muted-foreground'
        };
      case 'tier1':
        return {
          icon: <Star size={config.icon} className="text-yellow-500 fill-yellow-500" />,
          tooltip: '$10/mo - 100 tokens',
          color: 'text-yellow-500'
        };
      case 'tier2':
        return {
          icon: (
            <div className={`flex ${config.gap}`}>
              <Star size={config.icon} className="text-yellow-500 fill-yellow-500" />
              <Star size={config.icon} className="text-yellow-500 fill-yellow-500" />
            </div>
          ),
          tooltip: '$20/mo - 200 tokens',
          color: 'text-yellow-500'
        };
      case 'tier3':
        return {
          icon: (
            <div className={`flex ${config.gap}`}>
              <Star size={config.icon} className="text-yellow-500 fill-yellow-500" />
              <Star size={config.icon} className="text-yellow-500 fill-yellow-500" />
              <Star size={config.icon} className="text-yellow-500 fill-yellow-500" />
            </div>
          ),
          tooltip: 'Over $30/mo - 300+ tokens',
          color: 'text-yellow-500'
        };
      default:
        return {
          icon: <Ban size={config.icon} className="text-muted-foreground" />,
          tooltip: 'No subscription',
          color: 'text-muted-foreground'
        };
    }
  };

  const badgeContent = getBadgeContent();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center ${className}`}>
            {badgeContent.icon}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{badgeContent.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
