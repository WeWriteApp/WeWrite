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
  pillVariant?: 'primary' | 'secondary' | 'outline';
}

export function SubscriptionTierBadge({
  tier,
  status,
  amount,
  size = 'sm',
  className = '',
  isLoading = false,
  pillVariant = 'primary'
}: SubscriptionTierBadgeProps) {

  // Size configurations - moved to top to fix initialization error
  const sizeConfig = {
    sm: { icon: 12, gap: 'gap-0.5' },
    md: { icon: 14, gap: 'gap-1' },
    lg: { icon: 16, gap: 'gap-1' }
  };

  // Show loading state only if explicitly loading
  // Don't show loading when subscription data has been fetched but is null (no subscription)
  if (isLoading) {
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

  // Determine cancel icon color based on pill variant
  const getCancelIconColor = () => {
    // For filled/primary variant: white text, so white icon
    if (pillVariant === 'primary') {
      return 'text-white dark:text-white';
    }
    // For outline, secondary, and other variants: accent/primary color
    return 'text-primary';
  };

  // Get badge content based on tier
  const getBadgeContent = () => {
    switch (finalTier) {
      case 'inactive':
        return {
          icon: <Ban size={config.icon} className={getCancelIconColor()} />,
          tooltip: 'No active subscription - $0/mo',
          color: getCancelIconColor()
        };
      case 'tier1':
        return {
          icon: <Star size={config.icon} className="text-yellow-400/70 fill-yellow-400/70" />,
          tooltip: 'Supporter - $10/mo',
          color: 'text-yellow-400/70'
        };
      case 'tier2':
        return {
          icon: (
            <div className={`flex ${config.gap}`}>
              <Star size={config.icon} className="text-yellow-500 fill-yellow-500" />
              <Star size={config.icon} className="text-yellow-500 fill-yellow-500" />
            </div>
          ),
          tooltip: 'Advocate - $20/mo',
          color: 'text-yellow-500'
        };
      case 'tier3':
        return {
          icon: (
            <div className={`flex ${config.gap} relative group cursor-pointer`}>
              {/* Particles emitting from center */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* Subtle floating particles */}
                <span className="absolute w-0.5 h-0.5 bg-yellow-300/60 rounded-full animate-ping"
                     style={{
                       animationDelay: '0s',
                       animationDuration: '3s',
                       transform: 'translate(8px, -6px)'
                     }}></span>
                <span className="absolute w-0.5 h-0.5 bg-yellow-300/40 rounded-full animate-pulse"
                     style={{
                       animationDelay: '1s',
                       animationDuration: '4s',
                       transform: 'translate(-6px, 4px)'
                     }}></span>
                <span className="absolute w-0.5 h-0.5 bg-yellow-300/50 rounded-full animate-ping"
                     style={{
                       animationDelay: '2s',
                       animationDuration: '3.5s',
                       transform: 'translate(10px, 8px)'
                     }}></span>
                <span className="absolute w-0.5 h-0.5 bg-yellow-300/30 rounded-full animate-pulse"
                     style={{
                       animationDelay: '0.5s',
                       animationDuration: '5s',
                       transform: 'translate(-8px, -4px)'
                     }}></span>

                {/* Burst particles on hover/click */}
                <span className="absolute w-0.5 h-0.5 bg-yellow-200 rounded-full opacity-0 group-hover:opacity-80 group-active:opacity-100 transition-opacity duration-200 animate-ping"
                     style={{
                       animationDuration: '1s',
                       transform: 'translate(12px, -10px)'
                     }}></span>
                <span className="absolute w-0.5 h-0.5 bg-yellow-200 rounded-full opacity-0 group-hover:opacity-60 group-active:opacity-90 transition-opacity duration-200 animate-pulse"
                     style={{
                       animationDuration: '0.8s',
                       transform: 'translate(-10px, 12px)'
                     }}></span>
                <span className="absolute w-0.5 h-0.5 bg-yellow-200 rounded-full opacity-0 group-hover:opacity-70 group-active:opacity-100 transition-opacity duration-200 animate-ping"
                     style={{
                       animationDuration: '1.2s',
                       transform: 'translate(14px, 6px)'
                     }}></span>
              </div>

              {/* Main stars with glow effect */}
              <Star size={config.icon} className="text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)] animate-pulse relative z-10" />
              <Star size={config.icon} className="text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)] animate-pulse relative z-10" style={{ animationDelay: '0.2s' }} />
              <Star size={config.icon} className="text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)] animate-pulse relative z-10" style={{ animationDelay: '0.4s' }} />
            </div>
          ),
          tooltip: 'Champion - $30+/mo',
          color: 'text-yellow-400'
        };
      default:
        return {
          icon: <Ban size={config.icon} className="text-muted-foreground dark:text-white" />,
          tooltip: 'No subscription',
          color: 'text-muted-foreground dark:text-white'
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
