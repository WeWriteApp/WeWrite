"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { SubscriptionTierBadge } from '../ui/SubscriptionTierBadge';
import { useAuth } from '../../providers/AuthProvider';

import { getEffectiveTier, SUBSCRIPTION_TIERS } from '../../utils/subscriptionTiers';

interface SupporterBadgeProps {
  tier?: string;
  className?: string;
  showLabel?: boolean;
  status?: string;
  amount?: number | null;
}

export default function SupporterBadge({ tier, className = '', showLabel = false, status = 'active', amount }: SupporterBadgeProps) {
  const { user } = useAuth();
  // Payments feature is now always enabled - no conditional rendering needed

  // Use centralized tier determination logic with safety fallback
  const effectiveTier = getEffectiveTier(amount, tier, status) || 'inactive';

  if (!effectiveTier || effectiveTier === 'inactive') return null;

  // Get tier information from centralized source
  const tierInfo = SUBSCRIPTION_TIERS.find(t => t.id === effectiveTier);

  const badgeContent = {
    label: tierInfo
      ? (tierInfo.amount > 50 ? 'Over $50/month' : `$${tierInfo.amount}/month`)
      : 'Subscription',
    tooltip: tierInfo
      ? (tierInfo.amount > 50 ? 'Champion+ - Over $50/month' : `${tierInfo.name} - $${tierInfo.amount}/month`)
      : 'Subscription',
    bgColor: 'bg-muted',
    borderColor: 'border-theme-medium',
    textColor: 'text-foreground'
  };

  // Use the SubscriptionTierBadge component
  const SvgIcon = () => {
    return <SubscriptionTierBadge tier={effectiveTier} status={status} amount={amount} size="sm" />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center gap-2 px-2 py-1 rounded-full ${badgeContent.bgColor} ${badgeContent.borderColor} border ${className}`}
          >
            <SvgIcon />
            {showLabel && (
              <span className={`text-xs font-medium ${badgeContent.textColor}`}>
                {badgeContent.label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{badgeContent.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}