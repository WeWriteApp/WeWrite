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
    sm: '3px',
    md: '4px',
    lg: '5px'
  };

  const iconSize = iconSizes[size];
  const dotSize = dotSizes[size];

  // Get the appropriate tooltip text based on tier and status
  let tooltipText = 'Not a supporter - $0/mo';
  let strokeDasharray = !isActive ? '2' : 'none';

  // Custom SVG content based on tier
  let svgContent = null;

  if (tier) {
    if (tier === 'tier1') {
      tooltipText = isActive ? 'Tier 1 Supporter - $10/mo' : 'Inactive Tier 1 Supporter';
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
      tooltipText = isActive ? 'Tier 2 Supporter - $20/mo' : 'Inactive Tier 2 Supporter';
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
      tooltipText = isActive ? 'Tier 3 Supporter - $50/mo' : 'Inactive Tier 3 Supporter';
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
      tooltipText = isActive ? 'Tier 4 Supporter - $100+/mo' : 'Inactive Tier 4 Supporter';
      // Circle with diamond shape that fills the whole circle
      svgContent = (
        <circle
          cx="50"
          cy="50"
          r="35"
          fill="currentColor"
          stroke="none"
        />
      );
    }
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
                strokeWidth="3.5"
                strokeDasharray={strokeDasharray}
              />
              {/* Tier-specific content - only visible if active */}
              {isActive && svgContent}
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
