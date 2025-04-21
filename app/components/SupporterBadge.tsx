"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

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
        label: 'Tier 1 Supporter',
        tooltip: 'Tier 1 Supporter - $10/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      break;
    case 'tier2':
      badgeContent = {
        label: 'Tier 2 Supporter',
        tooltip: 'Tier 2 Supporter - $20/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      break;
    case 'tier3':
      badgeContent = {
        label: 'Tier 3 Supporter',
        tooltip: 'Tier 3 Supporter - $50/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      break;
    case 'tier4':
      badgeContent = {
        label: 'Tier 4 Supporter',
        tooltip: 'Tier 4 Supporter - $100+/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      break;
    // Legacy tier support
    case 'bronze':
      badgeContent = {
        label: 'Tier 1 Supporter',
        tooltip: 'Tier 1 Supporter - $10/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      tier = 'tier1';
      break;
    case 'silver':
      badgeContent = {
        label: 'Tier 2 Supporter',
        tooltip: 'Tier 2 Supporter - $20/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      tier = 'tier2';
      break;
    case 'gold':
      badgeContent = {
        label: 'Tier 3 Supporter',
        tooltip: 'Tier 3 Supporter - $50/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      tier = 'tier3';
      break;
    case 'diamond':
      badgeContent = {
        label: 'Tier 4 Supporter',
        tooltip: 'Tier 4 Supporter - $100+/month',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300'
      };
      tier = 'tier4';
      break;
    default:
      return null;
  }

  // Create the SVG icon
  const SvgIcon = () => {
    const iconSize = '16px';
    const dotSize = '4px';

    // Get the appropriate styling
    let strokeDasharray = !isActive ? '2' : 'none';

    // Custom SVG content based on tier
    let svgContent = null;

    if (tier === 'tier1') {
      // Circle with one dot in center
      svgContent = (
        <circle
          cx="50%"
          cy="50%"
          r={dotSize}
          fill="currentColor"
          stroke="none"
        />
      );
    } else if (tier === 'tier2') {
      // Circle with two dots
      svgContent = (
        <>
          <circle
            cx="40%"
            cy="50%"
            r={dotSize}
            fill="currentColor"
            stroke="none"
          />
          <circle
            cx="60%"
            cy="50%"
            r={dotSize}
            fill="currentColor"
            stroke="none"
          />
        </>
      );
    } else if (tier === 'tier3') {
      // Circle with three dots in a triangle
      svgContent = (
        <>
          <circle
            cx="50%"
            cy="35%"
            r={dotSize}
            fill="currentColor"
            stroke="none"
          />
          <circle
            cx="35%"
            cy="60%"
            r={dotSize}
            fill="currentColor"
            stroke="none"
          />
          <circle
            cx="65%"
            cy="60%"
            r={dotSize}
            fill="currentColor"
            stroke="none"
          />
        </>
      );
    } else if (tier === 'tier4') {
      // Circle with diamond shape
      svgContent = (
        <path
          d="M50,30 L65,50 L50,70 L35,50 Z"
          fill="currentColor"
          stroke="none"
          transform="scale(0.7)"
        />
      );
    }

    return (
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className={isActive ? '' : 'opacity-50'}
        style={{ color: 'inherit' }}
      >
        {/* Main circle - always an outline */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={strokeDasharray}
        />
        {/* Tier-specific content - only visible if active */}
        {isActive && svgContent}
      </svg>
    );
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${badgeContent.bgColor} ${badgeContent.borderColor} border ${className}`}
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
