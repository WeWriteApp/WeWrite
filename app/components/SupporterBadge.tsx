"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { SupporterIcon } from './SupporterIcon';

interface SupporterBadgeProps {
  tier?: string;
  className?: string;
  showLabel?: boolean;
  status?: string;
}

export default function SupporterBadge({ tier, className = '', showLabel = false, status = 'active' }: SupporterBadgeProps) {
  if (!tier) return null;

  // Determine if subscription is active
  const isActive = status === 'active' || status === 'trialing';

  let badgeContent;

  switch (tier.toLowerCase()) {
    case 'tier1':
      badgeContent = {
        label: 'Tier 1 Subscription',
        tooltip: 'Tier 1 Subscription - $10/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      break;
    case 'tier2':
      badgeContent = {
        label: 'Tier 2 Subscription',
        tooltip: 'Tier 2 Subscription - $20/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      break;
    case 'tier3':
      badgeContent = {
        label: 'Tier 3 Subscription',
        tooltip: 'Tier 3 Subscription - $50/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      break;
    case 'tier4':
      badgeContent = {
        label: 'Tier 4 Subscription',
        tooltip: 'Tier 4 Subscription - $100+/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      break;
    // Legacy tier support
    case 'bronze':
      badgeContent = {
        label: 'Tier 1 Subscription',
        tooltip: 'Tier 1 Subscription - $10/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      tier = 'tier1';
      break;
    case 'silver':
      badgeContent = {
        label: 'Tier 2 Subscription',
        tooltip: 'Tier 2 Subscription - $20/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      tier = 'tier2';
      break;
    case 'gold':
      badgeContent = {
        label: 'Tier 3 Subscription',
        tooltip: 'Tier 3 Subscription - $50/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      tier = 'tier3';
      break;
    case 'diamond':
      badgeContent = {
        label: 'Tier 4 Subscription',
        tooltip: 'Tier 4 Subscription - $100+/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      tier = 'tier4';
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
