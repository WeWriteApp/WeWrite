"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Ban, Star } from 'lucide-react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useFeatureFlag } from '../../utils/feature-flags';
import { getSubscriptionStatusInfo, isActiveSubscription } from '../../utils/subscriptionStatus';

interface SupporterIconProps {
  tier?: string | null;
  status?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function SupporterIcon({ tier, status, size = 'sm', className = '' }: SupporterIconProps) {
  const { currentAccount } = useCurrentAccount();
  const isPaymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  // If payments feature flag is disabled, don't render anything
  if (!isPaymentsEnabled) {
    return null;
  }
  // Use unified status system
  const statusInfo = getSubscriptionStatusInfo(status);
  const isActive = statusInfo.isActive;
  const iconSizes = { sm: 14, md: 16, lg: 20, xl: 32 };
  const iconSize = iconSizes[size];

  let tooltipText = 'No subscription - $0/mo';
  let iconContent = null;

  if (!tier || tier === 'tier0' || !isActive) {
    tooltipText = `No active subscription (${statusInfo.displayText})`;
    iconContent = (
      <Ban size={iconSize} className="text-gray-400 dark:text-gray-500" />
    );
  } else if (tier === 'tier1') {
    tooltipText = `Tier 1 Subscription - $10/mo (${statusInfo.displayText})`;
    iconContent = (
      <Star size={iconSize} className="text-yellow-400 dark:text-yellow-300" fill="#facc15" />
    );
  } else if (tier === 'tier2') {
    tooltipText = `Tier 2 Subscription - $20/mo (${statusInfo.displayText})`;
    iconContent = (
      <>
        <Star size={iconSize} className="text-yellow-400 dark:text-yellow-300" fill="#facc15" />
        <Star size={iconSize} className="text-yellow-400 dark:text-yellow-300 ml-1" fill="#facc15" />
      </>
    );
  } else if (tier === 'tier3') {
    tooltipText = `Tier 3 Subscription - $50+/mo (${statusInfo.displayText})`;
    iconContent = (
      <span className="flex items-center gap-0.5">
        <Star size={iconSize} className="text-yellow-400 drop-shadow-glow" fill="#facc15" />
        <Star size={iconSize} className="text-yellow-400 drop-shadow-glow" fill="#facc15" />
        <Star size={iconSize} className="text-yellow-400 drop-shadow-glow" fill="#facc15" />
      </span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center ${className}`}>{iconContent}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}