"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface SupporterIconProps {
  tier?: string | null;
  status?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SupporterIcon({ tier, status, size = 'sm', className = '' }: SupporterIconProps) {
  // Determine if subscription is active
  const isActive = status === 'active' || status === 'trialing';

  // Set icon size based on the size prop
  const iconSizes = {
    sm: '14px',
    md: '16px',
    lg: '20px'
  };

  const dotSizes = {
    sm: '5px',
    md: '6px',
    lg: '7px'
  };

  const iconSize = iconSizes[size];
  const dotSize = dotSizes[size];

  // Get the appropriate tooltip text based on tier and status
  let tooltipText = 'Not a supporter - $0/mo';

  // Custom SVG content based on tier
  let svgContent = null;

  if (tier) {
    if (tier === 'tier1') {
      tooltipText = isActive ? 'Tier 1 Supporter - $10/mo' : 'Inactive Tier 1 Supporter';
      // One dot
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
      tooltipText = isActive ? 'Tier 2 Supporter - $20/mo' : 'Inactive Tier 2 Supporter';
      // Two dots horizontal
      svgContent = (
        <>
          <circle
            cx="35%"
            cy="50%"
            r={dotSize}
            fill="currentColor"
            stroke="none"
          />
          <circle
            cx="65%"
            cy="50%"
            r={dotSize}
            fill="currentColor"
            stroke="none"
          />
        </>
      );
    } else if (tier === 'tier3') {
      tooltipText = isActive ? 'Tier 3 Supporter - $50/mo' : 'Inactive Tier 3 Supporter';
      // Three dots in a triangle
      svgContent = (
        <>
          <circle
            cx="50%"
            cy="30%"
            r={dotSize}
            fill="currentColor"
            stroke="none"
          />
          <circle
            cx="30%"
            cy="65%"
            r={dotSize}
            fill="currentColor"
            stroke="none"
          />
          <circle
            cx="70%"
            cy="65%"
            r={dotSize}
            fill="currentColor"
            stroke="none"
          />
        </>
      );
    } else if (tier === 'tier4') {
      tooltipText = isActive ? 'Tier 4 Supporter - $100+/mo' : 'Inactive Tier 4 Supporter';
      // Filled equilateral triangle
      svgContent = (
        <path
          d="M50,30 L20,80 L80,80 Z"
          fill="currentColor"
          stroke="none"
        />
      );
    }
  } else {
    // None: X
    svgContent = (
      <>
        <line x1="30" y1="30" x2="70" y2="70" stroke="currentColor" strokeWidth="3" />
        <line x1="70" y1="30" x2="30" y2="70" stroke="currentColor" strokeWidth="3" />
      </>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center ${className}`}>
            <svg
              width={iconSize}
              height={iconSize}
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
              className={`${isActive ? '' : 'opacity-50'} text-gray-800 dark:text-gray-200`}
            >
              {/* Tier-specific content */}
              {svgContent}
            </svg>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
