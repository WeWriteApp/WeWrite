"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { SupporterIcon } from './SupporterIcon';
import { useAuth } from "../../providers/AuthProvider";
import { useFeatureFlag } from "../../utils/feature-flags";

interface SupporterBadgeProps {
  tier?: string;
  className?: string;
  showLabel?: boolean;
  status?: string;
}

export default function SupporterBadge({ tier, className = '', showLabel = false, status = 'active' }: SupporterBadgeProps) {
  const { user } = useAuth();
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email);

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
        bgColor: 'bg-neutral-100 dark:bg-neutral-800',
        borderColor: 'border-neutral-300 dark:border-neutral-700',
        textColor: 'text-gray-800 dark:text-gray-200'
      };
      break;
    case 'tier2':
      badgeContent = {
        label: 'Tier 2 Subscription',
        tooltip: 'Tier 2 Subscription - $20/month',
        bgColor: 'bg-neutral-100 dark:bg-neutral-800',
        borderColor: 'border-neutral-300 dark:border-neutral-700',
        textColor: 'text-gray-800 dark:text-gray-200'
      };
      break;
    case 'tier3':
      badgeContent = {
        label: 'Tier 3 Subscription',
        tooltip: 'Tier 3 Subscription - $50/month',
        bgColor: 'bg-neutral-100 dark:bg-neutral-800',
        borderColor: 'border-neutral-300 dark:border-neutral-700',
        textColor: 'text-gray-800 dark:text-gray-200'
      };
      break;
    // Legacy tier support
    case 'bronze':
      badgeContent = {
        label: 'Tier 1 Subscription',
        tooltip: 'Tier 1 Subscription - $10/month',
        bgColor: 'bg-neutral-100 dark:bg-neutral-800',
        borderColor: 'border-neutral-300 dark:border-neutral-700',
        textColor: 'text-gray-800 dark:text-gray-200'
      };
      tier = 'tier1';
      break;
    case 'silver':
      badgeContent = {
        label: 'Tier 2 Subscription',
        tooltip: 'Tier 2 Subscription - $20/month',
        bgColor: 'bg-neutral-100 dark:bg-neutral-800',
        borderColor: 'border-neutral-300 dark:border-neutral-700',
        textColor: 'text-gray-800 dark:text-gray-200'
      };
      tier = 'tier2';
      break;
    case 'gold':
      badgeContent = {
        label: 'Tier 3 Subscription',
        tooltip: 'Tier 3 Subscription - $50/month',
        bgColor: 'bg-neutral-100 dark:bg-neutral-800',
        borderColor: 'border-neutral-300 dark:border-neutral-700',
        textColor: 'text-gray-800 dark:text-gray-200'
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
