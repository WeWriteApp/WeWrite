"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { SupporterIcon } from './SupporterIcon';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useFeatureFlag } from "../../utils/feature-flags";

interface SupporterBadgeProps {
  tier?: string;
  className?: string;
  showLabel?: boolean;
  status?: string;
}

export default function SupporterBadge({ tier, className = '', showLabel = false, status = 'active' }: SupporterBadgeProps) {
  const { currentAccount } = useCurrentAccount();
  const isPaymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  // If payments feature flag is disabled, don't render anything
  if (!isPaymentsEnabled) {
    return null;
  }

  if (!tier) return null;

  // Determine if subscription is active
  const isActive = status === 'active' || status === 'trialing';

  let badgeContent;

  switch (tier.toLowerCase()) {
    case 'tier1':
      badgeContent = {
        label: 'Tier 1 Subscription',
        tooltip: 'Tier 1 Subscription - $10/month',
        bgColor: 'bg-muted',
        borderColor: 'border-theme-medium',
        textColor: 'text-foreground'
      };
      break;
    case 'tier2':
      badgeContent = {
        label: 'Tier 2 Subscription',
        tooltip: 'Tier 2 Subscription - $20/month',
        bgColor: 'bg-muted',
        borderColor: 'border-theme-medium',
        textColor: 'text-foreground'
      };
      break;
    case 'tier3':
      badgeContent = {
        label: 'Tier 3 Subscription',
        tooltip: 'Tier 3 Subscription - $50/month',
        bgColor: 'bg-muted',
        borderColor: 'border-theme-medium',
        textColor: 'text-foreground'
      };
      break;
    // Legacy tier support
    case 'bronze':
      badgeContent = {
        label: 'Tier 1 Subscription',
        tooltip: 'Tier 1 Subscription - $10/month',
        bgColor: 'bg-muted',
        borderColor: 'border-theme-medium',
        textColor: 'text-foreground'
      };
      tier = 'tier1';
      break;
    case 'silver':
      badgeContent = {
        label: 'Tier 2 Subscription',
        tooltip: 'Tier 2 Subscription - $20/month',
        bgColor: 'bg-muted',
        borderColor: 'border-theme-medium',
        textColor: 'text-foreground'
      };
      tier = 'tier2';
      break;
    case 'gold':
      badgeContent = {
        label: 'Tier 3 Subscription',
        tooltip: 'Tier 3 Subscription - $50/month',
        bgColor: 'bg-muted',
        borderColor: 'border-theme-medium',
        textColor: 'text-foreground'
      };
      tier = 'tier3';
      break;
    default:
      return null;
  }

  // Use the SupporterIcon component
  const SvgIcon = () => {
    return <SupporterIcon tier={tier} status={status} size="sm" />;
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